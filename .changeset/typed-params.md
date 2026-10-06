---
"eberly": minor
---

Path- и query-параметры типизированы по их схеме: `integer` / `number` →
`number`, `boolean` → `boolean`, `enum` из примитивов → союз литералов
(`$ref` разворачивается, `null` отбрасывается). Раньше path-параметр был
всегда `string`: `{ path: { postId: post.body.id } }` теперь без
`String(…)`. Массивы и объекты — как раньше. Типы в `api/*.md` — те же.
