Это библиотека ebely для создания типизированного клиента,
с помощью которого можно тестировать бэкэнд.

## Структура

Код библиотеки (попадает в npm-пакет, собирается в dist/):
- `index.ts` — публичный API (`InternalStore`, `ApiResponse`, `generateClient`, типы).
- `src/internal-store.ts` — рантайм-ядро: базовый класс хранилища переменных.
- `src/response.ts` — рантайм-ядро: `ApiResponse` + чистая логика `assert`
  (используется сгенерированным клиентом в режиме `'test'`).
- `src/hooks.ts` — рантайм-ядро: `HookRegistry` + типы хуков `before` /
  `after` (чистый класс без сети; см. `ARCHITECTURE.md §7`).
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
  - Пользовательские переменные: `test-with-ebely/ebely/internalVariable.ts`
  - Хуки before/after: `test-with-ebely/ebely/hooks.ts` (типизированы,
    `Hooks<AppStore>`), переиспользуемые хендлеры — `ebely/handlers.ts`
  - Сгенерированный клиент: `test-with-ebely/ebely/generated.ts` (не редактировать)
  - Свагер бэкенда (копия из your-app): `test-with-ebely/swagger.json`
  - Пример тестов: `test-with-ebely/tests/test1.ts`

## Команды

В корне (библиотека): `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm release`.

`your-app` (`pnpm --filter @ebely-examples/your-app run <script>`):
- `start` / `dev` — поднять бэкенд (`:3000`).
- `swagger` — перегенерировать `swagger/swagger.json`.

`test-with-ebely` (`pnpm --filter @ebely-examples/test-with-ebely run <script>`):
- `client:generate` — сгенерировать клиент в `ebely/generated.ts`.
- `test` — запустить пример тестов (`tests/test1.ts`).
