Это библиотека ebely для создания типизированного клиента,
с помощью которого можно тестировать бэкэнд.

## Структура

Код библиотеки (попадает в npm-пакет, собирается в dist/):
- `index.ts` — публичный API (`BaseStore`, `ApiResponse`, `generateClient`, типы).
- `src/base-store.ts` — рантайм-ядро: базовый класс хранилища переменных.
- `src/response.ts` — рантайм-ядро: `ApiResponse` + чистая логика `assert`
  (используется сгенерированным клиентом в режиме `'test'`).
- `src/hooks.ts` — рантайм-ядро: `HookRegistry` + типы хуков `before` /
  `after` (чистый класс без сети; см. `ARCHITECTURE.md §7`).
- `src/files.ts` — рантайм-ядро: отправка файлов (multipart). `toBlob`,
  `toMultipartFormData`, типы `FileInput` / `FileEncoding` / `FileFieldMeta`
  (чистые функции, чтение пути через ленивый `node:fs`; `ARCHITECTURE.md §9`).
- `src/config.ts` — публичный тип `EbelyConfig` (+ `ClientMode`).
- `src/generate-client.ts` — оркестратор: связывает шаги генератора и пишет файл.
- `src/generator/` — внутренности генератора (НЕ публичные):
  - `swagger.ts` — `SwaggerSource` + загрузка схемы (`loadSpec`).
  - `schema.ts` — JSON-Schema → строка TS-типа.
  - `operations.ts` — разбор `paths` в плоский список операций.
  - `render.ts` — рендер исходника клиента (класс `World`), форма зависит
    от `mode` (`'test'` / `'frontend'`).
  - `types.ts` — общий тип `Json`.

Юнит-тесты библиотеки: `src/*.test.ts`, `src/generator/*.test.ts`
(чистые функции, без сети). Запуск — `pnpm test` в корне.

Подробный разбор архитектуры — в `ARCHITECTURE.md`.

Примеры (НЕ попадают в npm-пакет — `files: ["dist"]` + отдельный workspace,
`examples/*/*`, каждый `private: true`). `examples/simple` — это два
независимых проекта:

- `examples/simple/your-app` — тестируемое приложение (oRPC CRUD-бэкенд).
  От библиотеки `ebely` НЕ зависит.
  - Бэкенд: `your-app/src/{db,router,server}.ts`
  - Сборка swagger: `your-app/swagger/{openapi,generate-swagger}.ts`
  - Схема: `your-app/swagger/swagger.json`
- `examples/simple/test-with-ebely` — пример использования библиотеки.
  - Конфиг ebely: `test-with-ebely/ebely/ebely.ts`
  - Скрипт генерации: `test-with-ebely/ebely/generate-client.ts`
  - Переменные/сценарии юзера: `test-with-ebely/ebely/userStore.ts`
    (`UserStore`, `BaseStore<Vars, WorldApi>` + методы-сценарии вроде
    `fullRegister`, см. `ARCHITECTURE.md §8`)
  - Переменные/сценарии world: `test-with-ebely/ebely/worldStore.ts`
    (`WorldStore`; кладётся в конфиг как `worldStore`; даёт
    `world.clearDatabase()` и т.п.)
  - Хуки before/after: `test-with-ebely/ebely/hooks.ts` (типизированы,
    `Hooks<UserStore>`), переиспользуемые хендлеры — `ebely/handlers.ts`
  - Сгенерированный клиент: `test-with-ebely/ebely/generated.ts` (не редактировать)
  - Свагер бэкенда (копия из your-app): `test-with-ebely/swagger.json`
  - Пример тестов: `test-with-ebely/tests/test1.ts`

`examples/nest/your-app` — второй тестируемый бэкенд, на NestJS (блог:
юзеры, посты-черновики, дерево комментариев, аватар). Источник «настоящего»
свагера: DTO в `components/schemas` + `$ref`, рекурсия (`CommentDto`),
OpenAPI **3.0** (`nullable`, `format: binary`), 201/204, ошибки 4xx с
`ErrorDto`, описания, `deprecated`. Данные в памяти.
  - ESM (`"type": "module"`, Nest 12 — ESM-only), собирается `tsc`, а не
    tsx: Nest нужен `emitDecoratorMetadata`. Свой `tsconfig.json`, корневой
    не расширяет.
  - Код: `src/{main,app.module,store,openapi,swagger}.ts` +
    `src/{auth,posts,comments,users,test,common}/`
  - `src/openapi.ts` — общая сборка документа (`operationIdFactory` →
    `posts.create`), её используют сервер и скрипт `swagger`.
  - `POST /test/reset` есть только при `TEST_MODE=1`; в `swagger.json`
    попадает (скрипт поднимает модуль с `testMode: true`).
  - Схема: `nest/your-app/swagger/swagger.json`

## Команды

В корне (библиотека): `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm release`.

`your-app` (`pnpm --filter @ebely-examples/your-app run <script>`):
- `start` / `dev` — поднять бэкенд (`:3000`).
- `swagger` — перегенерировать `swagger/swagger.json`.

`test-with-ebely` (`pnpm --filter @ebely-examples/test-with-ebely run <script>`):
- `client:generate` — сгенерировать клиент в `ebely/generated.ts`.
- `test` — запустить пример тестов (`tests/test1.ts`).

`nest/your-app` (`pnpm --filter @ebely-examples/nest-your-app run <script>`):
- `start` — собрать и поднять бэкенд (`:3000`; `TEST_MODE=1` включает
  `POST /test/reset`). Swagger UI — `/docs`, схема — `/swagger.json`.
- `swagger` — собрать и перегенерировать `swagger/swagger.json`.
