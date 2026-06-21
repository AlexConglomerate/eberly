// Рантайм-ядро отправки файлов (multipart/form-data). Попадает в npm-пакет
// и используется СГЕНЕРИРОВАННЫМ клиентом (как BaseStore / ApiResponse).
//
// Модуль умышленно «лёгкий на импорт»: чтение файла с диска идёт через
// ленивый `import('node:fs/promises')` ВНУТРИ функции, поэтому сам модуль
// можно импортировать и во фронтенд-сборке (браузер), где `fs` нет — там
// пользователь передаёт готовые File/Blob, и до node-импорта дело не доходит.
//
// Чистые функции (`toBlob`, `toMultipartFormData`, `mimeFromName`) легко
// юнит-тестируются без сети — см. src/files.test.ts. Подробности про
// конвенции кодировки массива файлов — в ARCHITECTURE.md §9.

/**
 * Как кодируются ИМЕНА полей формы для МАССИВА файлов (для одного файла не
 * важно — всегда одно поле без скобок). Сам wire-формат multipart (RFC 7578)
 * везде одинаков; различается только именование при массиве:
 *  - 'repeat'        — files, files, …      (busboy: Express/Nest/Fastify, Go, Rust) — ДЕФОЛТ
 *  - 'bracket-index' — files[0], files[1]   (oRPC OpenAPI-хендлер, PHP, Rails)
 *  - 'bracket-empty' — files[], files[]     (PHP/Rails вариант)
 *  - функция         — кастомная кодировка (escape hatch)
 */
export type FileEncoding =
  | 'repeat'
  | 'bracket-index'
  | 'bracket-empty'
  | ((args: { form: FormData; field: string; blobs: Blob[] }) => void)

/**
 * Способы передать файл в типизированный метод клиента. В 90% случаев это
 * строка-путь или URL (в тестах); во фронтенде — готовый File/Blob.
 */
export type FileInput =
  // путь: абсолютный — как есть; относительный — от process.cwd();
  // либо file://-строка.
  | string
  // file://-URL — напр. `new URL('./a.jpg', import.meta.url)` (ложится на bany).
  | URL
  // путь + переопределение имени/mime.
  | { path: string; name?: string; type?: string }
  // байты напрямую (когда читать с диска нечего).
  | { content: Uint8Array | ArrayBuffer; name: string; type?: string }
  // готовый web-объект (нужен для mode:'frontend' в браузере).
  | Blob
  | File

/** Плоское файловое поле тела: имя свойства + это массив файлов или один. */
export type FileFieldMeta = { name: string; array: boolean }

// Маленькая таблица mime по расширению. Нужна, чтобы серверный барьер вроде
// `image/*` (zod `file().type('image/*')`) пропускал файл, даже если
// пользователь не указал тип явно. Дефолт — application/octet-stream.
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  html: 'text/html',
  xml: 'application/xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  zip: 'application/zip',
}

/** Последний сегмент пути (без импорта node:path — работает и в браузере). */
function basenameOf(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

/** mime по расширению имени/пути; дефолт — application/octet-stream. */
export function mimeFromName(name: string): string {
  const base = basenameOf(name)
  const dot = base.lastIndexOf('.')
  const ext = dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

/** Читает файл с диска (Node) и оборачивает в File с именем/mime. */
async function readPathToBlob(args: {
  path?: string
  url?: URL
  name?: string
  type?: string
}): Promise<Blob> {
  const { readFile } = await import('node:fs/promises')

  let filePath: string
  if (args.url) {
    const { fileURLToPath } = await import('node:url')
    filePath = fileURLToPath(args.url)
  } else {
    const { resolve } = await import('node:path')
    // resolve(cwd, abs) === abs, поэтому абсолютный путь остаётся как есть,
    // а относительный резолвится от process.cwd().
    filePath = resolve(process.cwd(), args.path ?? '')
  }

  const bytes = await readFile(filePath)
  const name = args.name ?? basenameOf(filePath)
  const type = args.type ?? mimeFromName(filePath)
  return new File([bytes], name, { type })
}

/**
 * Преобразует один {@link FileInput} в Blob (File). Путь читается с диска
 * через `fs` (Node); готовый File/Blob возвращается как есть (браузер).
 */
export async function toBlob(input: FileInput): Promise<Blob> {
  // Готовый web-объект (File наследует Blob) — как есть.
  if (input instanceof Blob) return input

  // file://-URL — превращаем в путь и читаем.
  if (input instanceof URL) return readPathToBlob({ url: input })

  // Байты напрямую.
  if (typeof input === 'object' && 'content' in input) {
    const { content, name, type } = input
    // content (Uint8Array | ArrayBuffer) — валидный BlobPart в рантайме;
    // cast нужен из-за дженерика Uint8Array<ArrayBufferLike> в новом lib.
    return new File([content as BlobPart], name, { type: type ?? mimeFromName(name) })
  }

  // { path, name?, type? }
  if (typeof input === 'object' && 'path' in input) {
    return readPathToBlob({ path: input.path, name: input.name, type: input.type })
  }

  // Строка: file://-строка либо обычный путь.
  if (input.startsWith('file://')) return readPathToBlob({ url: new URL(input) })
  return readPathToBlob({ path: input })
}

/** Кодирует МАССИВ блобов в поле формы по выбранной конвенции (см. FileEncoding). */
function appendArray(args: {
  form: FormData
  field: string
  blobs: Blob[]
  encoding: FileEncoding
}): void {
  const { form, field, blobs, encoding } = args
  if (typeof encoding === 'function') {
    encoding({ form, field, blobs })
    return
  }
  switch (encoding) {
    case 'bracket-index':
      blobs.forEach((b, i) => form.append(`${field}[${i}]`, b))
      return
    case 'bracket-empty':
      for (const b of blobs) form.append(`${field}[]`, b)
      return
    case 'repeat':
    default:
      for (const b of blobs) form.append(field, b)
      return
  }
}

/**
 * Собирает FormData из тела-объекта: файловые поля кодируются по конвенции
 * (`encoding`), остальные (скалярные) поля добавляются строками (объекты —
 * через JSON.stringify). Вызывается уже ПОСЛЕ before-хуков, когда тело —
 * обычный объект.
 */
export async function toMultipartFormData(args: {
  body: Record<string, unknown>
  fileFields: FileFieldMeta[]
  encoding: FileEncoding
}): Promise<FormData> {
  const { body, fileFields, encoding } = args
  const form = new FormData()
  const fileFieldNames = new Set(fileFields.map((f) => f.name))

  for (const field of fileFields) {
    const value = body[field.name]
    if (value === undefined || value === null) continue

    if (field.array) {
      const inputs = (Array.isArray(value) ? value : [value]) as FileInput[]
      const blobs = await Promise.all(inputs.map((i) => toBlob(i)))
      appendArray({ form, field: field.name, blobs, encoding })
    } else {
      const blob = await toBlob(value as FileInput)
      // Один файл — поле без скобок, кодировка не важна.
      form.append(field.name, blob)
    }
  }

  // Нефайловые скалярные поля тела (типовой случай; глубокую bracket-
  // сериализацию вложенных объектов оставляем в задел — см. ARCHITECTURE.md §9).
  for (const [key, value] of Object.entries(body)) {
    if (fileFieldNames.has(key)) continue
    if (value === undefined) continue
    form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
  }

  return form
}
