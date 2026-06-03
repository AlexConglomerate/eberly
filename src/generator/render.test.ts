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
    userStoreImport: 'ebely',
    configImport: './ebely',
  })

test("режим 'test': ApiResponse, карта статусов, request не бросает", () => {
  const out = render('test')
  assert.match(out, /import \{ BaseStore, ApiResponse, HookRegistry \} from "ebely"/)
  assert.match(out, /Promise<ApiResponse<\{ 200: \{ "id": string \} \}>>/)
  assert.match(out, /return \{ status: response\.status, body: data \}/)
  assert.doesNotMatch(out, /throw new Error\(/)
})

test("режим 'frontend': тело напрямую, без ApiResponse, request бросает", () => {
  const out = render('frontend')
  assert.match(out, /import \{ BaseStore, HookRegistry \} from "ebely"/)
  assert.doesNotMatch(out, /ApiResponse/)
  assert.match(out, /Promise<\{ "id": string \}>/)
  assert.match(out, /throw new Error\(/)
})

test('оба режима: типизированное дерево хуков + проводка в request', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = render(mode)
    // публичный тип регистратора и дерево
    assert.match(out, /export type Hooks</)
    assert.match(out, /type EbelyHookTree<Store extends BaseStore> = \{/)
    assert.match(out, /before\(fn: BeforeHook<Store, undefined>\): void/)
    assert.match(out, /after\(fn: AfterHook<Store, undefined, \{ "id": string \}>\): void/)
    // глобальные хуки на все операции
    assert.match(out, /globalBefore\(fn: BeforeHook<Store>\): void/)
    assert.match(out, /globalAfter\(fn: AfterHook<Store>\): void/)
    assert.match(out, /globalRetry\(fn: RetryHook<Store>\): void/)
    assert.match(out, /globalBefore: \(fn: BeforeHook<Store>\) => r\.globalBefore\(\{ fn \}\)/)
    assert.match(out, /globalAfter: \(fn: AfterHook<Store>\) => r\.globalAfter\(\{ fn \}\)/)
    assert.match(out, /globalRetry: \(fn: RetryHook<Store>\) => r\.globalRetry\(\{ fn \}\)/)
    assert.match(out, /import type \{ BeforeHook, AfterHook, RetryHook \} from "ebely"/)
    // retry-цикл и обращение к runRetry в общем request
    assert.match(out, /const maxRetries = \(ebely as \{ maxRetries\?: number \}\)\.maxRetries \?\? 3/)
    assert.match(out, /await registry\.runRetry\(\{/)
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

test('сценарии: экспортируется тип WorldApi (дерево вызовов для this.api)', () => {
  const t = render('test')
  assert.match(t, /export type WorldApi = \{/)
  assert.match(
    t,
    /"get": \(input: \{ path: \{ "id": string \} \}\) => Promise<ApiResponse<\{ 200: \{ "id": string \} \}>>/,
  )
  const f = render('frontend')
  assert.match(
    f,
    /"get": \(input: \{ path: \{ "id": string \} \}\) => Promise<\{ "id": string \}>/,
  )
})

test('world-store: World наследует сконфигурированный worldStore', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = render(mode)
    assert.match(out, /type ConfiguredWorldStore =/)
    assert.match(out, /const WorldStoreBase = \(\(ebely as \{ worldStore\?:/)
    assert.match(out, /> extends WorldStoreBase \{/)
    // конструктор инициализирует super() и анонимный api для world
    assert.match(out, /super\(\)/)
    assert.match(
      out,
      /;\(this as unknown as \{ api: unknown \}\)\.api = this\.buildApiTree\(/,
    )
  }
})

test('сценарии: один движок request, общий buildApiTree, store.api', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = render(mode)
    assert.match(out, /private makeRequest\(cfg: \{/)
    assert.match(out, /private buildApiTree\(request: RequestFn\)/)
    // user-store получает то же дерево в .api (сценарии ходят от его лица)
    assert.match(
      out,
      /;\(store as unknown as \{ api: unknown \}\)\.api = tree/,
    )
    assert.match(out, /return Object\.assign\(store, tree\)/)
  }
})
