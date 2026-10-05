---
"ebely": minor
---

Скиллы `/ebely-setup` и `/ebely-write-tests` для Claude Code.

- Оба скилла дописаны (были заглушками): вопросы пользователю, шаги,
  правила и шпаргалка по API. Агент читает `ebely/api/`, а не
  `generated.ts` и не код бэкенда.
- `npx ebely create` сам кладёт скиллы в `<dir>/.claude/skills/`.
  `npx ebely skills` остаётся для существующих проектов и обновления
  (скиллы копируются — после апдейта `ebely` запустить ещё раз).
