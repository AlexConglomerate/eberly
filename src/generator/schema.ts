// Слой «JSON-Schema → строка TypeScript-типа».
//
// Здесь нет ничего про HTTP или про файлы — только чистое преобразование
// узлов swagger-схемы в текст TS-типа, который потом подставляется в
// сигнатуры сгенерированных методов клиента.

import type { SchemaNames } from './names'
import type { Json } from './types'

const SCHEMA_REF_PREFIX = '#/components/schemas/'

/**
 * Узел схемы описывает ФАЙЛ? OpenAPI 3.1: строка с `contentMediaType`
 * (именно так эмитит oRPC: `{ type: 'string', contentMediaType: 'image/*' }`,
 * ровно `isFileSchema` из `@orpc/openapi`). OpenAPI 3.0: строка с
 * `format: 'binary'` (так эмитит `@nestjs/swagger`). `format: 'byte'` —
 * base64-строка, это НЕ файл.
 */
export function isFileSchema(schema: Json | undefined): boolean {
  return (
    Boolean(schema) &&
    schema!.type === 'string' &&
    (typeof schema!.contentMediaType === 'string' || schema!.format === 'binary')
  )
}

/**
 * Преобразует JSON-Schema в строку с типом TypeScript. `$ref` на
 * `components/schemas` рендерится ИМЕНЕМ типа из `names` (без разворота),
 * поэтому рекурсивные схемы становятся обычной рекурсией TypeScript.
 * `nullable: true` (3.0) добавляет `| null` поверх результата любой ветки.
 */
export function schemaToType(args: {
  schema: Json | undefined
  spec: Json
  names: SchemaNames
  indent?: number
}): string {
  const { schema } = args
  if (!schema) return 'unknown'
  const type = schemaToTypeBase({ ...args, schema })
  return schema.nullable === true && type !== 'unknown' ? `${type} | null` : type
}

function schemaToTypeBase(args: {
  schema: Json
  spec: Json
  names: SchemaNames
  indent?: number
}): string {
  const { schema, spec, names, indent = 0 } = args
  const sub = (s: Json | undefined, i = indent): string =>
    schemaToType({ schema: s, spec, names, indent: i })

  if (typeof schema.$ref === 'string') {
    const ref: string = schema.$ref
    const name = ref.startsWith(SCHEMA_REF_PREFIX)
      ? names.get(ref.slice(SCHEMA_REF_PREFIX.length))
      : undefined
    if (name) return name
    // Не схема-тип (`components/responses` и т.п.) — обёртка, разворачиваем.
    return sub(resolveRef({ ref, spec }))
  }

  // Файловый узел → публичный тип FileInput (путь/URL/File/Blob/байты).
  // Стоит ДО ветки `type: 'string'`, иначе файл затипизировался бы как string.
  // Массив файлов получается автоматически: ветка `array` зовёт schemaToType
  // на items → `Array<FileInput>`.
  if (isFileSchema(schema)) return 'FileInput'

  // Стоит ДО ветки `type`: Nest кладёт `type: 'object'` рядом с `allOf`.
  for (const key of ['allOf', 'oneOf', 'anyOf'] as const) {
    if (Array.isArray(schema[key])) {
      const parts: string[] = schema[key].map((s: Json) => sub(s))
      if (key !== 'allOf') return parts.join(' | ')
      // `&` сильнее `|`: union внутри пересечения берём в скобки.
      return parts.map((p) => (parts.length > 1 && p.includes(' | ') ? `(${p})` : p)).join(' & ')
    }
  }

  if (Array.isArray(schema.enum)) {
    return schema.enum.map((v: unknown) => JSON.stringify(v)).join(' | ')
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type]

  const rendered = types.map((type: string | undefined): string => {
    switch (type) {
      case 'string':
        return 'string'
      case 'number':
      case 'integer':
        return 'number'
      case 'boolean':
        return 'boolean'
      case 'null':
        return 'null'
      case 'array':
        return `Array<${sub(schema.items)}>`
      case 'object': {
        const props: Json = schema.properties ?? {}
        const required: string[] = schema.required ?? []
        const keys = Object.keys(props)
        if (keys.length === 0) return 'Record<string, unknown>'
        const pad = '  '.repeat(indent + 1)
        const closePad = '  '.repeat(indent)
        const lines = keys.map((k) => {
          const optional = required.includes(k) ? '' : '?'
          return `${pad}${JSON.stringify(k)}${optional}: ${sub(props[k], indent + 1)}`
        })
        return `{\n${lines.join('\n')}\n${closePad}}`
      }
      default:
        return 'unknown'
    }
  })

  return rendered.join(' | ')
}

/**
 * Блок `export type <Имя> = <тип>` — по одному на каждую схему из
 * `components/schemas`, в порядке ключей спеки. Пустая строка, если схем нет.
 */
export function renderSchemaDecls(args: { spec: Json; names: SchemaNames }): string {
  const { spec, names } = args
  const schemas: Json = spec.components?.schemas ?? {}
  return [...names.entries()]
    .map(([key, name]) => `export type ${name} = ${schemaToType({ schema: schemas[key], spec, names })}`)
    .join('\n\n')
}

/** Разрешает локальную $ref-ссылку внутри схемы. */
export function resolveRef(args: { ref: string; spec: Json }): Json | undefined {
  const { ref, spec } = args
  if (!ref.startsWith('#/')) return undefined
  return ref
    .slice(2)
    .split('/')
    .reduce<Json | undefined>((acc, part) => (acc ? acc[part] : undefined), spec)
}

/** Достаёт схему успешного JSON-ответа (2xx). */
export function pickResponseSchema(args: { responses: Json; spec: Json }): Json | undefined {
  const { responses } = args
  const status = Object.keys(responses ?? {}).find((s) => s.startsWith('2')) ?? 'default'
  return responses?.[status]?.content?.['application/json']?.schema
}

/**
 * Собирает ВСЕ задекларированные ответы с числовым статусом и их
 * JSON-схемой (нечисловые ключи вроде `default` пропускаются). Нужно
 * для карты «статус → тело» в режиме клиента `'test'`.
 */
export function collectResponseSchemas(args: {
  responses: Json
  spec: Json
}): Array<{ status: number; schema: Json | undefined }> {
  const { responses } = args
  const out: Array<{ status: number; schema: Json | undefined }> = []
  for (const key of Object.keys(responses ?? {})) {
    const status = Number(key)
    if (!Number.isInteger(status)) continue
    out.push({
      status,
      schema: responses[key]?.content?.['application/json']?.schema,
    })
  }
  return out
}
