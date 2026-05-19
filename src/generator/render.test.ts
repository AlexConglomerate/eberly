// Юнит-тесты генератора: renderClient — чистая функция «модель → текст»,
// тестируется без сети и без записи на диск.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderClient } from './render'
import type { Operation } from './operations'
import type { ClientMode } from '../config'

const spec = { info: { title: 'T', version: '1' }, servers: [{ url: '/api' }] }

const op: Operation = {
  group: 'posts',
  name: 'get',
  method: 'get',
  path: '/posts/{id}',
  pathParams: ['id'],
  queryParams: [],
  bodyType: null,
  bodyRequired: false,
  responseType: '{ "id": string }',
  responses: [{ status: 200, bodyType: '{ "id": string }' }],
  summary: 'Get a post',
}

const render = (mode: ClientMode) =>
  renderClient({
    spec,
    operations: [op],
    mode,
    internalStoreImport: 'ebely',
    configImport: './ebely',
  })

test("режим 'test': ApiResponse, карта статусов, request не бросает", () => {
  const out = render('test')
  assert.match(out, /import \{ InternalStore, ApiResponse, HookRegistry \} from "ebely"/)
  assert.match(out, /Promise<ApiResponse<\{ 200: \{ "id": string \} \}>>/)
  assert.match(out, /return \{ status: response\.status, body: data \}/)
  assert.doesNotMatch(out, /throw new Error\(/)
})

test("режим 'frontend': тело напрямую, без ApiResponse, request бросает", () => {
  const out = render('frontend')
  assert.match(out, /import \{ InternalStore, HookRegistry \} from "ebely"/)
  assert.doesNotMatch(out, /ApiResponse/)
  assert.match(out, /Promise<\{ "id": string \}>/)
  assert.match(out, /throw new Error\(/)
})

test('оба режима: типизированное дерево хуков + проводка в request', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = render(mode)
    // публичный тип регистратора и дерево
    assert.match(out, /export type Hooks</)
    assert.match(out, /type EbelyHookTree<Store extends InternalStore> = \{/)
    assert.match(out, /before\(fn: BeforeHook<Store, undefined>\): void/)
    assert.match(out, /after\(fn: AfterHook<Store, undefined, \{ "id": string \}>\): void/)
    assert.match(out, /import type \{ BeforeHook, AfterHook \} from "ebely"/)
    // реестр на World и применение конфиг-регистратора
    assert.match(out, /private hookRegistry = new HookRegistry\(\)/)
    assert.match(out, /if \(registrar\) registrar\(this\.buildHookTree\(\)\)/)
    // ключ операции и прогон до/после в общем request
    assert.match(out, /opKey: "posts\.get"/)
    assert.match(out, /await registry\.runBefore\(\{ key: opKey, request: hookReq, ctx: store \}\)/)
    assert.match(out, /await registry\.runAfter\(\{/)
  }
})

test('оба режима: путь, метод и summary на месте', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = render(mode)
    assert.match(out, /\/\*\* Get a post \*\//)
    assert.match(out, /method: "GET"/)
    assert.match(out, /path: "\/posts\/\{id\}"/)
  }
})
