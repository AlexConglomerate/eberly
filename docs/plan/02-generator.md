# 02 — Генератор: версии, именованные типы, рекурсия, теги

> Самодостаточная задача. Общие решения, порядок и принципы тестов — в
> [README.md](README.md). Зависит от 01 (Nest-свагер как реальная проверка).

## Цель

1. Понятная политика версий: 3.1 и 3.0 генерируем, Swagger 2.0 — понятная
   ошибка.
2. `components/schemas` → именованные типы, `$ref` → имя типа. Рекурсия
   чинится сама собой.
3. Каждый тип описан в сгенерированном файле один раз; IDE показывает
   JSDoc из одного места.
4. Группировка по `tags`.

## Как сейчас (проверено)

- `schemaToType` на `$ref` разворачивает схему инлайном. На
  `Comment.replies: Comment[]` получаем
  `RangeError: Maximum call stack size exceeded` (воспроизведено скриптом).
- Группа — префикс `operationId` до точки. У NestJS (`PostsController_create`)
  и FastAPI (`read_items_items_get`) всё уезжает в
  `default.PostsController_create`.
- Версия не проверяется. В 3.0 `nullable: true` игнорируется: поле станет
  не-null, и тест будет «врать». `format: binary` не считается файлом.
- Тип тела и ответа рендерится **трижды** на операцию: в `WorldApi`, в
  дереве хуков (`renderHookTreeType`) и в реализации (`renderMethod`: в
  возвращаемом типе и в касте). На 10 эндпоинтах `generated.ts` = 676 строк.
- JSDoc `summary` стоит только на реализации (`renderMethod`), в
  `WorldApi` его нет. Пользователь видит тип дерева, выведенный из
  реализации (`buildApiTree` без аннотации), а `this.api` в сторах — `WorldApi`.

## Решения

### Версии

| `spec` | Действие |
|--------|----------|
| `openapi: 3.1.x` | генерируем |
| `openapi: 3.0.x` | генерируем + `nullable: true` → `\| null`, `type: string, format: binary` → `FileInput` |
| `swagger: "2.0"` | `Error`: *"ebely supports OpenAPI 3.0 and 3.1, got Swagger 2.0. Convert the spec (e.g. with swagger2openapi) or switch your generator to OpenAPI 3."* |
| что-то ещё / нет поля | `Error` с найденным значением |

`format: byte` (base64-строка) — это **не** файл, остаётся `string`.

### Именованные типы

- Каждая схема из `components/schemas` → `export type <Имя> = <тип>` в
  отдельном блоке после импортов. Всегда `type`, а не `interface`: схема
  может быть union, enum, примитивом или `allOf`.
- `$ref: '#/components/schemas/X'` → просто имя `X`, без разворота. Любая
  рекурсия становится обычной рекурсией TypeScript.
- `$ref` в другие разделы (`components/responses`, `requestBodies`,
  `parameters`) по-прежнему разворачиваем через `resolveRef`: это обёртки,
  а не схемы-типы.
- Имя санитизируется в PascalCase-идентификатор: `post.create` →
  `PostCreate`, `Page<Post>` → `PagePost`, `user-dto` → `UserDto`. Если
  имя начинается с цифры — префикс `Schema`.
- Дедуп после санитизации — детерминированный, по порядку ключей в спеке:
  `PostCreate`, `PostCreate2`.
- **Зарезервированные имена → суффикс `Schema`** (`File` → `FileSchema`).
  Это всё, что сгенерированный файл сам объявляет или импортирует
  (`World`, `WorldApi`, `Hooks`, `CreateUserArgs`, `EbelyHookTree`,
  `RequestInput`, `RequestFn`, `ConfiguredWorldStore`, `WorldStoreBase`,
  `BaseStore`, `ApiResponse`, `HookRegistry`, `BeforeHook`, `AfterHook`,
  `RetryHook`, `FileInput`, `FileEncoding`, `FileFieldMeta`), плюс
  глобальные типы, которыми пользуется сам код (`Array`, `Record`,
  `Promise`, `Date`, `File`, `Blob`, `URL`, `Error`, `Response`, `Request`,
  `Map`, `Set`, `Object`, `String`, `Number`, `Boolean`). Схема `Array`
  без суффикса сломала бы каждый `Array<…>` в файле. Список — одна
  константа в `names.ts`.
- Таблица «ключ схемы → итоговое имя» строится один раз в начале
  генерации и передаётся в `schemaToType`.
- Инлайн-схемы (без `$ref`, как у oRPC) остаются инлайновыми. Синтез имён
  для них — вне скоупа.
- Пользователь может `import type { PostDto } from './generated'` в своих
  хелперах.

### Один источник типов

- `buildApiTree(request): WorldApi` — реализация типизируется контекстно
  из `WorldApi` и **не повторяет** литералы типов (внутри — `as never` /
  `as RequestInput`, где нужно).
- Тогда `createUser()` возвращает `Store & WorldApi`, и JSDoc (задача 03)
  достаточно писать только в `WorldApi`. Из `renderMethod` комментарий
  убираем.
- Дерево хуков пока рендерит типы само. С именованными типами там будут
  имена, у инлайн-схем — вторая копия вместо третьей. Этого достаточно.

### Теги

- Группа = **первый** тег → camelCase-идентификатор: `Posts` → `posts`,
  `User Management` → `userManagement`, `user-profile` → `userProfile`.
- Фолбэки, по порядку: нет тегов → префикс `operationId` до точки
  (нынешнее поведение; обратная совместимость с oRPC без тегов) → первый
  статический сегмент пути (`/posts/{id}` → `posts`) → `default`.
- Имя метода — **без изменений** (после первой точки; иначе `operationId`
  целиком; иначе `${method}${path}`). Нейминг — вне скоупа.
- **Зарезервированные имена групп → суффикс `Api`.** Группа становится
  свойством объекта пользователя (`Object.assign(store, tree)`) и дерева
  хуков. Поэтому тег `Store` затёр бы приватный `Map` в `BaseStore`, а
  `Get`/`Set` — методы стора, и всё сломалось бы молча в рантайме.
  Список: `get`, `set`, `api`, `store`, `globalBefore`, `globalAfter`,
  `globalRetry`, `constructor`, `__proto__`.
- Ломающее изменение: у кого теги не совпадают с префиксом `operationId`,
  поменяются группы → minor-версия и запись в CHANGELOG.

## Где править

| Файл | Что |
|------|-----|
| `src/generator/version.ts` (новый) | `assertSupportedVersion({ spec })` |
| `src/generator/names.ts` (новый) | `toTypeName`, `toGroupName`, `buildSchemaNames({ spec })` → `Map`, оба списка зарезервированных имён |
| `src/generator/schema.ts` | `$ref` на схему → имя; `nullable`; `format: binary` в `isFileSchema`; новый аргумент `names` у `schemaToType`; `renderSchemaDecls({ spec, names })` — блок `export type …` |
| `src/generator/operations.ts` | группа из тегов + фолбэки + зарезервированные; пробросить `names` |
| `src/generator/render.ts` | блок объявлений; `buildApiTree(): WorldApi`; убрать дубли типов и JSDoc из `renderMethod` |
| `src/generate-client.ts` | `assertSupportedVersion` сразу после `loadSpec`; построить `names` |
| `package.json` | `"test": "tsx --test 'src/**/*.test.ts'"` (Node 22 сам раскрывает glob) |
| `ARCHITECTURE.md`, `CLAUDE.md` | раздел про именованные типы и группы; новые файлы в структуре |
| `.changeset/*` | minor |

`collectFileFields` по-прежнему делает `deref`: ему нужна структура схемы,
а не имя.

## Тесты

Мини-спеки строятся хелпером `src/generator/test-utils.ts`:
`makeSpec({ openapi?, schemas?, paths? })`. Имя файла не подпадает под
glob `*.test.ts`.

- `version.test.ts`: 3.1 ок; 3.0 ок; 2.0 → ошибка, в тексте есть «2.0»;
  без поля → ошибка.
- `names.test.ts`: санитизация (`post.create`, `Page<Post>`, `user-dto`,
  `1st`); `File` → `FileSchema`; `Array` → `ArraySchema`; дедуп
  детерминирован; группы `Posts`/`User Management`/`user-profile`;
  группа `store` → `storeApi`.
- `schema.test.ts`:
  - `$ref` → имя;
  - **рекурсивная схема рендерится без исключения** (воспроизведение бага);
  - `nullable: true` (3.0) → `string | null`;
  - `format: binary` → `FileInput`, `format: byte` → `string`;
  - 3.1 `type: ['string', 'null']` работает как раньше.
- `operations.test.ts`: тег → группа; несколько тегов → первый; без
  тегов + `operationId` с точкой → старое поведение; без тегов и без
  точки → сегмент пути; `/` → `default`; бинарное поле (3.0) → `isMultipart`.
- `render.test.ts`: `export type PostDto =` ровно один раз; `WorldApi`
  ссылается на `PostDto`; есть `buildApiTree(request: RequestFn): WorldApi`;
  литерал типа тела не повторяется в реализации.

Реальная проверка — в 05 (`pnpm e2e`): клиент для Nest компилируется
`tsc`, тесты зелёные; клиенты oRPC-примеров перегенерированы и тоже зелёные.
До появления 05 — руками: сгенерировать клиент из Nest-свагера во
временную папку и прогнать `tsc`.

## Готово когда

- `pnpm test` и `pnpm lint` зелёные;
- генератор на Nest-свагере не падает, клиент компилируется;
- oRPC-примеры перегенерированы, их тесты проходят, группы не поменялись
  (у них теги `Posts`/`Auth` совпадают с префиксом `operationId`).
