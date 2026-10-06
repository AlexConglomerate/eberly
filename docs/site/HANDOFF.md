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
