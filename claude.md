Это библиотека ebely для создания типизированного клиента,
с помощью которого можно тестировать бэкэнд.

## Структура

Код библиотеки (попадает в npm-пакет, собирается в dist/):
- `index.ts` — публичный API (`InternalStore`, `generateClient`).
- `src/internal-store.ts` — ядро: базовый класс хранилища переменных.
- `src/generate-client.ts` — генератор типизированного клиента из swagger.

Примеры (НЕ попадают в npm-пакет — `files: ["dist"]` + отдельный workspace,
`examples/*`, каждый `private: true`):
- `examples/simple` — самостоятельный проект-пример.
  - Тестовый бэкенд: `examples/simple/test-backend`
  - Схема бэкенда: `examples/simple/test-backend/swagger.json`
  - Конфиг ebely: `examples/simple/src/ebely.ts`
  - Сгенерированный клиент: `examples/simple/src/world.ts`
  - Пример того, как должны выглядеть тесты: `examples/simple/src/index.ts`

## Команды

В корне (библиотека): `pnpm build`, `pnpm lint`, `pnpm release`.

В `examples/simple` (`pnpm --filter @ebely-examples/simple run <script>`):
- `client:generate` — генерирует типизированный клиент в `src/world.ts`.
- `backend:dev` / `backend:start` — поднять тестовый бэкенд.
- `backend:swagger` — перегенерировать `test-backend/swagger.json`.
- `start` — запустить пример (`src/index.ts`).
