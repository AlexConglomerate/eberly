// Юнит-тесты папки `api/` для агента: renderEndpointDocs — чистая функция
// «модель операций → список файлов», без сети и без диска.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ClientMode } from '../config'
import { DOCS_MARKER, renderEndpointDocs, renderExampleValue } from './docs'
import { buildSchemaNames } from './names'
import { collectOperations } from './operations'
import { makeSpec } from './test-utils'
import type { Json } from './types'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const json = (schema: Json) => ({ content: { 'application/json': { schema } } })

const spec = makeSpec({
  schemas: {
    CreatePostDto: {
      type: 'object',
      required: ['title', 'status'],
      properties: {
        title: { type: 'string', description: 'Post title', example: 'Hello' },
        status: { type: 'string', enum: ['draft', 'published'] },
        tags: { type: 'array', items: { type: 'string' } },
      },
    },
    PostDto: {
      type: 'object',
      required: ['id', 'comments'],
      properties: { id: { type: 'number' }, comments: { type: 'array', items: ref('CommentDto') } },
    },
    CommentDto: {
      type: 'object',
      required: ['text', 'parent'],
      properties: { text: { type: 'string' }, parent: ref('CommentDto'), replies: { type: 'array', items: ref('CommentDto') } },
    },
    ErrorDto: { type: 'object', properties: { message: { type: 'string' } } },
    Unused: { type: 'object' },
  },
  paths: {
    '/posts': {
      get: { operationId: 'posts.list', tags: ['posts'], summary: 'List posts', responses: { 200: json({ type: 'array', items: ref('PostDto') }) } },
      post: {
        operationId: 'posts.create',
        tags: ['posts'],
        summary: 'Create a post',
        description: 'Only for authenticated users.',
        requestBody: { required: true, ...json(ref('CreatePostDto')) },
        responses: {
          201: json(ref('PostDto')),
          400: { description: 'Empty title.', ...json(ref('ErrorDto')) },
        },
      },
    },
    '/posts/{id}': {
      delete: {
        operationId: 'posts.delete',
        tags: ['posts'],
        parameters: [{ name: 'id', in: 'path', schema: { type: 'integer', example: 7 } }],
        responses: { 204: { description: 'Deleted' } },
      },
    },
    '/comments': {
      post: {
        operationId: 'comments.create',
        tags: ['comments'],
        requestBody: { required: true, ...json(ref('CommentDto')) },
        responses: { 201: json(ref('CommentDto')) },
      },
    },
    '/auth/whoami': {
      get: { operationId: 'auth.whoami', tags: ['auth'], summary: 'Current user', deprecated: true, responses: { 200: json(ref('ErrorDto')) } },
    },
  },
})

function docs(mode: ClientMode = 'test'): Map<string, string> {
  const names = buildSchemaNames({ spec })
  const operations = collectOperations({ spec, names })
  return new Map(renderEndpointDocs({ spec, operations, names, mode }).map((f) => [f.fileName, f.content]))
}

/** Содержимое ```ts-блока под заголовком `## <section>`. */
function section(args: { content: string; title: string }): string {
  const { content, title } = args
  const start = content.indexOf(`## ${title}\n\`\`\`ts\n`)
  assert.ok(start !== -1, `нет секции ${title}`)
  const body = content.slice(start + `## ${title}\n\`\`\`ts\n`.length)
  return body.slice(0, body.indexOf('\n```'))
}

test('имена файлов: INDEX.md + <группа>.<метод>.md', () => {
  assert.deepEqual(
    [...docs().keys()],
    ['INDEX.md', 'posts.list.md', 'posts.create.md', 'posts.delete.md', 'comments.create.md', 'auth.whoami.md'],
  )
})

test('маркер в первой строке каждого файла', () => {
  for (const content of docs().values()) assert.equal(content.split('\n')[0], DOCS_MARKER)
})

test('INDEX.md: строка на эндпоинт, группировка, deprecated помечен', () => {
  const index = docs().get('INDEX.md')!
  assert.ok(
    index.includes(
      [
        '## posts',
        '- posts.list — GET /posts — List posts',
        '- posts.create — POST /posts — Create a post',
        '- posts.delete — DELETE /posts/{id}',
        '',
        '## comments',
        '- comments.create — POST /comments',
        '',
        '## auth',
        '- auth.whoami — GET /auth/whoami — Current user (deprecated)',
      ].join('\n'),
    ),
  )
})

test('файл эндпоинта: заголовок, summary, description, вход, ответы', () => {
  const content = docs().get('posts.create.md')!
  assert.match(content, /^# posts\.create — POST \/posts\n\nCreate a post\n\nOnly for authenticated users\.\n/m)
  assert.equal(section({ content, title: 'Input' }), '{ body: CreatePostDto }')
  assert.equal(section({ content, title: 'Responses' }), '201: PostDto\n400: ErrorDto // Empty title.')
})

test('пример вызова: только обязательные поля, example и первое значение enum', () => {
  const call = section({ content: docs().get('posts.create.md')!, title: 'Call' })
  assert.equal(
    call,
    'const res = await user.posts.create({ body: { title: "Hello", status: "draft" } })\nres.assert(201)',
  )
})

test('пример вызова: path-параметр строкой из example, assert с первым 2xx', () => {
  const call = section({ content: docs().get('posts.delete.md')!, title: 'Call' })
  assert.equal(call, 'const res = await user.posts.delete({ path: { id: "7" } })\nres.assert(204)')
})

test('frontend: вызов без assert', () => {
  const call = section({ content: docs('frontend').get('posts.create.md')!, title: 'Call' })
  assert.doesNotMatch(call, /assert/)
  assert.match(call, /^const data = await user\.posts\.create\(/)
})

test('Types: транзитивно, каждый ровно раз, рекурсия конечна, лишних нет', () => {
  const content = docs().get('posts.create.md')!
  const types = section({ content, title: 'Types' })
  for (const name of ['CreatePostDto', 'PostDto', 'CommentDto', 'ErrorDto']) {
    assert.equal(types.match(new RegExp(`^type ${name} =`, 'gm'))?.length, 1, name)
  }
  assert.doesNotMatch(types, /Unused/)
  assert.match(types, / {2}\/\*\* Post title \*\/\n {2}"title": string/)
})

test('рекурсивная схема в теле: пример конечен', () => {
  const call = section({ content: docs().get('comments.create.md')!, title: 'Call' })
  assert.match(call, /body: \{ text: "string", parent: \{\} \}/)
})

test('deprecated: пометка в файле эндпоинта', () => {
  assert.match(docs().get('auth.whoami.md')!, /^# auth\.whoami — GET \/auth\/whoami\n\n\*\*Deprecated\.\*\*\n/m)
})

test('renderExampleValue: заглушки по типам и глубина', () => {
  const value = (schema: Json) => renderExampleValue({ schema, spec: {} })
  assert.equal(value({ type: 'string' }), 'string')
  assert.equal(value({ type: 'integer' }), 0)
  assert.equal(value({ type: 'boolean' }), true)
  assert.deepEqual(value({ type: 'array', items: { type: 'string' } }), [])
  assert.equal(value({ type: 'string', format: 'binary' }), './path/to/file')
  assert.equal(value({ type: ['null', 'number'] }), 0)
  const deep = (n: number): Json =>
    n === 0 ? { type: 'string' } : { type: 'object', required: ['x'], properties: { x: deep(n - 1) } }
  assert.deepEqual(value(deep(5)), { x: { x: { x: {} } } })
})

test('длинный пример переносится построчно', () => {
  const long = makeSpec({
    paths: {
      '/u': {
        post: {
          operationId: 'u.create',
          requestBody: {
            required: true,
            ...json({
              type: 'object',
              required: ['firstName', 'lastName', 'email'],
              properties: {
                firstName: { type: 'string', example: 'Alexander' },
                lastName: { type: 'string', example: 'Konstantinopolsky' },
                email: { type: 'string', example: 'alexander@example.com' },
              },
            }),
          },
          responses: {},
        },
      },
    },
  })
  const names = buildSchemaNames({ spec: long })
  const [, file] = renderEndpointDocs({ spec: long, operations: collectOperations({ spec: long, names }), names, mode: 'test' })
  assert.match(
    file!.content,
    /user\.u\.create\(\{\n {2}body: \{\n {4}firstName: "Alexander",\n {4}lastName: "Konstantinopolsky",\n {4}email: "alexander@example\.com",\n {2}\},\n\}\)/,
  )
})
