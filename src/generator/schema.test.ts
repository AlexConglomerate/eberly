// Юнит-тесты схемы: isFileSchema (детект файла 3.1) и schemaToType для
// файловых узлов. Чистые функции, без сети.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFileSchema, schemaToType } from './schema'

const spec = {}

test('isFileSchema: 3.1 = string + contentMediaType', () => {
  assert.equal(isFileSchema({ type: 'string', contentMediaType: 'image/*' }), true)
  assert.equal(isFileSchema({ type: 'string' }), false)
  assert.equal(isFileSchema({ type: 'object' }), false)
  assert.equal(isFileSchema(undefined), false)
})

test('schemaToType: файловый узел 3.1 → FileInput', () => {
  assert.equal(
    schemaToType({ schema: { type: 'string', contentMediaType: 'image/*' }, spec }),
    'FileInput',
  )
})

test('schemaToType: массив файлов → Array<FileInput>', () => {
  assert.equal(
    schemaToType({
      schema: { type: 'array', items: { type: 'string', contentMediaType: 'image/*' } },
      spec,
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
  })
  assert.match(out, /"files": Array<FileInput>/)
})

test('schemaToType: обычная строка остаётся string', () => {
  assert.equal(schemaToType({ schema: { type: 'string' }, spec }), 'string')
})
