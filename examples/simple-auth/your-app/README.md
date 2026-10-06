# auth-your-app

Игрушечное приложение, которое мы тестируем. Демонстрирует интеграцию
[BetterAuth](https://www.better-auth.com/) с oRPC-бэкендом и SQLite:

- email+пароль регистрация/логин (BetterAuth),
- bearer-токены через плагин `bearer`,
- доп. поле `role` (`user` / `admin`),
- CRUD постов с проверкой ролей (удалять может только admin, править — автор или admin),
- **фейковый Google OAuth-провайдер**: локальный IdP под `/fake-google/*`, через
  который BetterAuth честно делает authorize → token → userinfo (без реальных ключей).

К библиотеке `eberly` НЕ имеет отношения и от неё не зависит. `private: true` +
pnpm workspace ⇒ в npm-пакет eberly не попадает.

## Запуск

```bash
pnpm --filter @eberly-examples/auth-your-app run start    # бэкенд на :3000
pnpm --filter @eberly-examples/auth-your-app run dev      # то же, в watch
pnpm --filter @eberly-examples/auth-your-app run swagger  # перегенерировать swagger.json
```

- `http://localhost:3000/api/...`  — API
- `http://localhost:3000/swagger.json` — OpenAPI
- `http://localhost:3000/docs` — Scalar UI

База: `./.data/app.sqlite` (gitignored). Миграции BetterAuth запускаются
автоматически при старте (`initDatabase()`).

## Что где

- `src/auth.ts` — конфиг и инстанс BetterAuth (email+пароль, bearer, genericOAuth).
- `src/sqlite.ts` — better-sqlite3 connection.
- `src/db.ts` — миграции BetterAuth + таблица `post` + админ-helpers.
- `src/fake-google.ts` — локальный фейковый OAuth2-IdP.
- `src/oauth-flow.ts` — серверная оркестрация всего OAuth-флоу одной функцией.
- `src/router.ts` — oRPC-роутер (auth / posts / admin).
- `src/server.ts` — HTTP-сервер.
- `swagger/openapi.ts`, `swagger/generate-swagger.ts` — генерация OpenAPI.

## Уровни доступа

| Endpoint                       | Доступ                          |
|--------------------------------|---------------------------------|
| `POST /auth/sign-up`           | публичный                       |
| `POST /auth/sign-in`           | публичный                       |
| `POST /auth/oauth/google/login`| публичный                       |
| `GET  /auth/session`           | bearer (любой user)             |
| `POST /auth/sign-out`          | bearer (любой user)             |
| `GET  /posts`, `/posts/{postId}`   | bearer (любой user)             |
| `POST /posts`                  | bearer (любой user)             |
| `PATCH /posts/{postId}`            | bearer (автор поста ИЛИ admin)  |
| `DELETE /posts/{postId}`           | bearer (только admin)           |
| `POST /admin/clear-database`   | публичный (тест-хелпер)         |
| `POST /admin/promote`          | публичный (тест-хелпер)         |
