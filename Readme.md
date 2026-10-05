### Быстрый старт из шаблона

Склонировать готовый тест-проект (как `create-react-app`):

```sh
npx ebely create my-tests   # в новую/пустую папку
# или
npx ebely create            # в текущую папку
```

Затем:

```sh
cd my-tests
pnpm install
# отредактируй ebely/ebely.ts (url, путь к swagger) под свой бэкенд
pnpm run client:generate
pnpm test
```

### Алгоритм действий для пользователя библиотекой


#### 1. Установить библиотеку
`pnpm add -D ebely`

#### 2. Один раз разложить скиллы в проект
`npx ebely skills`

#### 3. Открыть проект в Claude Code и вызвать настройку
`/ebely-setup `            # настроит конфиг, сгенерирует клиент, стор, хуки

#### 4. Дальше при написании любых тестов
`/ebely-write-tests `      # опишет сценарий — тесты напишутся сами

### Негативные тесты: `assert` на 4xx/5xx

```ts
res.assert(201, { id })        // статус из свагера: подсказывается, тело типизировано
res.assert(409, { message })   // 4xx из свагера — тоже типизирован
res.assert(403)                // любой 4xx/5xx, которого нет в свагере, — без каста
res.assert(200)                // ошибка типов, если в свагере только 201
```

Статус из переменной типа `number` нужно сузить через `as const`:
`for (const s of [401, 403] as const) res.assert(s)`.

### Защита от прода: `allowedHosts`

В режиме `test` клиент ходит только на `localhost` / `127.0.0.1` /
`[::1]` и хосты из `allowedHosts` (точное имя или `*.domain`). Иначе
`new World()` падает с `EbelyUnsafeHostError` ещё до первого запроса:

```ts
export const ebely = {
  url: 'https://api.staging.example.com',
  allowedHosts: ['*.staging.example.com'],
  // …
} satisfies EbelyConfig
```

