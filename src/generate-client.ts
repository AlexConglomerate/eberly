import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * Генератор типизированного TypeScript-клиента из OpenAPI/Swagger-схемы.
 *
 * Читает swagger.json и пишет в world.ts класс `World`, у которого
 * `createUser()` отдаёт сгруппированный по operationId клиент, делающий
 * под капотом fetch-запросы. Например, operationId `posts.create`
 * превращается в `world.createUser().posts.create({ body })`.
 */

type Json = Record<string, any>

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
type HttpMethod = (typeof HTTP_METHODS)[number]

interface Operation {
  group: string
  name: string
  method: HttpMethod
  path: string
  pathParams: string[]
  queryParams: string[]
  bodyType: string | null
  bodyRequired: boolean
  responseType: string
  summary?: string
}

/** Преобразует JSON-Schema в строку с типом TypeScript. */
function schemaToType(args: { schema: Json | undefined; spec: Json; indent?: number }): string {
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
function resolveRef(args: { ref: string; spec: Json }): Json | undefined {
  const { ref, spec } = args
  if (!ref.startsWith('#/')) return undefined
  return ref
    .slice(2)
    .split('/')
    .reduce<Json | undefined>((acc, part) => (acc ? acc[part] : undefined), spec)
}

/** Достаёт схему успешного JSON-ответа (2xx). */
function pickResponseSchema(args: { responses: Json; spec: Json }): Json | undefined {
  const { responses } = args
  const status = Object.keys(responses ?? {}).find((s) => s.startsWith('2')) ?? 'default'
  return responses?.[status]?.content?.['application/json']?.schema
}

/** Собирает плоский список операций из секции paths. */
function collectOperations(args: { spec: Json }): Operation[] {
  const { spec } = args
  const operations: Operation[] = []

  for (const [path, pathItem] of Object.entries<Json>(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op: Json | undefined = pathItem[method]
      if (!op) continue

      const operationId: string = op.operationId ?? `${method}${path}`
      const dotIndex = operationId.indexOf('.')
      const group = dotIndex === -1 ? 'default' : operationId.slice(0, dotIndex)
      const name = dotIndex === -1 ? operationId : operationId.slice(dotIndex + 1)

      const parameters: Json[] = op.parameters ?? []
      const pathParams = parameters.filter((p) => p.in === 'path').map((p) => p.name as string)
      const queryParams = parameters.filter((p) => p.in === 'query').map((p) => p.name as string)

      const bodySchema = op.requestBody?.content?.['application/json']?.schema
      const responseSchema = pickResponseSchema({ responses: op.responses, spec })

      operations.push({
        group,
        name,
        method,
        path,
        pathParams,
        queryParams,
        bodyType: bodySchema ? schemaToType({ schema: bodySchema, spec, indent: 4 }) : null,
        bodyRequired: Boolean(op.requestBody?.required),
        responseType: schemaToType({ schema: responseSchema, spec, indent: 3 }),
        summary: op.summary,
      })
    }
  }

  return operations
}

/** Описывает тип единственного аргумента-объекта метода (паттерн options object). */
function buildInputType(op: Operation): { type: string; optional: boolean } {
  const parts: string[] = []

  if (op.pathParams.length > 0) {
    const fields = op.pathParams.map((p) => `${JSON.stringify(p)}: string`).join('; ')
    parts.push(`path: { ${fields} }`)
  }
  if (op.queryParams.length > 0) {
    const fields = op.queryParams.map((p) => `${JSON.stringify(p)}?: string | number | boolean`).join('; ')
    parts.push(`query?: { ${fields} }`)
  }
  if (op.bodyType) {
    parts.push(`body${op.bodyRequired ? '' : '?'}: ${op.bodyType}`)
  }

  if (parts.length === 0) return { type: '{}', optional: true }

  const optional = op.pathParams.length === 0 && (!op.bodyType || !op.bodyRequired)
  return { type: `{ ${parts.join('; ')} }`, optional }
}

/** Рендерит финальный исходник world.ts. */
function renderClient(args: {
  spec: Json
  operations: Operation[]
  internalStoreImport: string
  configImport: string
}): string {
  const { spec, operations, internalStoreImport, configImport } = args
  const basePath: string = spec.servers?.[0]?.url ?? ''

  const groups = new Map<string, Operation[]>()
  for (const op of operations) {
    const list = groups.get(op.group) ?? []
    list.push(op)
    groups.set(op.group, list)
  }

  const groupBlocks = [...groups.entries()].map(([group, ops]) => {
    const methods = ops.map((op) => {
      const { type, optional } = buildInputType(op)
      const inputParam = `input${optional ? '?' : ''}: ${type}`
      const doc = op.summary ? `\n        /** ${op.summary} */` : ''
      return `${doc}
        ${JSON.stringify(op.name)}: (${inputParam}): Promise<${op.responseType}> =>
          request({
            method: ${JSON.stringify(op.method.toUpperCase())},
            path: ${JSON.stringify(op.path)},
            input: input as RequestInput,
          }) as Promise<${op.responseType}>,`
    })
    return `      ${JSON.stringify(group)}: {\n${methods.join('\n')}\n      },`
  })

  return `// AUTO-GENERATED by ebely (generateClient) — НЕ редактировать вручную.
// Источник: ${spec.info?.title ?? 'OpenAPI spec'} v${spec.info?.version ?? '?'}
// Перегенерация: pnpm run client:generate

import { InternalStore } from ${JSON.stringify(internalStoreImport)}
import { ebely } from ${JSON.stringify(configImport)}

type RequestInput = {
  path?: Record<string, string>
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

export type CreateUserArgs = {
  /** Заголовки, которые будут добавляться ко всем запросам этого пользователя. */
  headers?: Record<string, string>
}

export class World<
  Store extends InternalStore = InstanceType<typeof ebely.internalStore>,
> {
  constructor(
    public args: {
      /** URL бэкенда. Если не задан — берётся ebely.url из конфига. */
      url?: string
      /** Класс-хранилище. Если не задан — берётся ebely.internalStore. */
      store?: new () => Store
    } = {},
  ) {}

  /** Базовый URL с учётом server.url из схемы. */
  private baseUrl(): string {
    return (this.args.url ?? ebely.url).replace(/\\/$/, '') + ${JSON.stringify(basePath)}
  }

  /**
   * Создаёт «пользователя» — изолированный набор типизированных вызовов
   * эндпоинтов, который под капотом ходит fetch-запросами.
   */
  createUser(userArgs: CreateUserArgs = {}) {
    const baseUrl = this.baseUrl()
    const StoreClass =
      this.args.store ?? (ebely.internalStore as unknown as new () => Store)
    const store = new StoreClass()

    const request = async (req: {
      method: string
      path: string
      input?: RequestInput
    }): Promise<unknown> => {
      const { method, path, input } = req

      let resolvedPath = path
      for (const [key, value] of Object.entries(input?.path ?? {})) {
        resolvedPath = resolvedPath.replace(
          \`{\${key}}\`,
          encodeURIComponent(String(value)),
        )
      }

      const url = new URL(baseUrl + resolvedPath)
      for (const [key, value] of Object.entries(input?.query ?? {})) {
        if (value !== undefined) url.searchParams.set(key, String(value))
      }

      const hasBody = input?.body !== undefined
      const response = await fetch(url, {
        method,
        headers: {
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
          ...userArgs.headers,
        },
        body: hasBody ? JSON.stringify(input!.body) : undefined,
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : undefined

      if (!response.ok) {
        throw new Error(
          \`Request \${method} \${resolvedPath} failed with \${response.status}: \${text}\`,
        )
      }

      return data
    }

    return Object.assign(store, {
${groupBlocks.join('\n')}
    })
  }
}
`
}

/** Аргументы генерации типизированного клиента. */
export type GenerateClientArgs = {
  /** Путь к swagger/OpenAPI-схеме (резолвится от process.cwd()). */
  swaggerSchema: string
  /** Путь, куда писать сгенерированный клиент (резолвится от process.cwd()). */
  generateClientTo: string
  /**
   * Откуда сгенерированный файл импортирует `InternalStore`.
   * По умолчанию — имя пакета библиотеки.
   */
  internalStoreImport?: string
  /**
   * Откуда сгенерированный файл импортирует `ebely`-конфиг.
   * По умолчанию — соседний модуль `./ebely`.
   */
  configImport?: string
}

/**
 * Читает swagger-схему и пишет типизированный клиент `World` в файл.
 * Это публичная точка входа библиотеки: пользователь вызывает её из
 * своего проекта, передавая пути из собственного ebely-конфига.
 */
export async function generateClient(
  args: GenerateClientArgs,
): Promise<{ outPath: string; operations: number }> {
  const {
    swaggerSchema,
    generateClientTo,
    internalStoreImport = 'ebely',
    configImport = './ebely',
  } = args

  const specPath = resolve(process.cwd(), swaggerSchema)
  const outPath = resolve(process.cwd(), generateClientTo)

  const spec: Json = JSON.parse(await readFile(specPath, 'utf8'))
  const operations = collectOperations({ spec })
  const source = renderClient({
    spec,
    operations,
    internalStoreImport,
    configImport,
  })

  await writeFile(outPath, source, 'utf8')
  console.log(`
✅ Typed client written to:
${outPath}

Endpoints: ${operations.length}
`)
  return { outPath, operations: operations.length }
}
