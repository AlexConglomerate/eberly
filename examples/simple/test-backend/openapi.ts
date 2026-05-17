import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'

import { router } from './router'

export const openAPIGenerator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
})

/** Собирает OpenAPI / Swagger-схему из oRPC-роутера. */
export function generateOpenAPISpec() {
  return openAPIGenerator.generate(router, {
    info: {
      title: 'Test Backend (oRPC)',
      version: '1.0.0',
      description: 'CRUD-эндпоинты для постов. Данные хранятся в памяти.',
    },
    servers: [{ url: '/api' }],
  })
}
