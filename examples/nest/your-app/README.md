# nest/your-app

Игрушечный блог-бэкенд на NestJS, который мы тестируем. Данные в памяти.
К библиотеке `ebely` отношения не имеет и от неё не зависит.

Нужен как источник «настоящего» свагера, которого не даёт oRPC: DTO в
`components/schemas` и `$ref`, рекурсивная схема (`CommentDto.replies`),
OpenAPI 3.0 (`nullable: true`, `format: binary`), статусы 201/204,
задекларированные ошибки 4xx с телом, описания и `deprecated`.

Помечен `private: true`, поэтому **не попадает** в npm-пакет библиотеки.

## Запуск

Из корня репозитория установите зависимости (`pnpm install`).

```bash
pnpm --filter @ebely-examples/nest-your-app run start             # бэкенд на :3000
TEST_MODE=1 pnpm --filter @ebely-examples/nest-your-app run start # + POST /test/reset
pnpm --filter @ebely-examples/nest-your-app run swagger           # перегенерировать swagger/swagger.json
```

- `http://localhost:3000/docs` — Swagger UI
- `http://localhost:3000/swagger.json` — OpenAPI-схема

Собирается `tsc` (а не tsx): Nest опирается на `emitDecoratorMetadata`,
которых esbuild не генерирует. Пакеты Nest 12 — ESM-only, поэтому и
приложение ESM.

## Эндпоинты

| Метод и путь | Доступ | Что делает |
|--------------|--------|------------|
| `POST /auth/register` | — | регистрация, 201 / 400 / 409 |
| `POST /auth/login` | — | токен + юзер, 200 / 401 |
| `GET /auth/me` | bearer | текущий юзер |
| `GET /auth/whoami` | bearer | то же, `deprecated` |
| `GET /posts?authorId=` | — | опубликованные посты |
| `POST /posts` | bearer | создать черновик, 201 |
| `GET /posts/:id` | — | любой пост, 404 |
| `POST /posts/:id/publish` | bearer, автор | опубликовать, 403 / 404 |
| `DELETE /posts/:id` | bearer, автор | удалить, 204 / 403 / 404 |
| `POST /posts/:id/comments` | bearer | комментарий или ответ (`parentId`) |
| `GET /posts/:id/comments` | — | дерево комментариев |
| `POST /users/me/avatar` | bearer | multipart, поле `file` |
| `POST /test/reset` | только `TEST_MODE=1` | очистить все данные |

Бизнес-правила записаны в `description` каждой операции в свагере.

## Что где

- `src/store.ts` — «база данных» в памяти (+ `reset()`).
- `src/auth/` — регистрация/логин, `AuthGuard` (простой bearer: токен →
  юзер в `Map`), декораторы `@Auth()` и `@CurrentUser()`.
- `src/posts/`, `src/comments/`, `src/users/` — контроллеры и DTO.
- `src/test/` — `POST /test/reset`, подключается только в тестовом режиме.
- `src/common/error.dto.ts` — стандартное тело ошибки Nest.
- `src/app.module.ts` — `AppModule.register({ testMode })`.
- `src/openapi.ts` — сборка OpenAPI-документа (общая для сервера и скрипта).
- `src/main.ts` — HTTP-сервер.
- `src/swagger.ts` — пишет схему в `swagger/swagger.json`.
