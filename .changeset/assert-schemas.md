---
"eberly": minor
---

Во втором аргументе `assert` вместо любого значения — Standard Schema
(Zod, Valibot, ArkType…) или асимметричный матчер vitest / Jest:
`res.assert(201, { createdAt: z.iso.datetime(), authorId: expect.any(Number) })`.
Без новых зависимостей. Из пакета экспортируются типы `Expected` и
`StandardSchemaV1`.
