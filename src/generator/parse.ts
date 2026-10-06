// Текст схемы → объект. Чистая функция без `node:`-импортов: её же
// переиспользует плейграунд на лендинге (в браузере). Файлы и сеть —
// в swagger.ts.
//
// Формат определяем по тексту, а не по расширению или `content-type`:
// после trim() начинается с `{` → JSON, иначе → YAML. Парсер YAML
// грузится лениво — JSON-схемы его не тянут.

import type { Json } from './types'

/**
 * Разбирает текст OpenAPI-схемы (JSON или YAML) в объект.
 * `source` (путь или URL) — только для сообщения об ошибке.
 * Не объект на выходе (YAML-скаляр, массив, пустой текст) — та же ошибка.
 */
export async function parseSpecText(args: { text: string; source: string }): Promise<Json> {
  const { text, source } = args

  let spec: unknown
  try {
    if (text.trim().startsWith('{')) {
      spec = JSON.parse(text)
    } else {
      const { parse } = await import('yaml')
      spec = parse(text)
    }
  } catch (error) {
    throw parseError({ source, reason: error instanceof Error ? error.message : String(error) })
  }

  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) {
    const got = spec === null || spec === undefined ? 'empty document' : Array.isArray(spec) ? 'array' : typeof spec
    throw parseError({ source, reason: `expected an object, got ${got}` })
  }
  return spec as Json
}

function parseError(args: { source: string; reason: string }): Error {
  return new Error(`eberly: failed to parse the OpenAPI spec from ${args.source} as JSON or YAML: ${args.reason}`)
}
