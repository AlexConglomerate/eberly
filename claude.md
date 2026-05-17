Это библиотека ebely для создания типизированного клиента,
с помощью которого можно тестировать бэкэнд.

## Структура

Код библиотеки (попадает в npm-пакет, собирается в dist/):
- `index.ts` — публичный API (`InternalStore`, `generateClient`).
- `src/internal-store.ts` — ядро: базовый класс хранилища переменных.
- `src/generate-client.ts` — генератор типизированного клиента из swagger.

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
  - Сгенерированный клиент: `test-with-ebely/ebely/world.ts` (не редактировать)
  - Свагер бэкенда (копия из your-app): `test-with-ebely/swagger.json`
  - Пример тестов: `test-with-ebely/tests/test1.ts`

## Команды

В корне (библиотека): `pnpm build`, `pnpm lint`, `pnpm release`.

`your-app` (`pnpm --filter @ebely-examples/your-app run <script>`):
- `start` / `dev` — поднять бэкенд (`:3000`).
- `swagger` — перегенерировать `swagger/swagger.json`.

`test-with-ebely` (`pnpm --filter @ebely-examples/test-with-ebely run <script>`):
- `client:generate` — сгенерировать клиент в `ebely/world.ts`.
- `test` — запустить пример тестов (`tests/test1.ts`).
