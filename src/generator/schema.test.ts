// Юнит-тесты схемы: isFileSchema (детект файла 3.1/3.0), schemaToType
// (файлы, именованные типы, рекурсия, nullable из 3.0) и блок объявлений.
// Чистые функции, без сети.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSchemaNames } from './names'
import { isFileSchema, paramSchemaToType, renderSchemaDecls, schemaToType } from './schema'
import { makeSpec } from './test-utils'
import type { Json } from './types'

const spec = {}
const names = new Map<string, string>()

test('isFileSchema: 3.1 = string + contentMediaType', () => {
  assert.equal(isFileSchema({ type: 'string', contentMediaType: 'image/*' }), true)
  assert.equal(isFileSchema({ type: 'string' }), false)
  assert.equal(isFileSchema({ type: 'object' }), false)
  assert.equal(isFileSchema(undefined), false)
})

test('schemaToType: файловый узел 3.1 → FileInput', () => {
  assert.equal(
    schemaToType({ schema: { type: 'string', contentMediaType: 'image/*' }, spec, names }),
    'FileInput',
  )
})

test('schemaToType: массив файлов → Array<FileInput>', () => {
  assert.equal(
    schemaToType({
      schema: { type: 'array', items: { type: 'string', contentMediaType: 'image/*' } },
      spec,
      names,
    }),
    'Array<FileInput>',
  )
})

test('schemaToType: объект с файловым полем', () => {
  const out = schemaToType({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: { type: 'array', items: { type: 'string', contentMediaType: 'image/*' } },
      },
    },
    spec,
    names,
  })
  assert.match(out, /"files": Array<FileInput>/)
})

test('schemaToType: обычная строка остаётся string', () => {
  assert.equal(schemaToType({ schema: { type: 'string' }, spec, names }), 'string')
})

// --- именованные типы и OpenAPI 3.0 ---------------------------------------

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

/** Спека + таблица имён — как их строит generateClient. */
function withSchemas(schemas: Json) {
  const spec = makeSpec({ schemas })
  return { spec, names: buildSchemaNames({ spec }) }
}

test('$ref на схему → имя типа, без разворота', () => {
  const ctx = withSchemas({ PostDto: { type: 'object', properties: { id: { type: 'number' } } } })
  assert.equal(schemaToType({ schema: ref('PostDto'), ...ctx }), 'PostDto')
  assert.equal(
    schemaToType({ schema: { type: 'array', items: ref('PostDto') }, ...ctx }),
    'Array<PostDto>',
  )
})

test('$ref на схему с несанитарным ключом → санитизированное имя', () => {
  const ctx = withSchemas({ 'post.create': { type: 'object' } })
  assert.equal(schemaToType({ schema: ref('post.create'), ...ctx }), 'PostCreate')
})

test('рекурсивная схема рендерится без исключения', () => {
  const ctx = withSchemas({
    CommentDto: {
      type: 'object',
      required: ['replies'],
      properties: { replies: { type: 'array', items: ref('CommentDto') } },
    },
  })
  const decls = renderSchemaDecls(ctx)
  assert.match(decls, /export type CommentDto = \{\n {2}"replies": Array<CommentDto>\n\}/)
})

test('$ref в другой раздел components разворачивается', () => {
  const spec = makeSpec()
  spec.components.responses = { Ok: { type: 'string' } }
  assert.equal(
    schemaToType({ schema: { $ref: '#/components/responses/Ok' }, spec, names: new Map() }),
    'string',
  )
})

test('3.0 nullable: примитив → T | null', () => {
  assert.equal(schemaToType({ schema: { type: 'string', nullable: true }, spec, names }), 'string | null')
})

test('Nest: { description, allOf: [$ref] } → просто имя', () => {
  const ctx = withSchemas({ UserDto: { type: 'object' } })
  assert.equal(
    schemaToType({ schema: { description: 'The user.', allOf: [ref('UserDto')] }, ...ctx }),
    'UserDto',
  )
})

test('Nest: nullable DTO { nullable, type: object, allOf: [$ref] } → X | null', () => {
  const ctx = withSchemas({ UserDto: { type: 'object' } })
  assert.equal(
    schemaToType({ schema: { nullable: true, type: 'object', allOf: [ref('UserDto')] }, ...ctx }),
    'UserDto | null',
  )
})

test('Nest: nullable-массив → Array<X> | null', () => {
  const ctx = withSchemas({ CommentDto: { type: 'object' } })
  assert.equal(
    schemaToType({ schema: { nullable: true, type: 'array', items: ref('CommentDto') }, ...ctx }),
    'Array<CommentDto> | null',
  )
})

test('allOf: union внутри пересечения берётся в скобки', () => {
  const ctx = withSchemas({ A: { type: 'object' }, B: { type: 'object' } })
  assert.equal(
    schemaToType({ schema: { allOf: [{ ...ref('A'), nullable: true }, ref('B')] }, ...ctx }),
    '(A | null) & B',
  )
})

test('3.0 format: binary → FileInput, format: byte → string', () => {
  assert.equal(isFileSchema({ type: 'string', format: 'binary' }), true)
  assert.equal(schemaToType({ schema: { type: 'string', format: 'binary' }, spec, names }), 'FileInput')
  assert.equal(schemaToType({ schema: { type: 'string', format: 'byte' }, spec, names }), 'string')
})

test('3.1 type: [string, null] работает как раньше', () => {
  assert.equal(schemaToType({ schema: { type: ['string', 'null'] }, spec, names }), 'string | null')
})

test('renderSchemaDecls: без схем → пустая строка', () => {
  assert.equal(renderSchemaDecls(withSchemas({})), '')
})

test('paramSchemaToType: примитивы → TS-тип, integer → number', () => {
  const type = (schema: Json | undefined) => paramSchemaToType({ schema, spec })
  assert.equal(type({ type: 'string' }), 'string')
  assert.equal(type({ type: 'number' }), 'number')
  assert.equal(type({ type: 'integer', format: 'int64' }), 'number')
  assert.equal(type({ type: 'boolean' }), 'boolean')
  assert.equal(type({ type: ['integer', 'string'] }), 'number | string')
})

test('paramSchemaToType: null отбрасывается (nullable, 3.1, enum)', () => {
  const type = (schema: Json) => paramSchemaToType({ schema, spec })
  assert.equal(type({ type: 'integer', nullable: true }), 'number')
  assert.equal(type({ type: ['integer', 'null'] }), 'number')
  assert.equal(type({ enum: ['draft', 'published', null] }), '"draft" | "published"')
})

test('paramSchemaToType: enum и $ref на enum → union литералов', () => {
  const withEnum = makeSpec({ schemas: { Status: { type: 'string', enum: ['draft', 'published'] } } })
  assert.equal(paramSchemaToType({ schema: { enum: [1, 2] }, spec }), '1 | 2')
  assert.equal(
    paramSchemaToType({ schema: { $ref: '#/components/schemas/Status' }, spec: withEnum }),
    '"draft" | "published"',
  )
})

test('paramSchemaToType: нет схемы / сложная схема → null (фолбэк у вызывающего)', () => {
  const type = (schema: Json | undefined) => paramSchemaToType({ schema, spec })
  assert.equal(type(undefined), null)
  assert.equal(type({}), null)
  assert.equal(type({ type: 'array', items: { type: 'string' } }), null)
  assert.equal(type({ type: 'object' }), null)
  assert.equal(type({ type: 'null' }), null)
  assert.equal(type({ enum: [{ a: 1 }] }), null)
  assert.equal(type({ $ref: '#/components/schemas/Missing' }), null)
})
