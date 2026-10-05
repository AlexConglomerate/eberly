# 01 — Бэкенд на NestJS (`examples/nest/your-app`)

> Самодостаточная задача. Общие решения, порядок и принципы тестов — в
> [README.md](README.md).

## Цель

Второй тестируемый бэкенд, на NestJS. Он нужен как источник «настоящего»
свагера, которого не даёт oRPC:

- DTO-классы → `components/schemas` и `$ref` (oRPC всё инлайнит: в обоих
  текущих примерах 0 схем в `components` и 0 `$ref`);
- рекурсивная схема (комментарии с ответами);
- OpenAPI **3.0** со своими `nullable: true` и `format: binary`;
- статусы 201 и 204, задекларированные ошибки 4xx с телом;
- summary/description, описания полей и параметров, `deprecated`.

На нём проверяются задачи 02–04, а e2e (05) гоняет по нему тесты. **В этой
задаче — только бэкенд и его `swagger.json`.** Тест-проект — в задаче 05.

## Проверенные факты

- Актуальные версии: `@nestjs/core@12.1.2`, `@nestjs/swagger@12.0.2`.
- `@nestjs/swagger` по умолчанию пишет `openapi: '3.0.0'`
  (`dist/swagger-module.js`). Есть `DocumentBuilder.setOpenAPIVersion()`,
  но дефолт **оставляем специально**: именно 3.0 получит любой Nest-проект.
- В опциях `SwaggerModule.createDocument` есть
  `operationIdFactory?: (controllerKey, methodKey, version?) => string`.
  Без неё operationId = `PostsController_create`.
- Nest опирается на `emitDecoratorMetadata`. tsx/esbuild этих метаданных
  **не генерирует** → ломаются DI по типу и вывод типов свойств в
  `@nestjs/swagger`. Поэтому бэкенд собираем `tsc` и запускаем `node`.
- Корневой `tsconfig.json` без `include`, поэтому `pnpm lint` в корне
  проверяет и файлы из `examples/` (сейчас 35 файлов). Декораторы
  параметров Nest (`@Body()`) под корневым конфигом не скомпилируются →
  корню нужен явный `include`.

## Решения

- Папка `examples/nest/your-app`, пакет `@ebely-examples/nest-your-app`.
  Glob `examples/*/*` в `pnpm-workspace.yaml` подхватит её сам.
- Данные в памяти (`Map`), без БД.
- `operationIdFactory: (c, m) => \`${c.replace(/Controller$/, '').toLowerCase()}.${m}\``
  → `posts.create`. Так в клиенте будут нормальные имена методов без
  эвристик в генераторе (нейминг — вне скоупа). В README это пойдёт
  рецептом для Nest.
- Тестовый режим: контроллер `POST /test/reset` подключается **только при
  `TEST_MODE=1`**. Живой пример «тестового режима бэкенда» для README.
- Валидация: `ValidationPipe` + `class-validator`, как в реальных
  Nest-проектах. Отсюда честные 400 с `message: string[]`.
- Авторизация: свой простейший bearer. Логин выдаёт случайный токен,
  `Map<token, userId>`, guard читает `Authorization: Bearer …` и кидает
  `UnauthorizedException`. Без passport/jwt — лишние зависимости.
- Порт `process.env.PORT ?? 3000`, как у остальных примеров.

## DTO (все через `@ApiProperty` с `description`)

| DTO | Поля | Что проверяет в ebely |
|-----|------|-----------------------|
| `RegisterDto`, `LoginDto` | `email`, `password` | тело запроса через `$ref` |
| `TokenDto` | `accessToken` | — |
| `UserDto` | `id`, `email`, `avatarUrl: string \| null` | `nullable` (3.0) |
| `CreatePostDto` | `title`, `content` | — |
| `PostDto` | `id`, `title`, `content`, `authorId`, `publishedAt: string \| null`, `createdAt` | `nullable` (3.0) |
| `CreateCommentDto` | `text`, `parentId?` | необязательное поле |
| `CommentDto` | `id`, `text`, `authorId`, `replies: CommentDto[]` | **рекурсия** (`@ApiProperty({ type: () => [CommentDto] })`) |
| `ErrorDto` | `statusCode`, `message: string \| string[]`, `error?` | `oneOf`; стандартное тело ошибки Nest |

## Эндпоинты

Ответы объявлять через `@ApiResponse` / `@ApiOkResponse` / … с `type`.
У каждого эндпоинта `@ApiOperation({ summary, description })`, и в
`description` записаны бизнес-правила (например, «удалить может только
автор, иначе 403»). Именно это потом прочитает агент.

| Тег | Метод и путь | Ответы | Зачем |
|-----|--------------|--------|-------|
| auth | `POST /auth/register` | 201 `UserDto`, 400, 409 `ErrorDto` | 201 по умолчанию у `@Post` |
| auth | `POST /auth/login` (`@HttpCode(200)`) | 200 `TokenDto`, 401 | 200 рядом с 201 |
| auth | `GET /auth/me` 🔒 | 200 `UserDto`, 401 | bearer |
| auth | `GET /auth/whoami` 🔒 | 200 `UserDto` | `deprecated: true` |
| posts | `GET /posts?authorId=` | 200 `PostDto[]` | query с описанием (`@ApiQuery`) |
| posts | `POST /posts` 🔒 | 201 `PostDto`, 400, 401 | — |
| posts | `GET /posts/:id` | 200 `PostDto`, 404 `ErrorDto` | path с описанием (`@ApiParam`) |
| posts | `POST /posts/:id/publish` 🔒 | 200 `PostDto`, 403, 404 | `publishedAt`: null → строка |
| posts | `DELETE /posts/:id` 🔒 (`@HttpCode(204)`) | 204 без тела, 403, 404 | пустое тело |
| comments | `POST /posts/:id/comments` 🔒 | 201 `CommentDto`, 404 | `parentId` → ответ на комментарий |
| comments | `GET /posts/:id/comments` | 200 `CommentDto[]` (дерево) | рекурсия в ответе |
| users | `POST /users/me/avatar` 🔒 multipart | 201 `UserDto` | `format: binary` (3.0) |
| test | `POST /test/reset` (только `TEST_MODE=1`) | 200 `{ ok: boolean }` | `world.reset()` |

🔒 — `@ApiBearerAuth()` + guard. Для аватара нужны `FileInterceptor('file')` +
`@ApiConsumes('multipart/form-data')` + `@ApiBody` со схемой
`{ file: { type: 'string', format: 'binary' } }`. `avatarUrl` можно
возвращать вида `/avatars/<userId>.<ext>`; сам файл хранить не нужно.

## Шаги

1. Корневой `tsconfig.json`: добавить `"include": ["index.ts", "src"]`.
   Убедиться, что `pnpm lint` зелёный и проверяет то же, что раньше
   (библиотеку), минус примеры.
2. `examples/nest/your-app/package.json`: зависимости `@nestjs/common`,
   `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`,
   `reflect-metadata`, `rxjs`, `class-validator`, `class-transformer`;
   dev — `typescript`, `@types/node`, `@types/multer`. Скрипты:
   - `build`: `tsc -p tsconfig.json`
   - `start`: `pnpm build && node dist/main.js`
   - `swagger`: `pnpm build && node dist/swagger.js`
3. Свой `tsconfig.json` (корневой **не** расширять): `experimentalDecorators`,
   `emitDecoratorMetadata`, `module: commonjs`, `target: es2022`,
   `outDir: dist`, `strict`, `strictPropertyInitialization: false` (DTO-классы).
4. `src/`: `main.ts`, `app.module.ts`, `store.ts` (in-memory), `auth/`,
   `posts/`, `comments/`, `users/`, `test/`, `swagger.ts`. Последний
   поднимает приложение через `NestFactory.create(AppModule, { logger: false })`,
   вызывает `createDocument` с `operationIdFactory`, пишет
   `swagger/swagger.json` и делает `app.close()`. Сборка документа (title,
   version, bearer auth, factory) — одна общая функция, её же использует
   `main.ts`, чтобы отдавать `/swagger.json` (и UI на `/docs`).
5. `pnpm --filter @ebely-examples/nest-your-app run swagger` → закоммитить
   `swagger/swagger.json`.
6. Разобрать выход и заполнить раздел ниже. Если что-то расходится с
   ожиданиями задачи 02 — поправить 02 **до** начала её работы.
7. `CLAUDE.md` проекта: добавить `examples/nest` в раздел «Структура» и
   команды `start` / `swagger`.

## Проверка

- `start` поднимает сервер на `:3000`. Руками через curl:
  register → login → create post → get post → delete (204).
- `swagger` пишет файл, раздел ниже заполнен.
- Текущий генератор на этом свагере **падает** (рекурсия). Это ожидаемо и
  чинится в 02. Зафиксировать как исходную точку.

## Что выдал Nest (заполнить после шага 6)

- [ ] версия `openapi`
- [ ] DTO лежат в `components/schemas`, ссылки через `$ref`
- [ ] форма nullable (`nullable: true`? рядом с `$ref` — через `allOf`?)
- [ ] файл: `type: string, format: binary`, content-type `multipart/form-data`
- [ ] рекурсия `CommentDto.replies` — `$ref` на себя
- [ ] `tags` и `operationId` (после `operationIdFactory`)
- [ ] 204 — есть ли `content` у ответа
- [ ] ошибки 4xx с `$ref` на `ErrorDto`
- [ ] `ErrorDto.message` — `oneOf`?
- [ ] summary / description / deprecated, описания полей и параметров
- [ ] `securitySchemes` и `security` на операциях
- [ ] сюрпризы
