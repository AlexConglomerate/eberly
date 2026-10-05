import 'reflect-metadata'

import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module.js'
import { createSwaggerDocument } from './openapi.js'

const PORT = Number(process.env.PORT ?? 3000)
const TEST_MODE = process.env.TEST_MODE === '1'

const app = await NestFactory.create(AppModule.register({ testMode: TEST_MODE }))
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))

// `/docs` — Swagger UI, `/swagger.json` — схема.
SwaggerModule.setup('docs', app, createSwaggerDocument(app), { jsonDocumentUrl: 'swagger.json' })

await app.listen(PORT)
console.log(`Nest example API on http://localhost:${PORT} (docs: /docs${TEST_MODE ? ', TEST_MODE' : ''})`)
