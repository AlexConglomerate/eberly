// Слой «JSON-Schema → строка TypeScript-типа».
//
// Здесь нет ничего про HTTP или про файлы — только чистое преобразование
// узлов swagger-схемы в текст TS-типа, который потом подставляется в
// сигнатуры сгенерированных методов клиента.

import type { Json } from './types'

/** Преобразует JSON-Schema в строку с типом TypeScript. */
export function schemaToType(args: { schema: Json | undefined; spec: Json; indent?: number }): string {
  const { schema, spec, indent = 0 } = args
  if (!schema) return 'unknown'

  if (typeof schema.$ref === 'string') {
    const resolved = resolveRef({ ref: schema.$ref, spec })
    return schemaToType({ schema: resolved, spec, indent })
  }

  for (const key of ['allOf', 'oneOf', 'anyOf'] as const) {
    if (Array.isArray(schema[key])) {
      const joiner = key === 'allOf' ? ' & ' : ' | '
      return schema[key]
        .map((s: Json) => schemaToType({ schema: s, spec, indent }))
        .join(joiner)
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
        return `Array<${schemaToType({ schema: schema.items, spec, indent })}>`
      case 'object': {
        const props: Json = schema.properties ?? {}
        const required: string[] = schema.required ?? []
        const keys = Object.keys(props)
        if (keys.length === 0) return 'Record<string, unknown>'
        const pad = '  '.repeat(indent + 1)
        const closePad = '  '.repeat(indent)
        const lines = keys.map((k) => {
          const optional = required.includes(k) ? '' : '?'
          const valueType = schemaToType({ schema: props[k], spec, indent: indent + 1 })
          return `${pad}${JSON.stringify(k)}${optional}: ${valueType}`
        })
        return `{\n${lines.join('\n')}\n${closePad}}`
      }
      default:
        return 'unknown'
    }
  })

  return rendered.join(' | ')
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
