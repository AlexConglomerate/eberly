---
"eberly": minor
---

`res.data` — тело 2xx без `assert` (на любой другой статус бросает
`EberlyAssertionError`); удобно для подготовки данных. Сообщения ошибок
`assert` / `data` начинаются с эндпоинта (`POST /posts: …`), а стек обрезан
по вызов: vitest показывает строку теста, а не `dist/index.mjs`.
