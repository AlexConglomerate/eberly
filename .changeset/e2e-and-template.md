---
"eberly": minor
---

E2E на живых бэкендах и шаблон из примера.

- `res.assert(status)` сужает `.body` до тела задекларированного статуса:
  `res.assert(201).body.id` без каста, даже если у эндпоинта есть
  задекларированные ошибки (раньше `body` был союзом `PostDto | ErrorDto`).
- Шаблон `npx eberly create` собирается из `examples/simple/test-with-eberly`
  при публикации: в него попали `vitest.config.ts`
  (`fileParallelism: false` — тест-файлы идут по очереди, база общая),
  скрипт `typecheck` (`tsc --noEmit`) и исправленный пример теста
  (второй пользователь теперь регистрируется).
