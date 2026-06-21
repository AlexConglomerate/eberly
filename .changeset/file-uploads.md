---
"ebely": minor
---

Загрузка файлов через сгенерированный клиент (multipart/form-data).

Файловые поля (OpenAPI 3.1: `{ type: 'string', contentMediaType }`)
типизируются как `FileInput` (путь-строка / `URL` / `{ path }` /
`{ content }` / `Blob`/`File`), а общий `request` сам собирает `FormData`
и читает пути с диска. Кодировка имён полей для МАССИВА файлов настраивается
один раз через `EbelyConfig.files.encoding`:
`'repeat'` (дефолт, busboy/Go/Rust), `'bracket-index'` (oRPC/PHP/Rails),
`'bracket-empty'` или своя функция. Новые публичные экспорты:
`toMultipartFormData`, `toBlob`, `mimeFromName`, типы `FileInput`,
`FileEncoding`, `FileFieldMeta`. См. `ARCHITECTURE.md §9`.
