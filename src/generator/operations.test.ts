// Юнит-тесты сборщика операций: collectOperations — чистая функция
// «spec.paths → плоский список», тестируется без сети.
//
// Главный фокус — разведение коллизий имён (dedupeNames): один
// operationId на GET и POST одного пути не должен давать два одноимённых
// свойства (классика better-auth `getSession`).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSchemaNames } from './names'
import { collectOperations } from './operations'
import { makeSpec } from './test-utils'
import type { Json } from './types'

const ok = {
  responses: { 200: { description: 'ok' } },
}

const collect = (spec: Json) => collectOperations({ spec, names: buildSchemaNames({ spec }) })

test('коллизия имени на GET+POST одного пути: метод дописывается спереди', () => {
  const spec: Json = {
    paths: {
      '/auth/get-session': {
        get: { operationId: 'auth.getSession', ...ok },
        post: { operationId: 'auth.getSession', ...ok },
      },
    },
  }
  const ops = collect(spec)
  const names = ops.map((o) => o.name).sort()
  assert.deepEqual(names, ['getGetSession', 'postGetSession'])
  // группа сохраняется
  assert.deepEqual([...new Set(ops.map((o) => o.group))], ['auth'])
})

test('уникальные имена не трогаются', () => {
  const spec: Json = {
    paths: {
      '/posts': {
        get: { operationId: 'posts.list', ...ok },
        post: { operationId: 'posts.create', ...ok },
      },
    },
  }
  const ops = collect(spec)
  assert.deepEqual(
    ops.map((o) => o.name).sort(),
    ['create', 'list'],
  )
})

test('коллизия только внутри своей группы; чужая группа не затрагивается', () => {
  const spec: Json = {
    paths: {
      '/auth/session': {
        get: { operationId: 'auth.session', ...ok },
        post: { operationId: 'auth.session', ...ok },
      },
      '/posts': {
        get: { operationId: 'posts.session', ...ok },
      },
    },
  }
  const ops = collect(spec)
  const auth = ops.filter((o) => o.group === 'auth').map((o) => o.name).sort()
  const posts = ops.filter((o) => o.group === 'posts').map((o) => o.name)
  assert.deepEqual(auth, ['getSession', 'postSession'])
  assert.deepEqual(posts, ['session'])
})

test('остаточная коллизия (тот же метод + имя на разных путях) → числовой суффикс', () => {
  const spec: Json = {
    paths: {
      '/a': { get: { operationId: 'x.ping', ...ok } },
      '/b': { get: { operationId: 'x.ping', ...ok } },
    },
  }
  const ops = collect(spec)
  // оба GET → оба префиксуются методом, второй получает суффикс
  assert.deepEqual(
    ops.map((o) => o.name).sort(),
    ['getPing', 'getPing2'],
  )
})

test('multipart (oRPC 3.1): isMultipart + fileFields для массива файлов', () => {
  // oRPC кладёт СРАЗУ два content-типа с одинаковой схемой; файл в 3.1 —
  // { type:'string', contentMediaType }.
  const fileItem = { type: 'string', contentMediaType: 'image/*' }
  const bodySchema = {
    type: 'object',
    required: ['files'],
    properties: { files: { type: 'array', items: fileItem } },
  }
  const spec: Json = {
    paths: {
      '/word-cards/screenshots': {
        post: {
          operationId: 'wordCard.upload',
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: bodySchema },
              'multipart/form-data': { schema: bodySchema },
            },
          },
          ...ok,
        },
      },
    },
  }
  const op = collect(spec)[0]!
  assert.equal(op.isMultipart, true)
  assert.deepEqual(op.fileFields, [{ name: 'files', array: true }])
  // тип тела — Array<FileInput>, а не Array<string>
  assert.match(op.bodyType!, /"files": Array<FileInput>/)
})

test('multipart: одиночный файл → array:false', () => {
  const spec: Json = {
    paths: {
      '/avatar': {
        post: {
          operationId: 'user.avatar',
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: { avatar: { type: 'string', contentMediaType: 'image/png' } },
                },
              },
            },
          },
          ...ok,
        },
      },
    },
  }
  const op = collect(spec)[0]!
  assert.equal(op.isMultipart, true)
  assert.deepEqual(op.fileFields, [{ name: 'avatar', array: false }])
})

test('обычный JSON-эндпоинт: isMultipart false, fileFields пуст', () => {
  const spec: Json = {
    paths: {
      '/posts': {
        post: {
          operationId: 'posts.create',
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object', properties: { title: { type: 'string' } } },
              },
            },
          },
          ...ok,
        },
      },
    },
  }
  const op = collect(spec)[0]!
  assert.equal(op.isMultipart, false)
  assert.deepEqual(op.fileFields, [])
})

// --- группы по тегам -------------------------------------------------------

/** Группа единственной операции `get <path>` с заданными полями. */
function groupOf(args: { path?: string; op: Json }): string {
  const { path = '/posts', op } = args
  const spec = makeSpec({ paths: { [path]: { get: { ...op, ...ok } } } })
  return collect(spec)[0]!.group
}

test('группа: первый тег → camelCase', () => {
  assert.equal(groupOf({ op: { operationId: 'PostsController_list', tags: ['Posts'] } }), 'posts')
  assert.equal(groupOf({ op: { tags: ['User Management'] } }), 'userManagement')
})

test('группа: несколько тегов → берётся первый', () => {
  assert.equal(groupOf({ op: { tags: ['posts', 'admin'] } }), 'posts')
})

test('группа: тег важнее префикса operationId', () => {
  assert.equal(groupOf({ op: { operationId: 'blog.list', tags: ['Posts'] } }), 'posts')
})

test('группа: без тегов → префикс operationId до точки (старое поведение)', () => {
  const op = collect(makeSpec({ paths: { '/x': { get: { operationId: 'posts.list', ...ok } } } }))[0]!
  assert.equal(op.group, 'posts')
  assert.equal(op.name, 'list')
})

test('группа: без тегов и без точки → первый статический сегмент пути', () => {
  assert.equal(
    groupOf({ path: '/posts/{id}/comments', op: { operationId: 'read_items_items_get' } }),
    'posts',
  )
})

test('группа: путь без статических сегментов → default', () => {
  assert.equal(groupOf({ path: '/', op: {} }), 'default')
  assert.equal(groupOf({ path: '/{id}', op: {} }), 'default')
})

test('группа: зарезервированный тег → суффикс Api', () => {
  assert.equal(groupOf({ op: { tags: ['Store'] } }), 'storeApi')
})

test('multipart (3.0): format binary → isMultipart + fileFields', () => {
  const spec = makeSpec({
    openapi: '3.0.0',
    paths: {
      '/users/me/avatar': {
        post: {
          operationId: 'users.uploadAvatar',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: { file: { type: 'string', format: 'binary' } },
                },
              },
            },
          },
          ...ok,
        },
      },
    },
  })
  const op = collect(spec)[0]!
  assert.equal(op.isMultipart, true)
  assert.deepEqual(op.fileFields, [{ name: 'file', array: false }])
  assert.match(op.bodyType!, /"file": FileInput/)
})

test('$ref на схему в теле и ответе → имя типа', () => {
  const spec = makeSpec({
    schemas: { CreatePostDto: { type: 'object' }, PostDto: { type: 'object' } },
    paths: {
      '/posts': {
        post: {
          operationId: 'posts.create',
          requestBody: {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePostDto' } } },
          },
          responses: {
            201: { content: { 'application/json': { schema: { $ref: '#/components/schemas/PostDto' } } } },
          },
        },
      },
    },
  })
  const op = collect(spec)[0]!
  assert.equal(op.bodyType, 'CreatePostDto')
  assert.equal(op.responseType, 'PostDto')
  assert.deepEqual(
    op.responses.map((r) => ({ status: r.status, bodyType: r.bodyType })),
    [{ status: 201, bodyType: 'PostDto' }],
  )
})

test('описание, deprecated, параметры объектами и сырые схемы', () => {
  const bodySchema = { $ref: '#/components/schemas/CreatePostDto' }
  const spec = makeSpec({
    schemas: { CreatePostDto: { type: 'object' } },
    paths: {
      '/posts/{id}': {
        put: {
          operationId: 'posts.update',
          description: 'Long text',
          deprecated: true,
          parameters: [
            { name: 'id', in: 'path', description: 'Post id', schema: { type: 'string' } },
            { name: 'draft', in: 'query', schema: { type: 'boolean' } },
            { name: 'page', in: 'query', required: true },
          ],
          requestBody: { content: { 'application/json': { schema: bodySchema } } },
          responses: { 200: { description: 'Updated' } },
        },
      },
    },
  })
  const op = collect(spec)[0]!
  assert.equal(op.description, 'Long text')
  assert.equal(op.deprecated, true)
  assert.deepEqual(op.pathParams, [
    { name: 'id', description: 'Post id', required: true, schema: { type: 'string' } },
  ])
  assert.deepEqual(op.queryParams, [
    { name: 'draft', required: false, schema: { type: 'boolean' } },
    { name: 'page', required: true },
  ])
  assert.deepEqual(op.bodySchema, bodySchema)
  assert.deepEqual(op.responses, [
    { status: 200, bodyType: 'unknown', schema: undefined, description: 'Updated' },
  ])
})
