Это библиотека eberly для создания типизированного клиента,
с помощью которого можно тестировать бэкэнд.

## Структура

Код библиотеки (попадает в npm-пакет, собирается в dist/):
- `index.ts` — публичный API (`BaseStore`, `ApiResponse`, `generateClient`, типы).
- `src/base-store.ts` — рантайм-ядро: базовый класс хранилища переменных.
- `src/response.ts` — рантайм-ядро: `ApiResponse` + чистая логика `assert`
  (используется сгенерированным клиентом в режиме `'test'`). Перегрузки
  `assert`: задекларированные статусы типизированы (и сужают `.body` до
  тела статуса), любой незадекларированный 4xx/5xx — без каста
  (`UndeclaredErrorStatus`). Тест типов —
  `src/response.type-test.ts` (`@ts-expect-error`, проверяет `pnpm lint`).
- `src/safety.ts` — рантайм-ядро: защита от прода. `isHostAllowed` /
  `assertHostAllowed` + `EberlyUnsafeHostError` (loopback всегда, остальное —
  из `allowedHosts`; вызывается сгенерированным клиентом только в `'test'`;
  `ARCHITECTURE.md §12`).
- `src/hooks.ts` — рантайм-ядро: `HookRegistry` + типы хуков `before` /
  `after` (чистый класс без сети; см. `ARCHITECTURE.md §7`).
- `src/files.ts` — рантайм-ядро: отправка файлов (multipart). `toBlob`,
  `toMultipartFormData`, типы `FileInput` / `FileEncoding` / `FileFieldMeta`
  (чистые функции, чтение пути через ленивый `node:fs`; `ARCHITECTURE.md §9`).
- `src/config.ts` — публичный тип `EberlyConfig` (+ `ClientMode`, `allowedHosts`).
- `src/generate-client.ts` — оркестратор: связывает шаги генератора и пишет файл.
- `src/generator/` — внутренности генератора (НЕ публичные):
  - `swagger.ts` — `SwaggerSource` + загрузка схемы (`loadSpec`): файл
    `.json`/`.yaml`/`.yml` или любой http(s)-URL.
  - `parse.ts` — `parseSpecText`: текст схемы → объект (`{` → JSON, иначе
    YAML через ленивый `import('yaml')`). Без `node:` — для браузера.
  - `version.ts` — `assertSupportedVersion`: 3.0/3.1 ок, Swagger 2.0 и
    прочее — ошибка.
  - `names.ts` — имена типов для `components/schemas` (`buildSchemaNames`,
    `toTypeName`), имена групп из тегов (`toGroupName`), списки
    зарезервированных имён.
  - `schema.ts` — JSON-Schema → строка TS-типа (`$ref` на схему → имя,
    `nullable` из 3.0) + блок `export type …` (`renderSchemaDecls`).
  - `operations.ts` — разбор `paths` в плоский список операций; группа —
    первый тег (фолбэки: префикс `operationId` → сегмент пути → `default`).
  - `render.ts` — рендер исходника клиента (класс `World`), форма зависит
    от `mode` (`'test'` / `'frontend'`). Типы вызовов — только в `WorldApi`
    (там же JSDoc эндпоинта: summary, description, маршрут, `@deprecated`).
  - `jsdoc.ts` — `renderJsDoc` / `escapeJsDoc`: общий рендер JSDoc для
    эндпоинтов, параметров и полей схем (`*/` → `*\/`).
  - `docs.ts` — папка `api/` для агента: `renderEndpointDocs` (`INDEX.md`
    + `<группа>.<метод>.md`), `renderExampleValue`, `DOCS_MARKER`.
  - `pipeline.ts` — `buildClient({ spec, mode, userStoreImport,
    configImport })` → `{ source, operations, docs }`: весь конвейер без IO
    (версия → имена → операции → рендер → `api/`). Его зовут
    `generateClient` и плейграунд сайта; `node:` не импортирует (сторож —
    тест в `pipeline.test.ts`).
  - `types.ts` — общий тип `Json`.
  - `test-utils.ts` — `makeSpec()` для юнит-тестов.

Юнит-тесты библиотеки: `src/**/*.test.ts` (чистые функции, без сети;
новый файл подхватывается glob-ом сам). Запуск — `pnpm test` в корне.
Тесты типов: `src/**/*.type-test.ts` — их проверяет `tsc` (`pnpm lint`).
Сообщения для пользователя (ошибки, логи, CLI) — на английском.

Подробный разбор архитектуры — в `ARCHITECTURE.md`.

`README.md` — на английском, витрина пакета (GitHub и npm): слоган,
ссылки на сайт / плейграунд / StackBlitz, «до и после», Quick start
(якорь `#quick-start`), список возможностей со ссылками на страницы
`eberly.dev`. TS-код в нём — из тестов, зелёных в `pnpm e2e` («до и после» —
`examples/nest/test-with-eberly/tests/readme.test.ts`, один в один).
Подробности — только на сайте (`site/`), код там — регионами из тестов.
Поменяли API или тест — сверьте README и страницы сайта; переименовали
страницу сайта — поправьте ссылки в README и `bin/eberly.mjs`.

Примеры (НЕ попадают в npm-пакет — `files: ["dist"]` + отдельный workspace,
`examples/*/*`, каждый `private: true`). `examples/simple` — это два
независимых проекта:

- `examples/simple/your-app` — тестируемое приложение (oRPC CRUD-бэкенд).
  От библиотеки `eberly` НЕ зависит.
  - Бэкенд: `your-app/src/{db,router,server}.ts`
  - Сборка swagger: `your-app/swagger/{openapi,generate-swagger}.ts`
  - Схема: `your-app/swagger/swagger.json`
- `examples/simple/test-with-eberly` — пример использования библиотеки.
  - Конфиг eberly: `test-with-eberly/eberly/eberly.ts`
  - Скрипт генерации: `test-with-eberly/eberly/generate-client.ts`
  - Переменные/сценарии юзера: `test-with-eberly/eberly/userStore.ts`
    (`UserStore`, `BaseStore<Vars, WorldApi>` + методы-сценарии вроде
    `fullRegister`, см. `ARCHITECTURE.md §8`)
  - Переменные/сценарии world: `test-with-eberly/eberly/worldStore.ts`
    (`WorldStore`; кладётся в конфиг как `worldStore`; даёт
    `world.clearDatabase()` и т.п.)
  - Хуки before/after: `test-with-eberly/eberly/hooks.ts` (типизированы,
    `Hooks<UserStore>`), переиспользуемые хендлеры — `eberly/handlers.ts`
  - Сгенерированный клиент: `test-with-eberly/eberly/generated.ts` (не редактировать)
  - Описания эндпоинтов для агента: `test-with-eberly/eberly/api/` (`INDEX.md`
    + файл на эндпоинт; генерируются вместе с клиентом, коммитятся)
  - Свагер бэкенда (копия из your-app): `test-with-eberly/swagger.json`
  - Пример тестов: `test-with-eberly/tests/test1.test.ts`

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

`examples/nest/test-with-eberly` — тесты Nest-бэкенда через eberly
(`@eberly-examples/nest-test-with-eberly`): `signUp` (register → login →
токен), `world.reset()`, Bearer в `globalBefore`, `lastPostId` в
`posts.create.after`. Тесты: `tests/{auth,posts,comments,avatar,readme}.test.ts`
(`readme.test.ts` — пример «до и после» из `README.md`, один в один, оба
блока: и eberly, и голый `fetch`);
`tests/types.ts` — тест типов на настоящем клиенте (`@ts-expect-error`,
проверяет `typecheck`, vitest его не запускает). Фикстура —
`tests/fixtures/avatar.png`.

Во всех `test-with-eberly`: `vitest.config.ts` с `fileParallelism: false`
(общая БД) и скрипт `typecheck` (`tsc --noEmit`).

CLI `bin/eberly.mjs` (`npx eberly create` / `skills`) и скиллы для Claude Code
`skills/{eberly-setup,eberly-write-tests}/SKILL.md` (на английском, <150
строк; `create` сам копирует их в `<dir>/.claude/skills/`). Попадают в
npm-пакет.

`clone/tests` — шаблон для `npx eberly create`. **Генерируется** из
`examples/simple/test-with-eberly` (`scripts/sync-template.ts`), в git не
лежит, руками не править.

`site/` — сайт eberly.dev (`@eberly-site/site`, `private: true`, в npm не
попадает): Astro + Starlight, только английский. Свой `tsconfig.json`
(корневой не расширяет).
  - `astro.config.mjs` — Starlight: заголовок, GitHub, сайдбар, скрипт
    Umami в `head`, свой `Footer`; React (`@astrojs/react`, для
    плейграунда); Vite-плагин, который роняет сборку, если в браузерный
    бандл попал `node:*`.
  - `src/content/docs/index.mdx` — лендинг (`template: splash`), в разделе
    «Try it» — плейграунд и кнопка «Open in StackBlitz».
  - `src/content/docs/playground.mdx` — плейграунд отдельной страницей.
  - `src/content/docs/**` — документация (разделы README по страницам).
  - `src/components/Playground.astro` — блок плейграунда для `.mdx`: на
    широком экране React-остров (`client:visible`), на узком — статичный
    `example.test.ts` (остров скрыт, Monaco не грузится).
  - `src/components/OpenInStackBlitz.astro` — кнопка «Open in StackBlitz»
    (лендинг и Getting started): весь репо из `main` + `?file=` на
    `nest/…/tests/readme.test.ts`.
  - `src/playground/` — плейграунд: `Playground.tsx` (остров, лениво
    грузит остальное), `Workbench.tsx` (UI: схема → `parseSpecText` +
    `buildClient` из `../../../src/generator/*` прямо в браузере),
    `monaco.ts` (Monaco и TS-воркер из npm, виртуальные файлы:
    `node_modules/eberly/index.d.ts` ← корневой `dist/index.d.ts`,
    `eberly/eberly.ts`, `eberly/generated.ts`, `tests/example.test.ts`),
    `compilerOptions.ts` (общие для Monaco и скрипта проверки).
  - `src/playground/example/` — пример по умолчанию: `example.yaml`
    (посты из Nest-схемы), `example.test.ts`, `eberly.ts` (скрытый
    конфиг), `vitest.d.ts` (заглушка `describe`/`test`). Исключены из
    `tsconfig` сайта — их проверяет `scripts/check-playground.ts`.
  - `src/lib/analytics.ts` — `track({ name })` → `umami.track`. В события —
    только имя, никогда схему или имя файла.
  - `src/components/Footer.astro` — футер Starlight + «Privacy-friendly
    analytics, no cookies» и событие `copy_install` (кнопка копирования
    команды установки). `open_stackblitz` — атрибут `data-umami-event` на
    кнопке.
  - `public/favicon.svg` — иконка.
  - `scripts/check-playground.ts` — генерирует клиент из `example.yaml` в
    `node_modules/.cache/eberly-playground/` и проверяет тест `tsc`-API.
    Первый шаг `build`: сломанный пример ломает сборку.
  - `src/lib/snippet.ts` — `snippet({ source, region })`: вырезает из текста
    файла регион `// #region docs:<имя>` … `// #endregion` и убирает отступ.
    Нет региона — ошибка сборки.
  - `src/styles/custom.css` — пока только акцентный цвет.

Деплой сайта: Cloudflare **Worker** `eberly` (только статика, кода нет) с
доменом `eberly.dev`, конфиг — `wrangler.jsonc` в корне (`assets.directory:
./site/dist`). Workers Builds собирает каждый пуш в `main`: build
`pnpm --filter @eberly-site/site build`, deploy `npx wrangler deploy`.
Аналитика — Umami Cloud (cloud.umami.is), `data-domains="eberly.dev"`:
с `localhost` и превью-URL не считается.

**Код в документации — только регионами из зелёных тестов/примеров**:
`import src from '…/x.test.ts?raw'` + `<Code code={snippet({ source: src,
region: '…' })} lang="ts" />`. Руками код в `.mdx` не копировать.
Регион `docs:*` в примерах — это API сайта: не удалять и не переименовывать,
не поправив `.mdx` (иначе упадёт сборка сайта). Комментарии внутри
регионов — на английском (они видны на сайте).

Скрипты репозитория (`scripts/`, проверяются `pnpm lint`):
- `e2e.ts` — `pnpm e2e` (см. ниже).
- `sync-template.ts` — пересобрать `clone/tests` из примера.
- `stackblitz.ts` — `pnpm stackblitz`: сборка библиотеки → Nest-бэкенд
  (`TEST_MODE=1`, `:3000`) → свагер с живого бэкенда → `client:generate` →
  vitest в watch-режиме. Стартовая команда StackBlitz.

`.stackblitzrc` (корень) — StackBlitz открывает весь репо
(`stackblitz.com/github/AlexConglomerate/eberly`): своя установка только
`eberly` + `examples/nest/*` (`installDependencies: false`), затем
`pnpm run stackblitz`. Проверка локально — `pnpm stackblitz` (порт `:3000`
свободен); в самом StackBlitz — только после пуша (ветку открыть
`…/eberly/tree/<ветка>`).

## Команды

В корне (библиотека): `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm release`.

`pnpm e2e` — сборка + шаблон, затем по очереди `simple`, `simple-auth`,
`nest`: свагер → бэкенд на `:3000` → `client:generate` → `typecheck` →
`test`; в конце смоук `eberly create`. Порт `:3000` должен быть свободен.
`pnpm e2e --only nest` — один пример. Перегенерированные `swagger.json`,
`generated.ts`, `eberly/api/` — коммитить.

`your-app` (`pnpm --filter @eberly-examples/your-app run <script>`):
- `start` / `dev` — поднять бэкенд (`:3000`).
- `swagger` — перегенерировать `swagger/swagger.json`.

`test-with-eberly` (`pnpm --filter @eberly-examples/test-with-eberly run <script>`):
- `client:generate` — сгенерировать клиент в `eberly/generated.ts` и
  описания эндпоинтов в `eberly/api/`.
- `typecheck` — `tsc --noEmit` по тестам (vitest типы не проверяет).
- `test` — запустить пример тестов (`tests/test1.test.ts`).

`nest/test-with-eberly` (`pnpm --filter @eberly-examples/nest-test-with-eberly run <script>`):
те же `client:generate`, `typecheck`, `test` (бэкенд — с `TEST_MODE=1`).

`site` (`pnpm --filter @eberly-site/site run <script>`):
- `dev` — сайт локально на `http://localhost:4321` (сначала `pnpm build`
  библиотеки: плейграунду нужен `dist/index.d.ts`).
- `build` — `pnpm build` библиотеки → `check:playground` → собрать в
  `site/dist/` (заодно проверяет, что все регионы `docs:*` на месте);
  `preview` — посмотреть сборку.
- `check:playground` — только проверка примера плейграунда.

В `dev` вместо плейграунда пусто, в консоли `_jsxDEV is not a function` —
в кэше Vite production-React: `astro dev stop`, `rm -rf site/node_modules/.vite`,
снова `dev`.

`nest/your-app` (`pnpm --filter @eberly-examples/nest-your-app run <script>`):
- `start` — собрать и поднять бэкенд (`:3000`; `TEST_MODE=1` включает
  `POST /test/reset`). Swagger UI — `/docs`, схема — `/swagger.json`.
- `swagger` — собрать и перегенерировать `swagger/swagger.json`.
