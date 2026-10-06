# HANDOFF — заметки между задачами

Правила — в [README.md](README.md#handoffmd--переписка-между-агентами).
Коротко: читать перед стартом, дописывать в конец после задачи,
старые записи не править.

Формат записи:

```
## <дата> — <номер задачи>
- Нашёл / пошло не по плану: …
- Следующему: …
- Поправил файлы плана: … (или «нет»)
```

---

## 2026-10-06 — план (обсуждение)

- Ядро генератора чистое: `node:` импортируют только `src/generate-client.ts`
  и `src/generator/swagger.ts`. Всё остальное (`version`, `names`,
  `operations`, `render`, `schema`, `docs`) можно бандлить в браузер.
- `generated.ts` импортирует `"eberly"` (рантайм + типы) и `{ eberly } from "./eberly"`
  (конфиг: от него зависят типы `userStore` / `worldStore`). В Monaco нужны оба
  виртуальных модуля — см. 03.
- `dist/index.d.ts` — один бандл без `node:`-типов (есть только `ArrayBuffer` /
  `Uint8Array`), годится как `addExtraLib` для Monaco. Появляется после `pnpm build`.
- В `generated.ts` Nest-примера 44 строки по-русски (шапка и JSDoc из
  `render.ts`). На английском сайте это видно в плейграунде и в подсказках при
  наведении — поэтому задача 02. `eberly/api/*.md` уже на английском.
- CI (`.github/workflows/main.yml`, `publish.yml`) — Node 16 и pnpm 7, а
  `pnpm-lock.yaml` — `lockfileVersion: '9.0'`. Astro на Node 16 не работает,
  и `--frozen-lockfile` на pnpm 7 с lockfile v9, скорее всего, уже падает. Чинится в 05.
- Примеры зависят от `eberly: workspace:*` — подпапку `examples/nest` нельзя
  просто открыть в StackBlitz отдельно, см. 04.
- `bin/eberly.mjs:144` ссылается на `github.com/…/eberly#quick-start` — при
  сокращении README (06) якорь должен остаться или ссылка — смениться.
- Домен `eberly.dev` на 2026-10-06 свободен (RDAP реестра `.dev` — 404).

## 2026-10-06 — NEXT-yaml-spec

- Нашёл / пошло не по плану: `parseSpecText` **готов**, но лежит не в
  `swagger.ts`, а в новом `src/generator/parse.ts` — `swagger.ts`
  импортирует `node:fs` / `node:path`, а `parse.ts` без `node:`, его можно
  бандлить в браузер. Сигнатура: `parseSpecText({ text, source }):
  Promise<Json>` — **async** (YAML-парсер грузится лениво,
  `await import('yaml')`). `{` после `trim()` → `JSON.parse`, иначе YAML;
  битый текст / скаляр / массив / пустой текст — `Error` с сообщением
  `eberly: failed to parse the OpenAPI spec from <source> as JSON or YAML: …`.
  `yaml` — первая рантайм-зависимость (`dependencies`, `^2.9.1`), tsup её не
  бандлит. Тесты — `src/generator/swagger.test.ts`, типы —
  `swagger.type-test.ts`. `pnpm test` / `lint` / `e2e` зелёные. Пример на
  YAML-схему (пункт «по желанию») не переводил: `examples/simple` — это
  шаблон `eberly create`, YAML там сменил бы схему у всех новых проектов.
- Следующему (03): импортировать `../../src/generator/parse` и `await
  parseSpecText({ text, source: 'editor' })`; сообщение ошибки можно
  показывать как есть. `yaml` резолвится из корневого `node_modules` (импорт
  идёт из `src/`), отдельно ставить в `site/` не нужно — но если Vite
  не найдёт, добавить `yaml` в `site/package.json`. В README рецепт Nest
  теперь `swagger: { url: 'http://localhost:3000/docs-json' }` без
  `jsonDocumentUrl`; сам Nest-пример всё ещё отдаёт `/swagger.json` — это
  не мешает.
- Поправил файлы плана: нет.

## 2026-10-06 — 01

- Нашёл / пошло не по плану:
  - Версии: `astro@7.3.5`, `@astrojs/starlight@0.42.5` (Node ≥ 22.12 — в CI
    для 05 нужен Node 22+). В Starlight ≥ 0.39 группа сайдбара с
    `autogenerate` пишется как `{ label, items: [{ autogenerate: … }] }`.
    Предупреждения сборки `collection "i18n" … empty` и `Entry docs → 404
    was not found` — штатные, на сборку не влияют.
  - Комментарии в примерах — по-русски, а регион показывается на сайте
    целиком. Поэтому комментарии **внутри** регионов перевёл на английский
    (русские вынес над регионом). `examples/simple` (шаблон `create`) не
    трогал — регионов в нём нет.
  - Блок «Before» (голый `fetch`) не был тестом — добавил его в
    `nest/…/tests/readme.test.ts` вторым тестом один в один с README
    (`beforeAll` → `beforeEach` с `reset()`, оба регистрируют `alice@…`).
    Строки сдвинулись, в README поправил `readme.test.ts(18,53)` →
    `(20,53)` в разделе про сломанный контракт.
  - Регионы: `readme-before`, `readme-after` (readme.test), `last-post-id`
    (posts.test), `tree` (comments.test), `avatar-path`, `avatar-upload`
    (avatar.test), `save-id` (nest hooks), `config` (nest eberly.ts),
    `user-store` (nest userStore.ts), `vitest-config` (nest vitest.config),
    `test-mode` (nest your-app main.ts и app.module.ts), `operation-id`
    (openapi.ts), `global-before`, `global-retry` (simple-auth hooks),
    `refresh` (refresh.test). `api/INDEX.md` показан целиком через `?raw`.
  - **Кода без теста, оставлен в `.mdx` руками** (как в README): шелл-команды
    (quick start), вывод `tsc` про сломанный контракт (`guides/contract-changes`),
    `files: { encoding: 'bracket-index' }` (oRPC), конфиг с `allowedHosts`
    и цикл `as const` (`gotchas`), шпаргалка API (`reference/api`). Если
    нужно строго — завести под них тест/тест типов (например, в
    `nest/…/tests/types.ts`) и перевести на регионы.
- Следующему:
  - 03: место в лендинге — комментарий `PLAYGROUND` в
    `site/src/content/docs/index.mdx` (раздел «Try it» с `<Aside>` «Coming
    soon» — заменить). `@astrojs/react` ещё не подключён.
  - 04: место под кнопку — комментарий `STACKBLITZ` там же; в Getting
    started места нет, добавить рядом с «By hand».
  - 05: `site: 'https://eberly.dev'` уже в `astro.config.mjs` (sitemap
    генерируется). Ссылки на код — `github.com/AlexConglomerate/eberly/blob/main/…`.
  - 06: страницы для ссылок из README: `/getting-started/`,
    `/guides/<auth-and-token-refresh|save-ids-with-hooks|recursive-comments|file-upload|contract-changes|ai-agents>/`,
    `/backend-requirements/`, `/gotchas/`, `/reference/config/`,
    `/reference/api/`, `/roadmap/`.
- Поправил файлы плана: нет.

## 2026-10-06 — 02

- Нашёл / пошло не по плану: выводимый русский текст был **только** в
  шаблоне `src/generator/render.ts`; `docs.ts` и `jsdoc.ts` в вывод
  кириллицу не пишут (у них по-русски лишь комментарии к исходнику).
  Тестов на русские фразы вывода не было. Из JSDoc `World` убрана ссылка
  на `ARCHITECTURE.md §8` — у пользователя пакета такого файла нет.
  В `simple-auth/…/generated.ts` и `api/` кириллица осталась — это
  `summary` из самой схемы примера, не генератор. Пункта про английский в
  `generated.ts` в `ROADMAP.md` нет.
- Следующему (03): весь текст от генератора в `generated.ts` теперь
  английский; русский может прийти только из описаний в схеме пользователя.
- Поправил файлы плана: нет.

## 2026-10-06 — 03

- Нашёл / пошло не по плану:
  - **Вес.** Лендинг до плейграунда — 46 KB gzip (181 KB raw). Плейграунд
    (грузится только когда блок виден) — ещё **~2.7 MB gzip** (11.4 MB raw,
    15 файлов): TS-воркер 1.46 MB, ядро Monaco ~1 MB, React 64 KB, наш
    `Workbench` с генератором 46 KB. В `dist/_astro` 14 MB: Vite кладёт
    туда и воркеры css/html/json, и чанки всех языков подсветки — они не
    грузятся, пока не нужны. Ужать можно, импортируя не `monaco-editor`
    целиком, а `editor.api` + нужные contrib-ы.
  - **Телефон.** Ниже `50rem` остров скрыт CSS (`display: none` никогда не
    «visible» → `client:visible` не срабатывает, Monaco не качается), вместо
    него — статичный `example.test.ts` через `<Code>` и текст «open on a
    desktop». Проверено: на 390px запросов к Monaco нет, горизонтального
    скролла нет.
  - Пример лежит в `site/src/playground/example/` (`example.yaml`,
    `example.test.ts`, скрытый `eberly.ts`, `vitest.d.ts`), а не прямо в
    `src/playground/`: папка исключена из `tsconfig` сайта (`./generated`
    там есть только в виртуальном проекте). `vitest` — заглушка
    `describe`/`test` в `vitest.d.ts`, тест выглядит как настоящий.
  - Monaco 0.57: TS — в **верхнеуровневом** `monaco.typescript`
    (`monaco.languages.typescript` — заглушка `{ deprecated: true }`),
    Bundler-резолюция работает (внутри TS 5.9). Два подвоха: (1) воркер
    перепроверяет модель, только когда меняется **её** текст — после
    перегенерации `generated.ts` тест не краснел бы; лечится сменой
    extra-lib (`setGeneratedSource` в `monaco.ts`), `setCompilerOptions`
    не годится — перезапускает воркер; (2) `onDidChangeMarkers` не стреляет
    при переходе «не проверено → 0 ошибок», поэтому счётчик спрашивает
    воркер напрямую (`countTestErrors`).
  - `check-playground.ts` под `tsx` из `site/` (ESM) получает `src/` корня
    как CJS: именованные экспорты лежат в `default` — там маленький `load()`.
  - **Баг библиотеки (не чинил — поменял бы `generated.ts` примеров):**
    `class UserStore extends BaseStore<{ n: number }> {}` без собственных
    членов, как и `userStore: BaseStore`, даёт в `generated.ts` TS2344 на
    `Store extends BaseStore = InstanceType<typeof eberly.userStore>`
    (дефолт `Vars` = `Record<string, never>`). С любым своим методом
    ошибка пропадает — поэтому примеры её не ловят. Вероятный фикс в
    `render.ts`: `Store extends BaseStore<any, any>`.
  - **Ещё баг генератора:** `parameters` на уровне path item
    (`/posts/{id}: { parameters: [...] }`, разрешено OpenAPI) игнорируются —
    `collectOperations` читает только `op.parameters`. В `example.yaml`
    параметры поэтому внутри операций.
  - `astro dev` в Astro 7 — демон, один на проект («Dev server already
    running», `astro dev stop|status|logs`). Новую страницу в
    `content/docs` уже запущенный сервер не увидел — помог перезапуск.
  - Chrome-расширение не было подключено: проверял `playwright-core` с
    системным Chrome (скрипты в скретчпаде, в репо не попали).
  - `favicon.svg` отдаёт 404 (в `site/public/` его нет) — было и до 03.
  - **Пустое место вместо плейграунда в `dev`** и в консоли
    `_jsxDEV is not a function`: в кэше Vite (`site/node_modules/.vite`)
    оказалась production-сборка React (`jsxDEV = undefined`). Поймал после
    того, как гонял `build`/`preview` при живом dev-демоне. Лечится:
    `astro dev stop && rm -rf site/node_modules/.vite`, затем `dev`.
- Следующему:
  - 04: место — комментарий `STACKBLITZ` в `index.mdx` сразу после
    `<Playground />`; `<Aside>` теперь говорит только про StackBlitz.
  - 05: `build` сайта сам делает `pnpm --filter eberly run build` и
    `check:playground` — build command в 05 упростил. `track()` —
    `site/src/lib/analytics.ts`, события `playground_regenerate`,
    `playground_upload_spec`, `playground_type_error_shown` (раз за сессию,
    через `sessionStorage`). Favicon добавить.
  - Баги выше (`BaseStore`-констрейнт, path-level `parameters`) — кандидаты
    в отдельные задачи; плейграунд с загруженной чужой схемой их покажет.
- Поправил файлы плана: `05-deploy.md` (build command, путь к `track()`).

## 2026-10-06 — 04

- Нашёл / пошло не по плану:
  - **Вариант 1 взлетел** (весь репо, без копии кода): `.stackblitzrc` в
    корне — `installDependencies: false` и своя установка
    `pnpm install --filter eberly --filter './examples/nest/*'` (3 из 8
    пакетов воркспейса; без фильтра — все 8 вместе с сайтом и Monaco,
    65 с одна установка), затем `pnpm run stackblitz` →
    `scripts/stackblitz.ts`: сборка библиотеки → `tsc` Nest → `node
    dist/main.js` с `TEST_MODE=1` → `swagger.json` с живого бэкенда (формат
    как у `pnpm swagger`, без правок DTO диффа нет) → `client:generate` →
    `vitest` в watch. Без `detached`/process group, как в `e2e.ts` (в
    WebContainers их нет), — поэтому бэкенд запускается `node`, а не `pnpm start`.
  - **Время до зелёных тестов** (14 тестов, 5 файлов) — **90–190 с** от
    открытия ссылки (при уже импортированной ветке). Правка теста в
    редакторе → `RERUN` за ~1 с. Правка DTO — Ctrl+C и `pnpm run stackblitz`
    заново (свагер берётся с живого бэкенда).
  - **Первое открытие новой ветки/коммита виснет на «Cloning repo from
    GitHub»**: WebSocket `wss://stackblitz.com/cable` отвечал 404 (и для
    чужих репо), а по нему приходит «импорт готов». Повторное открытие
    той же ссылки идёт дальше — импорт уже в кэше StackBlitz. Т.е. после
    пуша в `main` первый посетитель может увидеть зависание. Лекарство на
    будущее (не делал): после деплоя (05) один раз открыть ссылку самому.
  - **pnpm в StackBlitz старее нашего**: `WARN Ignoring broken lockfile …
    not compatible with current pnpm` — lockfile v9 игнорируется,
    зависимости резолвятся заново по диапазонам. Сейчас работает, но версии
    могут уплыть. Поможет ли `packageManager` (05) — не проверял.
  - Условия: открытие публичного GitHub-репо в StackBlitz бесплатно
    (Personal Free — публичные проекты без ограничений), посетителю аккаунт
    не нужен — проверял в браузере без логина. Коммерческая лицензия нужна
    только для встраивания WebContainer API, это не наш случай.
  - Репо было приватным — пользователь сделал его публичным в ходе задачи.
  - Кнопка открывает `nest/…/tests/readme.test.ts` (тест «до и после» с
    лендинга), а не `posts.test.ts`. Но имена тестов и комментарии в
    примерах — **по-русски**, на английском сайте это заметно. Кандидат в
    отдельную задачу: перевести хотя бы `readme.test.ts` (вне регионов).
  - Проверял через `playwright-core` + системный Chrome (скрипты в
    скретчпаде): расширение Claude in Chrome не подключено. Проверочная
    ветка `stackblitz-check` на GitHub удалена.
- Следующему:
  - 05: событие `open_stackblitz` — кнопка в
    `site/src/components/OpenInStackBlitz.astro`, обычная ссылка (поправил
    шаг 5 в `05-deploy.md`). Ссылка ведёт на `main` — до мержа ветки в
    `main` кнопка откроет `main` без `.stackblitzrc` (там StackBlitz
    поставит весь воркспейс и остановится на шелле).
  - 06: в README можно сослаться на кнопку или на ту же ссылку.
- Поправил файлы плана: `05-deploy.md` (шаг 5, где кнопка).

## 2026-10-06 — 05

- Нашёл / пошло не по плану:
  - **Cloudflare теперь ведёт в Workers, а не в Pages** — пользователь создал
    Worker `eberly` (стартовый «Hello World»). Оставили Worker: статика там
    бесплатна, домен уже привязан. Нужен `wrangler.jsonc` в корне (`name`
    совпадает с именем Worker'а, `assets.directory: ./site/dist`,
    `not_found_handling: 404-page`); Workers Builds: build
    `pnpm --filter @eberly-site/site build`, deploy `npx wrangler deploy`,
    build variables `NODE_VERSION=22`, `PNPM_VERSION=10.33.0`. Шаг 3 в
    `05-deploy.md` переписан.
  - `www.eberly.dev` нельзя добавить Custom domain'ом Worker'а («No zones
    match») — сделали DNS `AAAA www → 100::` (Proxied) + Redirect Rule
    `http.host eq "www.eberly.dev"` → `concat("https://eberly.dev",
    http.request.uri.path)`, 301, query сохраняется. Сразу после создания
    записи `www` у пользователя и у меня локально был NXDOMAIN из кэша
    (Cloudflare кэширует «нет записи» до 30 мин) — на NS Cloudflare уже всё
    было.
  - CI: `packageManager: pnpm@10.33.0`, actions `checkout@v7`,
    `setup-node@v7`, `pnpm/action-setup@v6` (версию берёт из
    `packageManager`). `changesets/action` **оставлен на `@v1`**: в v2
    переименованы входы и пуш тегов через API — публикация поменялась бы.
    В CI добавлены `pnpm test` и сборка сайта.
  - Umami: скрипт в `head` с `data-domains="eberly.dev"` — с `localhost` и
    `*.workers.dev` трекер молчит сам, отдельной «только prod» сборки не
    нужно. `open_stackblitz` — атрибут `data-umami-event` на ссылке
    (`LinkButton` пробрасывает атрибуты), `copy_install` — в своём `Footer`
    (клик по кнопке копирования expressive-code с командой установки).
  - Ветка `New-features` влита в `main` fast-forward'ом; пуш в `main` даёт
    PR «Version Packages» от changesets (0.3.0) — это ожидаемо, не мержить
    без решения о релизе.
  - Umami проверен: визиты и `copy_install` доходят (Chrome). **Brave и
    блокировщики режут `cloud.umami.is`** — у таких посетителей нулей не
    избежать. Лечится проксированием скрипта и `/api/send` через свой домен
    (Worker) — не делали. Headless Chrome Umami считает ботом (`beep/boop`).
  - Заголовок лендинга — `eberly | eberly` (splash-страница `title: eberly`
    + имя сайта). Косметика, не трогал.
- Следующему (06): `https://eberly.dev` и все страницы из записи 01
  открываются, `www` → корень. StackBlitz: после пуша в `main` один раз
  открыть кнопку самому (см. 04).
- Поправил файлы плана: `05-deploy.md` (шаг 3 — Workers вместо Pages, `www`).

## 2026-10-06 — 06

- Нашёл / пошло не по плану: в `skills/*/SKILL.md` ссылок на README не было —
  менять нечего. `bin/eberly.mjs` теперь печатает
  `Docs: https://eberly.dev/getting-started/` вместо ссылки на README;
  якорь `#quick-start` в README всё равно сохранён (раздел остался).
  `e2e`-смоук текст ссылки не проверяет. Все ссылки README проверены
  `curl` (сайт и StackBlitz — 200; `npmjs.com` отвечает `curl`'у 403 —
  антибот, пакеты `eberly`/`ebely` есть в registry). Сайт не трогал.
- Следующему: переименование страницы сайта ломает ссылки в README и в CLI
  (правило записано в `CLAUDE.md`). Из прошлых записей ещё открыты: баги
  генератора из 03 (`BaseStore`-констрейнт, path-level `parameters`),
  русские имена тестов в `readme.test.ts` (04), заголовок `eberly | eberly` (05).
- Поправил файлы плана: нет.
