// Слой «какую версию OpenAPI мы умеем генерировать».
//
// 3.1 — основная, 3.0 — тоже (два отличия от 3.1 — `nullable: true` и
// `format: binary` — обрабатывает schema.ts). Swagger 2.0 и всё прочее —
// понятная ошибка сразу после загрузки схемы, а не мусорный клиент.

import type { Json } from './types'

const SUPPORTED = 'eberly supports OpenAPI 3.0 and 3.1'

/** Бросает понятную ошибку, если версия схемы не 3.0.x / 3.1.x. */
export function assertSupportedVersion(args: { spec: Json }): void {
  const { spec } = args
  const { openapi, swagger } = spec

  if (typeof openapi === 'string' && /^3\.[01](\.|$)/.test(openapi)) return

  if (openapi !== undefined) {
    throw new Error(`${SUPPORTED}, got openapi: ${JSON.stringify(openapi)}.`)
  }
  if (String(swagger) === '2.0') {
    throw new Error(
      `${SUPPORTED}, got Swagger 2.0. Convert the spec (e.g. with swagger2openapi) or switch your generator to OpenAPI 3.`,
    )
  }
  if (swagger !== undefined) {
    throw new Error(`${SUPPORTED}, got swagger: ${JSON.stringify(swagger)}.`)
  }
  throw new Error(`${SUPPORTED}, but the spec has no "openapi" field.`)
}
