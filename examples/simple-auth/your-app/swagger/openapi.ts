import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'

import { router } from '../src/router'

export const openAPIGenerator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
})

/** Собирает OpenAPI / Swagger-схему из oRPC-роутера. */
export function generateOpenAPISpec() {
  return openAPIGenerator.generate(router, {
    info: {
      title: 'Auth Backend (oRPC + BetterAuth)',
      version: '1.0.0',
      description:
        'BetterAuth (email+пароль, bearer, фейковый Google OAuth), SQLite, роли user/admin, CRUD постов.',
    },
    servers: [{ url: '/api' }],
  })
}
