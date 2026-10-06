// Слой «имена в сгенерированном файле».
//
// Две независимые вещи:
//   - имена типов для схем из `components/schemas` (`post.create` →
//     `PostCreate`), чтобы `$ref` рендерился именем, а не разворотом;
//   - имена групп операций (тег `User Management` → `userManagement`).
//
// И там, и там есть зарезервированные имена: то, что сгенерированный файл
// и рантайм уже используют сами. Коллизия с ними сломала бы файл (тип
// `Array`) или молча затёрла бы поле стора в рантайме (группа `store`).

import type { Json } from './types'

/**
 * Имена ТИПОВ, которые сгенерированный файл объявляет, импортирует или
 * использует сам (включая параметры дженериков вроде `Store`). Схема с
 * таким именем получает суффикс `Schema`: `File` → `FileSchema`.
 */
export const RESERVED_TYPE_NAMES: ReadonlySet<string> = new Set([
  // объявлено/импортировано в сгенерированном файле
  'World',
  'WorldApi',
  'Hooks',
  'CreateUserArgs',
  'EberlyHookTree',
  'RequestInput',
  'RequestFn',
  'ConfiguredWorldStore',
  'WorldStoreBase',
  'Store',
  'BaseStore',
  'ApiResponse',
  'HookRegistry',
  'BeforeHook',
  'AfterHook',
  'RetryHook',
  'FileInput',
  'FileEncoding',
  'FileFieldMeta',
  // глобальные типы, которыми пользуется сам код
  'Array',
  'Record',
  'Promise',
  'InstanceType',
  'Date',
  'File',
  'Blob',
  'URL',
  'Error',
  'Response',
  'Request',
  'Map',
  'Set',
  'Object',
  'String',
  'Number',
  'Boolean',
])

/**
 * Имена ГРУПП, которые нельзя отдавать: группа становится свойством
 * объекта пользователя (`Object.assign(store, tree)`) и дерева хуков.
 * Такая группа получает суффикс `Api`: `store` → `storeApi`.
 */
export const RESERVED_GROUP_NAMES: ReadonlySet<string> = new Set([
  'get',
  'set',
  'api',
  'store',
  'globalBefore',
  'globalAfter',
  'globalRetry',
  'constructor',
  '__proto__',
])

/** Ключ схемы (`components/schemas/<ключ>`) → имя типа в файле. */
export type SchemaNames = ReadonlyMap<string, string>

/** Режет строку на слова по всему, что не буква/цифра. */
function words(raw: string): string[] {
  return raw.split(/[^A-Za-z0-9]+/).filter(Boolean)
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Ключ схемы → PascalCase-идентификатор типа: `post.create` → `PostCreate`,
 * `Page<Post>` → `PagePost`, `user-dto` → `UserDto`. Начинается с цифры →
 * префикс `Schema`; зарезервированное имя → суффикс `Schema`.
 */
export function toTypeName(raw: string): string {
  let name = words(raw).map(capitalize).join('')
  if (name === '' || /^[0-9]/.test(name)) name = `Schema${name}`
  return RESERVED_TYPE_NAMES.has(name) ? `${name}Schema` : name
}

/**
 * Тег / префикс → camelCase-идентификатор группы: `Posts` → `posts`,
 * `User Management` → `userManagement`, `API Keys` → `apiKeys`.
 * Начинается с цифры → префикс `_`; зарезервированное имя → суффикс `Api`.
 * Пустая строка (в исходнике нет ни букв, ни цифр) → `''`, вызывающий
 * переходит к следующему фолбэку.
 */
export function toGroupName(raw: string): string {
  const [first, ...rest] = words(raw)
  if (first === undefined) return ''
  const head = first === first.toUpperCase() ? first.toLowerCase() : first.charAt(0).toLowerCase() + first.slice(1)
  let name = head + rest.map(capitalize).join('')
  if (/^[0-9]/.test(name)) name = `_${name}`
  return RESERVED_GROUP_NAMES.has(name) ? `${name}Api` : name
}

/**
 * Строит таблицу «ключ схемы → имя типа» для всех `components/schemas`.
 * Дедуп после санитизации — по порядку ключей в спеке: `PostCreate`,
 * `PostCreate2`.
 */
export function buildSchemaNames(args: { spec: Json }): SchemaNames {
  const { spec } = args
  const names = new Map<string, string>()
  const taken = new Set<string>()

  for (const key of Object.keys(spec.components?.schemas ?? {})) {
    const base = toTypeName(key)
    let name = base
    let i = 2
    while (taken.has(name)) name = `${base}${i++}`
    taken.add(name)
    names.set(key, name)
  }
  return names
}
