# 04 — Рантайм: `assert` на ошибочные статусы, `allowedHosts`, английские сообщения

> Самодостаточная задача. Общие решения, порядок и принципы тестов — в
> [README.md](README.md). От 01–03 не зависит. Нужен только `include` в
> корневом `tsconfig.json` из 01 (шаг 1), чтобы `tsc` проверял файлы
> тестов типов.

## A. `assert` на ошибочные статусы

### Проблема

Незадекларированный в свагере статус требует каста: в примерах есть
`missing.assert(404 as any)`, `res.assert(401 as any)`, `res.assert(200 as any)`.
А негативные тесты — это половина тестов бэкенда.

### Требования (договорились)

- Задекларированные статусы подсказывает автокомплит. Видно, где 200, а
  где 201 или 204, — гадать не нужно.
- Любой 4xx/5xx можно передать без каста, но автокомплит **не** забит
  кодами 400–599.
- Незадекларированный 1xx–3xx — ошибка типов. Опечатка 200 вместо 201
  ловится, как сейчас.
- Тело задекларированного статуса типизировано, **в том числе у 4xx**
  (409 с `ErrorDto`): лишнее поле — ошибка.

| Вызов (свагер: 201 и 409) | Результат |
|---------------------------|-----------|
| `assert(201, { id })` | ок, тело типизировано |
| `assert(409, { message })` | ок, тело типизировано |
| `assert(409, { wrong: 1 })` | **ошибка типов** |
| `assert(403)` / `assert(500, {…})` | ок, тело не типизировано |
| `assert(200)` | **ошибка типов** (не задекларирован) |
| `assert(302)` | **ошибка типов** |

### Реализация — перегрузки

```ts
/** 4xx/5xx, которого НЕТ в свагере. Задекларированные идут первой перегрузкой. */
type UndeclaredErrorStatus<S extends number, M> = S extends keyof M
  ? never
  : `${S}` extends `4${string}` | `5${string}`
    ? S
    : never

assert<S extends keyof M>(status: S, expectedBody?: DeepPartial<M[S]>): this
assert<S extends number>(status: S & UndeclaredErrorStatus<S, M>, expectedBody?: unknown): this
assert(status: number, expectedBody?: unknown): this { /* рантайм как сейчас */ }
```

- Первая перегрузка даёт автокомплит из `keyof M`. У второй нет союза
  литералов, поэтому она ничего в подсказки не добавляет.
- Задекларированные статусы **исключены** из второй перегрузки. Иначе
  `assert(409, { wrong: 1 })` молча прошёл бы через неё с телом `unknown`.
- Ограничение: статус из переменной типа `number`
  (`for (const s of [401, 403])`) требует `as const`. Написать в README.
- Неверный вызов даёт ошибку TS «No overload matches this call» —
  приемлемо.
- Рантайм-логика (`assertResponse`) не меняется.
- Что автокомплит не засорён, проверяем **руками** в VS Code: `tsc`
  подсказки не проверяет.

### Тест типов

`src/response.type-test.ts`. Это не `*.test.ts`, поэтому в рантайме он не
запускается, а проверяет его `pnpm lint`:

```ts
declare const res: ApiResponse<{ 201: { id: string }; 409: { message: string } }>

res.assert(201, { id: 'x' })
res.assert(409, { message: 'x' })
res.assert(403)
res.assert(500, { anything: true })
// @ts-expect-error — 200 не задекларирован (опечатка вместо 201)
res.assert(200)
// @ts-expect-error — 3xx не задекларирован
res.assert(302)
// @ts-expect-error — тело задекларированного 409 типизировано
res.assert(409, { wrong: 1 })
// @ts-expect-error — тело 201 типизировано
res.assert(201, { id: 1 })
```

### Примеры

Убрать `as any` из всех `assert` в `examples/`. Подтвердит `typecheck` в 05.

## B. `allowedHosts` — защита от прода

### Решения

- Новое поле конфига `allowedHosts?: string[]`. Loopback (`localhost`,
  `127.0.0.1`, `[::1]`) разрешён **всегда**, список его дополняет. Правило
  простое: «localhost можно всегда, остальное — только из списка».
- Элемент списка — точный hostname или `*.domain`. `*.staging.x.com`
  совпадает с `api.staging.x.com`, но не с `staging.x.com`. Регистр не
  важен, порт игнорируется.
- **Только режим `test`.** В `frontend` клиент работает из приложения и
  ходит в прод — там проверка его бы сломала. Рендер вставляет проверку
  только для `test`.
- **Где:** в сгенерированном `makeRequest` после вычисления `baseUrl`.
  `makeRequest` вызывается в `new World()` и в `createUser()`, поэтому
  ошибка вылетает **до первого запроса** и покрывает переопределение
  `new World({ url })`. Значение читается из `ebely.allowedHosts` в
  рантайме (как `maxRetries`), перегенерация не нужна.
- Чистая логика — в `src/safety.ts`: `isHostAllowed({ url, allowedHosts })`
  и `assertHostAllowed(...)`, бросает `EbelyUnsafeHostError`. Экспорт из
  `index.ts`: сгенерированный файл импортирует его из `ebely`.
- Сообщение: *"ebely: refusing to send requests to "api.prod.com" — the host
  is not in allowedHosts. Tests create and delete data. If this is a test
  environment, add the host to `allowedHosts` in ebely.ts."*

### Тесты

- `src/safety.test.ts`:
  - `localhost`, `127.0.0.1`, `[::1]` разрешены без списка;
  - чужой хост запрещён;
  - точное совпадение работает;
  - wildcard работает для поддомена, но не для самого домена;
  - регистр не важен;
  - текст ошибки содержит хост и подсказку.
- `render.test.ts`: в режиме `test` есть вызов `assertHostAllowed`, в
  `frontend` его нет.

## C. Английские сообщения

Всё, что видит пользователь, переводим на английский:

- ошибки `assert` (`response.ts`);
- `loadSpec` (`swagger.ts`);
- лог `generate-client.ts`;
- `version.ts` и `safety.ts`;
- вывод CLI (`bin/ebely.mjs`).

Тесты, которые сверяют русский текст (`response.test.ts`), обновить.
Комментарии в коде и в `generated.ts` — вне скоупа.

## Где править

| Файл | Что |
|------|-----|
| `src/response.ts` | перегрузки `assert`, `UndeclaredErrorStatus`, английский текст |
| `src/response.type-test.ts` (новый) | тест типов |
| `src/safety.ts`, `src/safety.test.ts` (новые) | allowlist |
| `src/config.ts` | `allowedHosts` с JSDoc |
| `index.ts` | экспорт `assertHostAllowed`, `EbelyUnsafeHostError` |
| `src/generator/render.ts` | импорт и вызов проверки в режиме `test` |
| `src/generator/swagger.ts`, `src/generate-client.ts`, `bin/ebely.mjs` | английский |
| `examples/**/tests/*.ts` | убрать `as any` |
| `ARCHITECTURE.md`, `CLAUDE.md`, `.changeset/*` | описание; minor |

## Готово когда

- `pnpm test` и `pnpm lint` зелёные, включая тест типов;
- в VS Code автокомплит `res.assert(` показывает только задекларированные
  статусы;
- в примерах нет `as any` у `assert`;
- `new World({ url: 'https://example.com' })` в режиме `test` падает с
  понятной ошибкой.
