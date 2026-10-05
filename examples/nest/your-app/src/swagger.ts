import 'reflect-metadata'

import { mkdir, writeFile } from 'node:fs/promises'

import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'
import { createSwaggerDocument } from './openapi.js'

// Пишет swagger/swagger.json. Тестовый режим включён, чтобы в схему (и в
// сгенерированный по ней клиент) попал `POST /test/reset`.
const app = await NestFactory.create(AppModule.register({ testMode: true }), { logger: false })
const document = createSwaggerDocument(app)
await app.close()

const dir = new URL('../swagger/', import.meta.url)
await mkdir(dir, { recursive: true })
await writeFile(new URL('swagger.json', dir), `${JSON.stringify(document, null, 2)}\n`)
console.log('swagger/swagger.json written')
