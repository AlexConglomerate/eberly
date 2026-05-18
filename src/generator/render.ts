// Слой «модель операций → исходный текст клиента».
//
// Здесь рождается содержимое будущего сгенерированного файла (world):
// класс `World` с методом `createUser()`, сгруппированными по
// operationId типизированными вызовами и общей функцией `request`.
// Это единственное место, где задаётся форма публичного API клиента.
//
// Форма зависит от режима (см. ClientMode):
//   - 'test'     → методы возвращают ApiResponse<{ статус: тело }> с .assert();
//                  request НЕ бросает на не-2xx — проверка через res.assert().
//   - 'frontend' → методы возвращают тело напрямую; request бросает на не-2xx.

import type { ClientMode } from '../config'
import type { Operation } from './operations'
import type { Json } from './types'

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

/** Тип-карта «статус → тело» для режима `'test'`: `{ 200: {...}; 404: {...} }`. */
function buildStatusMapType(op: Operation): string {
  const entries = op.responses.map((r) => `${r.status}: ${r.bodyType}`)
  return `{ ${entries.join('; ')} }`
}

/** Рендерит методы одной группы под выбранный режим. */
function renderMethod(args: { op: Operation; mode: ClientMode }): string {
  const { op, mode } = args
  const { type, optional } = buildInputType(op)
  const inputParam = `input${optional ? '?' : ''}: ${type}`
  const doc = op.summary ? `\n        /** ${op.summary} */` : ''
  const call = `request({
            method: ${JSON.stringify(op.method.toUpperCase())},
            path: ${JSON.stringify(op.path)},
            input: input as RequestInput,
          })`

  if (mode === 'frontend') {
    return `${doc}
        ${JSON.stringify(op.name)}: (${inputParam}): Promise<${op.responseType}> =>
          ${call} as Promise<${op.responseType}>,`
  }

  const map = buildStatusMapType(op)
  return `${doc}
        ${JSON.stringify(op.name)}: async (${inputParam}): Promise<ApiResponse<${map}>> => {
          const res = await ${call}
          return new ApiResponse(res) as unknown as ApiResponse<${map}>
        },`
}

/** Импорты сгенерированного файла (в режиме 'test' нужен ещё ApiResponse). */
function renderImports(args: { mode: ClientMode; internalStoreImport: string; configImport: string }): string {
  const { mode, internalStoreImport, configImport } = args
  const names = mode === 'frontend' ? 'InternalStore' : 'InternalStore, ApiResponse'
  return `import { ${names} } from ${JSON.stringify(internalStoreImport)}
import { ebely } from ${JSON.stringify(configImport)}`
}

/**
 * Хвост общей функции `request`: разбор тела и возврат.
 * - 'frontend' — бросает на не-2xx, возвращает только тело (`Promise<unknown>`);
 * - 'test'     — НЕ бросает, возвращает `{ status, body }` для `res.assert()`.
 */
function renderRequestTail(mode: ClientMode): { returnType: string; body: string } {
  if (mode === 'frontend') {
    return {
      returnType: 'unknown',
      body: `      const text = await response.text()
      const data = text ? JSON.parse(text) : undefined

      if (!response.ok) {
        throw new Error(
          \`Request \${method} \${resolvedPath} failed with \${response.status}: \${text}\`,
        )
      }

      return data`,
    }
  }

  return {
    returnType: '{ status: number; body: unknown }',
    body: `      const text = await response.text()
      let data: unknown
      try {
        data = text ? JSON.parse(text) : undefined
      } catch {
        data = text
      }

      return { status: response.status, body: data }`,
  }
}

/** Рендерит финальный исходник клиента (world). */
export function renderClient(args: {
  spec: Json
  operations: Operation[]
  mode: ClientMode
  internalStoreImport: string
  configImport: string
}): string {
  const { spec, operations, mode, internalStoreImport, configImport } = args
  const basePath: string = spec.servers?.[0]?.url ?? ''

  const groups = new Map<string, Operation[]>()
  for (const op of operations) {
    const list = groups.get(op.group) ?? []
    list.push(op)
    groups.set(op.group, list)
  }

  const groupBlocks = [...groups.entries()].map(([group, ops]) => {
    const methods = ops.map((op) => renderMethod({ op, mode }))
    return `      ${JSON.stringify(group)}: {\n${methods.join('\n')}\n      },`
  })

  const tail = renderRequestTail(mode)

  return `// AUTO-GENERATED by ebely (generateClient) — НЕ редактировать вручную.
// Источник: ${spec.info?.title ?? 'OpenAPI spec'} v${spec.info?.version ?? '?'}
// Режим клиента: ${mode}
// Перегенерация: pnpm run client:generate

${renderImports({ mode, internalStoreImport, configImport })}

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
    }): Promise<${tail.returnType}> => {
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

${tail.body}
    }

    return Object.assign(store, {
${groupBlocks.join('\n')}
    })
  }
}
`
}
