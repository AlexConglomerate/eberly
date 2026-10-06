# 06. README — витрина со ссылкой на сайт

> Контекст — [README.md](README.md). Перед стартом прочитай
> [HANDOFF.md](HANDOFF.md). После 05: `eberly.dev` уже открывается.

## Цель

README на GitHub и npm остаётся коротким: что это, пример, как начать,
куда идти дальше. Вся подробная документация — на сайте, у неё один
источник правды.

## Что оставить в README

- заголовок, слоган, бейджи;
- ссылки: **Docs** → `https://eberly.dev`, **Playground** →
  `https://eberly.dev/playground`, **Open in StackBlitz**;
- «Before and after» (код — по-прежнему один в один из
  `examples/nest/test-with-eberly/tests/readme.test.ts`);
- «Quick start» (якорь `#quick-start` сохранить — на него ссылается
  `bin/eberly.mjs:144`, или поменять ссылку в CLI на страницу сайта);
- короткий список возможностей со ссылками на страницы документации;
- License и строка «Formerly published as `ebely`».

Всё остальное (Examples, Writing tests with AI agents, What your backend
needs, Gotchas, Config reference, API cheat sheet, Roadmap) — ссылками на
сайт. Перед удалением раздела убедиться, что страница с ним на сайте есть.

## Ещё

- Скиллы `skills/*/SKILL.md` и `bin/eberly.mjs`: ссылки на разделы README,
  которые уехали, — поменять на страницы сайта.
- `CLAUDE.md`: правило про README обновить («README — витрина; код в нём —
  из тестов; подробности — на сайте, код там — регионами из тестов»).

## Готово, когда

- все ссылки из README открываются (проверить каждую);
- `pnpm e2e` зелёный (смоук `eberly create` печатает ссылку на README);
- запись в HANDOFF.md.
