// Юнит-тесты конвейера buildClient: мини-спека → исходник + api/, без IO.
// Плюс сторож: всё, что тянет конвейер (и parse.ts), бандлится в браузер
// для плейграунда сайта — `node:`-импортов там быть не должно.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildClient } from './pipeline'
import { makeSpec } from './test-utils'

const spec = makeSpec({
  schemas: {
    Post: {
      type: 'object',
      properties: { id: { type: 'number' }, title: { type: 'string' } },
      required: ['id', 'title'],
    },
  },
  paths: {
    '/posts': {
      post: {
        operationId: 'posts.create',
        tags: ['posts'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Post' } } },
        },
        responses: {
          201: { description: '', content: { 'application/json': { schema: { $ref: '#/components/schemas/Post' } } } },
        },
      },
    },
  },
})

test('buildClient: исходник, операции и api/ из одной спеки', () => {
  const out = buildClient({ spec, mode: 'test', userStoreImport: 'eberly', configImport: './eberly' })

  assert.deepEqual(
    out.operations.map((op) => `${op.group}.${op.name}`),
    ['posts.create'],
  )
  assert.match(out.source, /export type Post = \{/)
  assert.match(out.source, /import \{ eberly \} from "\.\/eberly"/)
  assert.match(out.source, /Promise<ApiResponse<\{ 201: Post \}>>/)
  assert.deepEqual(
    out.docs.map((d) => d.fileName),
    ['INDEX.md', 'posts.create.md'],
  )
})

test('buildClient: userStoreImport / configImport попадают в импорты', () => {
  const { source } = buildClient({ spec, mode: 'frontend', userStoreImport: '../lib', configImport: './cfg' })
  assert.match(source, /from "\.\.\/lib"/)
  assert.match(source, /import \{ eberly \} from "\.\/cfg"/)
})

test('buildClient: неподдерживаемая версия → ошибка', () => {
  assert.throws(
    () => buildClient({ spec: { swagger: '2.0' }, mode: 'test', userStoreImport: 'eberly', configImport: './eberly' }),
    /got Swagger 2\.0/,
  )
})

test('конвейер и parse.ts не импортируют node:* (бандлятся в браузер)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const seen = new Set<string>()
  const visit = (file: string): void => {
    if (seen.has(file)) return
    seen.add(file)
    // `import type` стирается при сборке — его не считаем (config.ts → swagger.ts).
    const text = readFileSync(file, 'utf8').replace(/^\s*(?:import|export)\s+type\b[^;]*?from\s*['"][^'"]+['"]/gm, '')
    const specifiers = [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!)
    for (const s of specifiers) {
      assert.ok(!s.startsWith('node:'), `${file} imports ${s}`)
      if (s.startsWith('.')) visit(resolve(dirname(file), `${s}.ts`))
    }
  }
  visit(join(here, 'pipeline.ts'))
  visit(join(here, 'parse.ts'))
  assert.ok(seen.size > 5)
})
