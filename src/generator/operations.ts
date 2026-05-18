// Слой «swagger.paths → плоский список операций».
//
// Берёт сырой документ схемы и превращает его в массив `Operation` —
// удобную промежуточную модель, по которой потом рендерится клиент.
// Группа и имя метода берутся из operationId: `posts.create` →
// группа `posts`, метод `create`.

import type { Json } from './types'
import { pickResponseSchema, schemaToType } from './schema'

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export interface Operation {
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

/** Собирает плоский список операций из секции paths. */
export function collectOperations(args: { spec: Json }): Operation[] {
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
