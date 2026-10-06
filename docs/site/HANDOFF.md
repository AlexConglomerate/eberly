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
