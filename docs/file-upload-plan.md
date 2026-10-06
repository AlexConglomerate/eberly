# План: загрузка файлов через сгенерированный клиент ebely

> Самодостаточный документ для реализации в новом чате. Содержит весь
> контекст (что, где, почему именно так), мотивирующий пример, найденные
> технические факты, принятые решения и пошаговый план врезки кода.

## 0. Цель одной фразой

Дать пользователю возможность отправлять файлы типизированным методом
клиента, просто передав **путь к файлу** (или `File`/`Blob`), вместо того
чтобы собирать `multipart/form-data` руками через `fetch`. Один файл или
несколько — генератор сам понимает это из swagger.

Должно стать так:

```ts
const upload = await user.wordCard.wordCardUploadScreenshots({
  body: { files: ["./data/screenshots/a.jpg", "./data/screenshots/b.jpg"] },
})
upload.assert(200)
```

---

## 1. Мотивирующий пример (что пользователь делает СЕЙЧАС руками)

Файл `/Users/mac/code/english/bany/apps/tests/tests/inbox.test.ts`,
функция `uploadScreenshots`. `/word-cards/screenshots` — единственный
multipart-эндпоинт, и сгенерированный клиент его отправить не умеет,
поэтому его зовут «руками»:

```ts
// Скриншоты — единственный multipart-эндпоинт. Сгенерированный ebely-клиент шлёт
// только JSON, поэтому зовём его «руками» через fetch, повторяя кодировку orpc
// для массива файлов: files[0], files[1], … (bracket-notation).
async function uploadScreenshots({ token, names }: { token: string; names: string[] }): Promise<Response> {
  const form = new FormData()
  for (const [i, name] of names.entries()) {
    const bytes = await readFile(new URL(`../data/screenshots/${name}`, import.meta.url))
    form.append(`files[${i}]`, new File([bytes], name, { type: "image/jpeg" }))
  }
  return fetch(`${keys.urls.publicApi}/api/word-cards/screenshots`, {
    method: "POST",
    // content-type НЕ ставим — fetch сам выставит multipart с boundary.
    headers: { authorization: `Bearer ${token}`, [FAKE_AI_HEADER]: "1" },
    body: form,
  })
}
```

Вызов внутри теста:

```ts
const token = user.get({ key: "token" })
const pictures = items.filter((i) => i.type === "picture").map((i) => i.picture)
const upload = await uploadScreenshots({ token, names: pictures })
expect(upload.status).toBe(200)
```

**Цель фичи** — заменить весь этот воркэраунд на один типизированный вызов
(см. §0). После фичи bany уберёт `uploadScreenshots` и `readFile`-импорт,
а файлы передаст путями.

Бэкенд bany (oRPC), эндпоинт:
`/Users/mac/code/english/bany/apps/api/src/wordCard/api/wordCard.controller.ts`
→ `wordCardUploadScreenshots` (POST `/word-cards/screenshots`).
Его input-схема (zod + `@orpc/zod`):

```ts
// apps/api/src/wordCard/_validation/fields.ts:71
wordCardUploadScreenshots: z.object({
  files: z.array(file().type('image/*')).min(1).max(keys.pictures.maxCount),
}),
```

---

## 2. Как устроена библиотека ebely (карта кода)

Корень: `/Users/mac/code/lib/evely`. Подробности — `ARCHITECTURE.md`.

Конвейер генератора (вызывается скриптом `client:generate`, один раз):

```
loadSpec (src/generator/swagger.ts)
  → collectOperations (src/generator/operations.ts)
  → renderClient (src/generator/render.ts)
  → writeFile  (src/generate-client.ts)
```

Рантайм-ядро (попадает в npm-пакет, реэкспорт из `index.ts`):
- `src/base-store.ts` — `BaseStore`.
- `src/response.ts` — `ApiResponse` + `assert`.
- `src/hooks.ts` — `HookRegistry` + типы хуков.
- `src/config.ts` — публичный тип `EbelyConfig`.

Внутренности генератора (НЕ публичные), `src/generator/`:
- `swagger.ts` — `SwaggerSource` + `loadSpec`.
- `schema.ts` — `schemaToType` (JSON-Schema → строка TS-типа), `resolveRef`,
  `pickResponseSchema`, `collectResponseSchemas`.
- `operations.ts` — `collectOperations` (paths → `Operation[]`).
- `render.ts` — `renderClient` (модель → текст файла клиента).
- `types.ts` — общий тип `Json`.

Юнит-тесты: `src/*.test.ts`, `src/generator/*.test.ts` (чистые функции,
без сети). Запуск: `pnpm test` в корне. Сборка: `pnpm build`. Линт
(`tsc` по всему репо, включая примеры): `pnpm lint`.

Пример: `examples/simple/test-with-ebely` (пользователь ebely) +
`examples/simple/your-app` (тестируемый oRPC-бэкенд). Конфиг пользователя:
`examples/simple/test-with-ebely/ebely/ebely.ts`.

---

## 3. Почему СЕЙЧАС файлы не отправляются (корень проблемы)

Две точки, обе нужно трогать:

**(а) Генератор читает тело только из `application/json`.**
`src/generator/operations.ts` (~строка 58):

```ts
const bodySchema = op.requestBody?.content?.['application/json']?.schema
```

`multipart/form-data` не рассматривается вообще.

**(б) Рантайм всегда шлёт JSON.**
`src/generator/render.ts`, общий `request` внутри `makeRequest` (~строки
390–398):

```ts
const hasBody = hookReq.body !== undefined
const response = await fetch(url, {
  method,
  headers: {
    ...(hasBody ? { 'content-type': 'application/json' } : {}),
    ...hookReq.headers,
  },
  body: hasBody ? JSON.stringify(hookReq.body) : undefined,
})
```

Жёстко `content-type: application/json` + `JSON.stringify`. Канала для
файлов нет.

**Следствие** (проверено в `bany/apps/tests/ebely/generated.ts`): метод
для скриншотов СГЕНЕРИРОВАЛСЯ, но файлы затипизированы как `Array<string>`
и ушли бы как `{"files":[...]}` в JSON — бэкенд это отклонит:

```ts
"wordCardUploadScreenshots": (input: { body: { files: Array<string> } }) => ...
```

---

## 4. Ключевые технические факты (контекст, который легко потерять)

### 4.1 «Три версии свагера» — это диалекты OpenAPI

Файл в спеке описывается по-разному в зависимости от версии. **В этой
фиче ориентируемся ТОЛЬКО на OpenAPI 3.1** (старые — задел на будущее,
см. §8):

| Версия | Как выглядит файл | Поддержка сейчас |
|---|---|---|
| Swagger/OpenAPI **2.0** | `in: formData, type: file` (массив: `type: array, items: {type: file}`), `consumes: [multipart/form-data]` | НЕТ (задел) |
| OpenAPI **3.0** | `{ type: "string", format: "binary" }` | НЕТ (задел) |
| OpenAPI **3.1** | `{ type: "string", contentMediaType: "<mime>" }` | **ДА** |

Признак файла, который детектим (3.1): узел схемы, где
`type === "string"` И `typeof contentMediaType === "string"`.

### 4.2 oRPC (наш основной стек) эмитит 3.1 и кладёт ДВА content-типа

`@orpc/openapi`, функция `toOpenAPIContent`: для объекта со вложенным
файлом эмитятся СРАЗУ оба content-типа на один body:

```js
content["application/json"]    = { schema }   // ← это и цепляет генератор сейчас
content["multipart/form-data"] = { schema }   // ← а это игнорируется
```

Схема в обоих одинаковая. Для `files: z.array(file().type('image/*'))`
тело такое (3.1):

```json
{ "type": "object",
  "properties": {
    "files": { "type": "array",
               "items": { "type": "string", "contentMediaType": "image/*" } } } }
```

Проверено: `isFileSchema` в `@orpc/openapi` — это ровно
`type === "string" && typeof contentMediaType === "string"`.

### 4.3 Универсального формата multipart НЕТ — но это не «по фреймворку»

Сам wire-формат `multipart/form-data` (RFC 7578) одинаков везде.
Различается ТОЛЬКО **именование полей при МАССИВЕ файлов**. Конвенций
реально три, а не «по штуке на фреймворк»:

| Конвенция | Имена полей | Кто ждёт |
|---|---|---|
| **repeat** | `files`, `files`, `files` | Express/multer, Nest (multer), Fastify (@fastify/multipart) — все на busboy; Go `r.MultipartForm.File["files"]`; Rust axum/actix |
| **bracket-index** | `files[0]`, `files[1]` | **oRPC OpenAPI-хендлер**, PHP, Rails |
| **bracket-empty** | `files[]`, `files[]` | PHP/Rails (вариант) |

То есть Express/Nest/Fastify/Go/Rust схлопываются в одну конвенцию
(`repeat`) — они все на busboy/stdlib. Выпадает из ряда именно oRPC
(`bracket-index`). Для ОДНОГО файла вопрос не стоит — поле `file`, одна
часть, все согласны.

Важно: даже один oRPC внутри себя имеет два формата — RPC-протокол
(`@orpc/client`: всё в поле `"data"` + блобы под ключами `"0"`,`"1"`) и
OpenAPI-хендлер (`files[0]`). Мы ходим по **OpenAPI/REST** (плоские пути,
JSON-тела), поэтому релевантна `bracket-index`, что и подтверждает рабочий
воркэраунд в тесте (§1).

### 4.4 Конвенцию НЕЛЬЗЯ надёжно вытащить из swagger

В OpenAPI 3.x есть `encoding` (`style`/`explode`), который формально это
описывает, но генераторы (oRPC в т.ч.) для массивов бинарей его не эмитят.
Поэтому «угадать конвенцию» = самообман. Делаем её **явной настройкой**.

---

## 5. Принятые решения (согласовано с пользователем)

1. **Версия swagger:** только OpenAPI **3.1** (файл = `contentMediaType`).
   3.0/2.0 — задел, не реализуем сейчас (см. §8).
2. **Публичный API файла — union, но в 90% строка-пути:**
   ```ts
   type FileInput =
     | string                                            // путь: абсолютный или относительный (от process.cwd()); или file://-строка
     | URL                                               // file://-URL (бесплатно ложится на bany: new URL(..., import.meta.url))
     | { path: string; name?: string; type?: string }    // путь + переопределение имени/mime
     | { content: Uint8Array | ArrayBuffer; name: string; type?: string } // байты напрямую
     | Blob | File                                        // готовый web-объект (бесплатно для mode:'frontend')
   ```
   - Строка-путь: **абсолютный — как есть; относительный — от `process.cwd()`**.
     (Грабля: в тестах `cwd` нестабилен; для этого и есть `{ path }`/`File`/
     `{ content }`, чтобы резолвить самому, напр. из `import.meta.url`.)
   - `File`/`Blob` подключаются бесплатно (нужны для `mode:'frontend'` в браузере, где путей и `fs` нет).
3. **Один и несколько файлов** — оба, определяется из swagger
   (`file` vs `{type:array, items:file}`). Имя поля и количество у
   пользователя НЕ спрашиваем — берём из схемы.
4. **mime и name** — не обязательны: `name` = basename пути, `mime`
   выводим из расширения (нужно для серверного барьера `image/*`!),
   оба переопределяемы через `{ path, name, type }`.
5. **Кодировка формы** — настройка в конфиге, ставится ОДИН раз на проект,
   три встроенных + кастомная функция (escape hatch), без кода «на каждый
   фреймворк»:
   ```ts
   // EbelyConfig
   files?: {
     encoding?: 'repeat' | 'bracket-index' | 'bracket-empty'
              | ((args: { form: FormData; field: string; blobs: Blob[] }) => void)
   }
   ```
   - **DECISION TO CONFIRM — дефолт:** предлагается `'bracket-index'` —
     чтобы у основного потребителя (bany на oRPC) заработало из коробки.
     Альтернатива — `'repeat'` (веб-стандарт, охватывает busboy/Go/Rust),
     тогда oRPC-проекты явно ставят `'bracket-index'`. В доке указать оба.
   - Это **рантайм**-настройка (как `maxRetries`): читается в
     сгенерированном `request` из `ebely.files?.encoding`, перегенерация
     для смены не нужна.

---

## 6. План реализации (по файлам, с точками врезки)

Поток данных: «файловость» поля надо протащить и в ТИП (чтобы поле было
`FileInput`, а не `string`), и в РАНТАЙМ (чтобы `request` знал, какие поля
файловые, и собрал FormData нужной кодировкой). Делаем статический разбор
на этапе генерации + общий рантайм-хелпер.

### 6.1 Новый рантайм-модуль `src/files.ts` (ядро, в npm-пакете)

Чистый (path-reader через ленивый `import('node:fs/promises')`, чтобы
модуль не требовал Node при импорте во фронтенд-сборке). Тестируемый.

Экспортирует:

```ts
export type FileEncoding =
  | 'repeat' | 'bracket-index' | 'bracket-empty'
  | ((args: { form: FormData; field: string; blobs: Blob[] }) => void)

export type FileInput = /* см. §5.2 */

/** Плоское файловое поле тела: имя свойства + массив это или один файл. */
export type FileFieldMeta = { name: string; array: boolean }

/** FileInput → Blob. Путь читается через fs (Node); resolve от cwd. */
export async function toBlob(input: FileInput): Promise<Blob>

/**
 * Тело-объект + список файловых полей + кодировка → FormData.
 * Файловые поля кодируются по конвенции; остальные (скалярные) поля
 * добавляются как строки (объекты — через JSON.stringify).
 * Вызывается ПОСЛЕ before-хуков (тело к этому моменту — обычный объект).
 */
export async function toMultipartFormData(args: {
  body: Record<string, unknown>
  fileFields: FileFieldMeta[]
  encoding: FileEncoding
}): Promise<FormData>
```

Детали:
- `toBlob`:
  - `Blob`/`File` → как есть;
  - `{ content, name, type }` → `new File([content], name, { type: type ?? mimeFromName(name) })`;
  - `{ path, name?, type? }` или `string` → `await (await import('node:fs/promises')).readFile(resolve(process.cwd(), path))`,
    далее `new File([bytes], name ?? basename(path), { type: type ?? mimeFromExt(path) })`;
  - `URL` или `string` вида `file://...` — через `fileURLToPath` (бонус:
    bany уже строит пути от `import.meta.url` как `new URL(...)`).
- `mimeFromExt` — маленькая таблица (`jpg/jpeg→image/jpeg`, `png→image/png`,
  `gif`, `webp`, `svg`, `pdf`, `txt`, `json`, `csv`, `mp4`, `webm`, …),
  дефолт `application/octet-stream`.
- Кодировщики (для МАССИВА файлов в поле `field` с блобами `blobs`):
  - `repeat`: `for (b of blobs) form.append(field, b)`
  - `bracket-index`: `blobs.forEach((b,i) => form.append(`${field}[${i}]`, b))`
  - `bracket-empty`: `for (b of blobs) form.append(`${field}[]`, b)`
  - функция: вызвать её `({ form, field, blobs })`.
  Для ОДНОГО файла (`array:false`): всегда `form.append(field, blob)` (без
  скобок) — кодировка не важна.
- Скалярные (нефайловые) поля тела: `form.append(key, typeof v === 'object'
  ? JSON.stringify(v) : String(v))`. (Достаточно для типового случая;
  глубокую bracket-сериализацию вложенных объектов — в задел, см. §8.)

### 6.2 `src/generator/schema.ts` — файловый узел → тип `FileInput`

Добавить детектор и врезать в `schemaToType` ДО ветки `type: 'string'`:

```ts
export function isFileSchema(schema: Json): boolean {
  return schema?.type === 'string' && typeof schema?.contentMediaType === 'string'
  // (задел 3.0: || schema?.format === 'binary')
}
```

В `schemaToType`, в начале (после разворота `$ref`), если `isFileSchema` →
вернуть строку `'FileInput'`. Тогда `{ files: Array<FileInput> }`
получается автоматически и для вложенных случаев.

### 6.3 `src/generator/operations.ts` — распознать multipart и файловые поля

В тип `Operation` добавить:

```ts
isMultipart: boolean
/** Плоские файловые поля тела (для рантайм-сборки FormData). */
fileFields: { name: string; array: boolean }[]
```

В `collectOperations`:
- Источник схемы тела сделать «multipart-aware»:
  ```ts
  const content = op.requestBody?.content ?? {}
  const bodySchema =
    content['multipart/form-data']?.schema
    ?? content['application/json']?.schema
    ?? /* raw-body одиночный файл: */ firstFileContentSchema(content)
  ```
- `isMultipart` = есть `content['multipart/form-data']`, ИЛИ выбранная
  схема содержит файловый узел (обходом). Для oRPC верно по обоим.
- `fileFields` = обойти `bodySchema.properties` (top-level): для каждого
  свойства — если оно `isFileSchema` → `{name, array:false}`; если
  `type:array` и `items` `isFileSchema` → `{name, array:true}`.
  (Разворачивать `$ref` через `resolveRef`.)
- Раздел про raw-body (тело — сам файл, без объекта-обёртки): пометить
  спец-случаем (напр. `fileFields = [{name:'', array:false}]` или
  отдельный флаг `rawFileBody`) — слать один Blob телом, content-type =
  mime, без FormData. Вторичный кейс, но дешёвый.

### 6.4 `src/generator/render.ts` — типы, метаданные, ветка multipart

1. **Импорты** (`renderImports`, ~строка 104): добавить в value-импорт из
   `userStoreImport` функцию `toMultipartFormData`; добавить type-импорт
   `FileInput`, `FileEncoding`, `FileFieldMeta`. (`FileInput` нужен, т.к.
   `schemaToType` теперь его упоминает в сигнатурах.)

2. **Метаданные операций**: сгенерировать статическую карту по `opKey`:
   ```ts
   const FILE_OPS: Record<string, FileFieldMeta[]> = {
     "wordCard.wordCardUploadScreenshots": [{ name: "files", array: true }],
   }
   ```
   (Только для операций с `isMultipart && fileFields.length`.) `opKey` —
   это `"<группа>.<имя>"`, тот же ключ, что у хуков (`hookKey`).

3. **Ветка в `request`** (внутри `makeRequest`, в месте fetch, ~390–398):
   ПОСЛЕ `runBefore` (тело ещё обычный объект — это важно для хуков!):
   ```ts
   const fileFields = FILE_OPS[opKey]
   const isMultipart = fileFields !== undefined && hookReq.body !== undefined
   const encoding =
     (ebely as { files?: { encoding?: FileEncoding } }).files?.encoding ?? 'bracket-index'
   const form = isMultipart
     ? await toMultipartFormData({ body: hookReq.body as Record<string, unknown>, fileFields, encoding })
     : undefined

   const hasBody = hookReq.body !== undefined
   const response = await fetch(url, {
     method,
     headers: {
       // multipart: НЕ ставим content-type — fetch сам выставит boundary
       ...(isMultipart ? {} : hasBody ? { 'content-type': 'application/json' } : {}),
       ...hookReq.headers,
     },
     body: isMultipart ? form : hasBody ? JSON.stringify(hookReq.body) : undefined,
   })
   ```
   Хуки видят тело как объект (изменения из `before` подхватятся, т.к.
   FormData строится из `hookReq.body` уже после `runBefore`). На retry
   FormData пересоберётся заново — ок.

4. **mode:'frontend'**: ветка та же (request общий для обоих режимов),
   `FileInput` включает `File`/`Blob` — в браузере пользователь передаёт
   их, в Node-тестах — пути. Ничего особого не нужно.

### 6.5 `src/config.ts` — поле `files`

Добавить в `EbelyConfig` (рядом с `maxRetries`):

```ts
/**
 * Настройки отправки файлов (multipart). `encoding` задаёт, как кодируются
 * МАССИВЫ файлов в имена полей формы (для одного файла не важно):
 *  - 'repeat'        — files, files, …      (busboy: Express/Nest/Fastify, Go, Rust)
 *  - 'bracket-index' — files[0], files[1]   (oRPC OpenAPI, PHP, Rails) — ДЕФОЛТ
 *  - 'bracket-empty' — files[], files[]     (PHP/Rails вариант)
 *  - функция         — кастомная кодировка (escape hatch)
 * @default 'bracket-index'
 */
files?: { encoding?: FileEncoding }
```

(Импортировать `FileEncoding` из `./files`.)

### 6.6 `src/generate-client.ts` — ничего обязательного

`encoding` — рантайм-настройка (читается в `request` из `ebely`), на этапе
генерации не нужна. Дефолт живёт в коде `request` (`?? 'bracket-index'`).

### 6.7 `index.ts` — публичный экспорт

```ts
export { toMultipartFormData, toBlob } from './src/files'
export type { FileInput, FileEncoding, FileFieldMeta } from './src/files'
```

(`toMultipartFormData` нужен сгенерированному файлу как значение; типы —
для сигнатур.) После правок типов — `pnpm build` (примеры берут типы из
`dist/index.d.ts`).

---

## 7. Тесты и проверка

Юнит (`pnpm test`, чистые функции):
- `src/files.test.ts` — `toBlob` (из `{content}` и `Blob`; путь можно
  через временный файл), `mimeFromExt`, и три кодировщика в
  `toMultipartFormData`: проверять имена полей через
  `[...form.entries()].map(([k]) => k)` →
  `repeat`: `['files','files']`; `bracket-index`: `['files[0]','files[1]']`;
  `bracket-empty`: `['files[]','files[]']`; + смешанное тело (скаляр + файлы).
- `src/generator/schema.test.ts` — `isFileSchema`; `schemaToType` для
  3.1-файла → `'FileInput'`, для массива → `'Array<FileInput>'`.
- `src/generator/operations.test.ts` — на схеме как в §4.2: `isMultipart:true`,
  `fileFields:[{name:'files',array:true}]`; одиночный файл → `array:false`.
- `src/generator/render.test.ts` — в выводе есть `FILE_OPS`, ветка
  `isMultipart`, импорт `toMultipartFormData`/`FileInput`; снапшот формы
  метода с `FileInput`.

Интеграция (по желанию, для self-contained CI):
- Добавить multipart-эндпоинт в `examples/simple/your-app` (oRPC,
  `@orpc/zod` `file()`), пересобрать swagger (`pnpm --filter
  @ebely-examples/your-app run swagger`), скопировать в
  `test-with-ebely/swagger.json`, перегенерировать
  (`client:generate`), написать тест в `test-with-ebely/tests` с путём к
  файлу. `pnpm lint` должен проходить.

Документация:
- `ARCHITECTURE.md` — новый раздел «§9 Файлы / multipart» (детект 3.1,
  две точки врезки, `files.encoding`, конвенции).
- `CLAUDE.md` (корневой) — упомянуть `src/files.ts` в структуре.
- Пример `examples/simple/test-with-ebely/ebely/ebely.ts` — показать
  `files: { encoding: 'bracket-index' }` (или дефолт) в комментарии.

---

## 8. Явно НЕ делаем сейчас (задел на будущее)

- OpenAPI **3.0** (`format: binary`) и **2.0** (`in: formData, type: file`).
  Точки расширения: `isFileSchema` (добавить `format==='binary'`) и
  источник схемы тела в `operations.ts` (для 2.0 — `parameters` с
  `in: formData`, не `requestBody`).
- Глубокая bracket-сериализация ВЛОЖЕННЫХ объектов/массивов в смешанном
  теле (сейчас скаляры — `String()`, объекты — `JSON.stringify`). Хватает
  для типового кейса; полноценная сериализация (как у oRPC OpenAPI) — по
  необходимости.

---

## 9. Definition of Done

1. `pnpm test` / `pnpm lint` / `pnpm build` зелёные.
2. Сгенерированный метод для `files: z.array(file())` имеет тип
   `body: { files: Array<FileInput> }` и реально шлёт `multipart/form-data`.
3. В bany: поставить новую версию `ebely`, добавить в конфиг
   `files: { encoding: 'bracket-index' }` (если дефолт оставим иным),
   перегенерировать, заменить ручной `uploadScreenshots`/`readFile` в
   `inbox.test.ts` на:
   ```ts
   const upload = await user.wordCard.wordCardUploadScreenshots({
     body: { files: pictures.map((name) => new URL(`../data/screenshots/${name}`, import.meta.url)) },
   })
   upload.assert(200)
   ```
   (через `file://`-строку/`URL`, либо `{ path: fileURLToPath(...) }`) —
   тест проходит как раньше.
```
