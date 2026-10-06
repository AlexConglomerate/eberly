import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger'

/**
 * Сборка OpenAPI-документа — общая для сервера (`/swagger.json`) и
 * скрипта `swagger.ts`. Версию OpenAPI не трогаем: дефолт Nest — 3.0.
 */
export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Nest example API')
    .setDescription(
      'Blog backend: users, posts with drafts, nested comments, avatars. Data lives in memory.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build()

  // #region docs:operation-id
  return SwaggerModule.createDocument(app, config, {
    // `PostsController` + `create` → `posts.create` (default: `PostsController_create`).
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '').toLowerCase()}.${methodKey}`,
  })
  // #endregion
}
