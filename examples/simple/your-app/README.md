# your-app

Игрушечное приложение, которое мы тестируем. Может быть написано на любом
языке — здесь это простой CRUD-бэкенд для постов на oRPC, данные хранятся
в памяти. К библиотеке `ebely` не имеет никакого отношения и от неё не зависит.

Помечен `private: true` и вынесен в pnpm workspace, поэтому **не попадает**
в публикуемый npm-пакет библиотеки.

## Запуск

Из корня репозитория установите зависимости (`pnpm install`).

```bash
pnpm --filter @ebely-examples/your-app run start    # бэкенд на :3000
pnpm --filter @ebely-examples/your-app run dev      # то же, в watch-режиме
pnpm --filter @ebely-examples/your-app run swagger  # перегенерировать swagger/swagger.json
```

- `http://localhost:3000/api/posts` — API
- `http://localhost:3000/swagger.json` — OpenAPI-схема
- `http://localhost:3000/docs` — документация (Scalar UI)

## Что где

- `src/db.ts` — «база данных» в памяти.
- `src/router.ts` — oRPC-роутер с CRUD-эндпоинтами.
- `src/server.ts` — HTTP-сервер.
- `swagger/openapi.ts` — сборка OpenAPI-схемы из роутера.
- `swagger/generate-swagger.ts` — пишет схему в `swagger/swagger.json`.
- `swagger/swagger.json` — сгенерированная схема (отдаётся тестам в `test-with-ebely`).
