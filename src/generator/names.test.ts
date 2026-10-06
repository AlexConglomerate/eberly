// Юнит-тесты имён: типы для components/schemas и группы операций.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSchemaNames, toGroupName, toTypeName } from './names'
import { makeSpec } from './test-utils'

test('имя типа: ключ схемы санитизируется в PascalCase', () => {
  assert.equal(toTypeName('post.create'), 'PostCreate')
  assert.equal(toTypeName('Page<Post>'), 'PagePost')
  assert.equal(toTypeName('user-dto'), 'UserDto')
  assert.equal(toTypeName('UserDto'), 'UserDto')
})

test('имя типа: начинается с цифры → префикс Schema', () => {
  assert.equal(toTypeName('1st'), 'Schema1st')
})

test('имя типа: зарезервированное → суффикс Schema', () => {
  assert.equal(toTypeName('File'), 'FileSchema')
  assert.equal(toTypeName('Array'), 'ArraySchema')
  assert.equal(toTypeName('Store'), 'StoreSchema')
})

test('таблица имён: коллизии после санитизации разводятся по порядку ключей', () => {
  const spec = makeSpec({ schemas: { 'post.create': {}, 'post-create': {}, PostCreate: {} } })
  assert.deepEqual(
    [...buildSchemaNames({ spec }).entries()],
    [
      ['post.create', 'PostCreate'],
      ['post-create', 'PostCreate2'],
      ['PostCreate', 'PostCreate3'],
    ],
  )
})

test('таблица имён: зарезервированное имя не занимает чужое', () => {
  const spec = makeSpec({ schemas: { FileSchema: {}, File: {} } })
  assert.deepEqual([...buildSchemaNames({ spec }).values()], ['FileSchema', 'FileSchema2'])
})

test('группа: тег → camelCase', () => {
  assert.equal(toGroupName('Posts'), 'posts')
  assert.equal(toGroupName('User Management'), 'userManagement')
  assert.equal(toGroupName('user-profile'), 'userProfile')
  assert.equal(toGroupName('API Keys'), 'apiKeys')
})

test('группа: зарезервированное имя → суффикс Api', () => {
  assert.equal(toGroupName('store'), 'storeApi')
  assert.equal(toGroupName('Get'), 'getApi')
  assert.equal(toGroupName('Get Safe'), 'getSafeApi')
  assert.equal(toGroupName('api'), 'apiApi')
})

test('группа: без букв и цифр → пустая строка (фолбэк дальше)', () => {
  assert.equal(toGroupName('!!!'), '')
})
