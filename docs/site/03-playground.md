# 03. Плейграунд

> Контекст — [README.md](README.md). Перед стартом прочитай
> [HANDOFF.md](HANDOFF.md). Зависит от 01 (сайт) и 02 (английский
> `generated.ts`). Желательно после [`../NEXT-yaml-spec.md`](../NEXT-yaml-spec.md):
> тогда разбор YAML берётся оттуда (`parseSpecText`). Если она ещё не
> сделана — парсить пакетом `yaml` прямо в `site/` и записать в HANDOFF,
> что это место надо заменить.

## Что видит пользователь

```
┌──────────── openapi.yaml ────────────┬─── example.test.ts │ generated.ts ───┐
│ paths:                               │ const post = await alice.posts      │
│   /posts:                            │   .create({ body: { title: 'Hi' }}) │
│     post:                            │ post.assert(201, { title: 'Hi' })   │
│       ...                            │            ~~~~~  ← красным         │
│ [Upload spec] [Reset]                │ ● 1 type error                      │
└──────────────────────────────────────┴─────────────────────────────────────┘
```

- Слева — Monaco с YAML (подсветка), кнопки **Upload spec** (`.json`,
  `.yaml`, `.yml`; читается `FileReader`, **никуда не отправляется** —
  подпись рядом: *Your spec never leaves the browser*) и **Reset**.
- Перегенерация — при уходе с поля (blur) и по `Cmd/Ctrl+S`.
- Справа — вкладки: `example.test.ts` (**редактируемый**, автодополнение
  `assert(201, { … })` работает) и `generated.ts` (read-only). Счётчик
  ошибок типов.
- Ошибка схемы (не парсится, Swagger 2.0, не та версия) — плашка под
  левым редактором с текстом существующей английской ошибки генератора;
  правая часть остаётся с последним удачным клиентом.
- Узкий экран (телефон): редакторы друг под другом. Monaco на телефоне
  неудобен — допустимо показать вместо него статичный пример и ссылку
  «Open on desktop»; решить по месту и записать в HANDOFF.

## Как устроено

1. **Чистый конвейер в библиотеке.** Вынести из `generateClient` шаги без
   IO в функцию, например `src/generator/pipeline.ts`:
   `buildClient({ spec, mode, userStoreImport, configImport })` →
   `{ source, operations, docs }` (`assertSupportedVersion` →
   `buildSchemaNames` → `collectOperations` → `renderClient` →
   `renderEndpointDocs`). `generateClient` вызывает её и пишет файлы —
   поведение и вывод **байт-в-байт** прежние (`pnpm e2e` без диффа в
   `generated.ts`). В `index.ts` не экспортировать — сайт импортирует
   файл напрямую. Юнит-тест на `buildClient` на мини-спеке.
2. **Импорт в сайт.** Плейграунд импортирует `../../src/generator/pipeline`
   (или через alias в Vite). Проверить, что в бандл не попал `node:*`
   (сборка должна упасть, если попадёт).
3. **Monaco + TypeScript.** Виртуальные файлы:
   - `file:///node_modules/eberly/index.d.ts` ← `dist/index.d.ts` (через
     `addExtraLib`; `site` зависит от `eberly: workspace:*`, сборка сайта
     требует `pnpm build` в корне — прописать в скрипте `build` сайта);
   - `file:///eberly/eberly.ts` — минимальный конфиг (`url`, `swagger`,
     `userStore` — подкласс `BaseStore`, `mode: 'test'`), read-only, можно
     не показывать;
   - `file:///eberly/generated.ts` ← `buildClient(...).source`, пересоздаётся
     при перегенерации;
   - `file:///tests/example.test.ts` — тест (импорт `vitest` заменить
     на объявленные в extraLib `describe`/`test` или обойтись без них —
     решить по месту).
   Опции компилятора — `strict`, ESM, `moduleResolution: bundler`, как в
   примерах. Ошибки показывает сам TS-воркер Monaco.
4. **Загрузка.** Остров — `client:visible`, Monaco и воркеры — из npm-пакета
   (не с CDN), грузятся лениво; лендинг не ждёт плейграунд. Записать в
   HANDOFF вес бандла плейграунда.
5. **Пример по умолчанию.** `site/src/playground/example.yaml` — схема
   Nest-примера, урезанная до постов (~60 строк, OpenAPI 3.0, `PostDto`,
   `create`/`get`/`remove`, ошибка с `ErrorDto`), и `example.test.ts` по
   мотивам `examples/nest/test-with-eberly/tests/readme.test.ts`.
   **Скрипт проверки** `site/scripts/check-playground.ts`: генерирует клиент
   из `example.yaml` во временную папку и прогоняет `tsc --noEmit` по
   тесту. Запускается в начале `build` сайта — сломанный пример ломает
   сборку (и деплой).
6. **События аналитики** — тонкая обёртка `track({ name })`, пока no-op
   (подключит 05): `playground_regenerate`, `playground_upload_spec`,
   `playground_type_error_shown` (один раз за сессию). **Без** содержимого
   и имени файла схемы.
7. Вставить плейграунд в лендинг (место из 01) и отдельной страницей
   `/playground`. `CLAUDE.md` и `ARCHITECTURE.md` (новый `pipeline.ts`).

## Готово, когда

- локально: переименовал `title` → `name` в `example.yaml`, ушёл с поля —
  в тесте красное подчёркивание; загрузил схему Nest-примера целиком —
  клиент собрался;
- `pnpm test`, `pnpm lint`, `pnpm e2e` зелёные, `generated.ts` примеров без
  диффа; `pnpm --filter @eberly-site/site build` проходит и падает, если
  сломать `example.test.ts`;
- запись в HANDOFF.md (вес бандла, решение по телефону).
