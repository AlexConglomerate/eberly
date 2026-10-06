---
"eberly": minor
---

README на английском: «до и после», быстрый старт, примеры из тестов
`pnpm e2e`, требования к бэкенду, подводные камни, справка по конфигу и API.

- `Readme.md` → `README.md`, добавлен `LICENSE` (MIT).
- `package.json`: `description`, `keywords`, `repository`, `homepage`,
  `bugs` для страницы на npm.
- `npx eberly create` в подсказке «вручную» теперь зовёт
  `pnpm typecheck && pnpm test` и даёт ссылку на README.
