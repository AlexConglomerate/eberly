---
"eberly": minor
---

Скиллы `/eberly-setup` и `/eberly-write-tests` для Claude Code.

- Оба скилла дописаны (были заглушками): вопросы пользователю, шаги,
  правила и шпаргалка по API. Агент читает `eberly/api/`, а не
  `generated.ts` и не код бэкенда.
- `npx eberly create` сам кладёт скиллы в `<dir>/.claude/skills/`.
  `npx eberly skills` остаётся для существующих проектов и обновления
  (скиллы копируются — после апдейта `eberly` запустить ещё раз).
