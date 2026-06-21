# ebely

## 0.1.0

### Minor Changes

- 8771925: Загрузка файлов через сгенерированный клиент (multipart/form-data).

  Файловые поля (OpenAPI 3.1: `{ type: 'string', contentMediaType }`)
  типизируются как `FileInput` (путь-строка / `URL` / `{ path }` /
  `{ content }` / `Blob`/`File`), а общий `request` сам собирает `FormData`
  и читает пути с диска. Кодировка имён полей для МАССИВА файлов настраивается
  один раз через `EbelyConfig.files.encoding`:
  `'repeat'` (дефолт, busboy/Go/Rust), `'bracket-index'` (oRPC/PHP/Rails),
  `'bracket-empty'` или своя функция. Новые публичные экспорты:
  `toMultipartFormData`, `toBlob`, `mimeFromName`, типы `FileInput`,
  `FileEncoding`, `FileFieldMeta`. См. `ARCHITECTURE.md §9`.

### Patch Changes

- add send files

## 0.0.7

### Patch Changes

- add global retry and common hooks

## 0.0.6

### Patch Changes

- fix double path

## 0.0.5

### Patch Changes

- fix bug

## 0.0.4

### Patch Changes

- add clone func

## 0.0.3

### Patch Changes

- add readme

## 0.0.2

### Patch Changes

- add main functional
