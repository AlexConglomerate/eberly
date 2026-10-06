---
"eberly": patch
---

Внутреннее: шаги генератора без IO вынесены в `buildClient`
(`src/generator/pipeline.ts`) — его переиспользует плейграунд на сайте.
`generateClient` и сгенерированные файлы не меняются.
