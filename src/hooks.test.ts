// Юнит-тесты рантайм-ядра хуков: HookRegistry — чистый класс без сети.
// Проверяем порядок, async-ожидание, мутацию запроса в before, ctx и
// no-op на незарегистрированном ключе.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HookRegistry, type HookRequest } from './hooks'

function makeRequest(over: Partial<HookRequest> = {}): HookRequest {
  return {
    method: 'POST',
    path: '/posts',
    pathParams: {},
    query: {},
    body: undefined,
    headers: {},
    ...over,
  }
}

test('before/after выполняются по очереди в порядке регистрации', async () => {
  const reg = new HookRegistry()
  const calls: string[] = []

  reg.before({ key: 'posts.create', fn: () => void calls.push('b1') })
  reg.before({ key: 'posts.create', fn: () => void calls.push('b2') })
  reg.after({ key: 'posts.create', fn: () => void calls.push('a1') })
  reg.after({ key: 'posts.create', fn: () => void calls.push('a2') })

  await reg.runBefore({ key: 'posts.create', request: makeRequest(), ctx: {} })
  await reg.runAfter({
    key: 'posts.create',
    request: makeRequest(),
    response: { status: 200, body: {} },
    ctx: {},
  })

  assert.deepEqual(calls, ['b1', 'b2', 'a1', 'a2'])
})

test('async-хуки ожидаются (await), а не запускаются «внахлёст»', async () => {
  const reg = new HookRegistry()
  const order: string[] = []

  reg.before({
    key: 'posts.create',
    fn: async () => {
      await new Promise((r) => setTimeout(r, 10))
      order.push('slow')
    },
  })
  reg.before({ key: 'posts.create', fn: () => void order.push('fast') })

  await reg.runBefore({ key: 'posts.create', request: makeRequest(), ctx: {} })

  assert.deepEqual(order, ['slow', 'fast'])
})

test('before может мутировать запрос — изменения видны вызывающему', async () => {
  const reg = new HookRegistry()
  reg.before({
    key: 'posts.list',
    fn: ({ request, ctx }) => {
      request.headers['x-trace'] = 'abc'
      request.query.afterId = (ctx as { last: string }).last
    },
  })

  const request = makeRequest({ method: 'GET', path: '/posts' })
  await reg.runBefore({ key: 'posts.list', request, ctx: { last: 'p_7' } })

  assert.equal(request.headers['x-trace'], 'abc')
  assert.equal(request.query.afterId, 'p_7')
})

test('after получает response и тот же ctx, что и запрос', async () => {
  const reg = new HookRegistry()
  const ctx = { store: new Map<string, unknown>() }
  reg.after({
    key: 'posts.create',
    fn: ({ response, ctx }) => {
      const c = ctx as { store: Map<string, unknown> }
      c.store.set('lastPostId', (response.body as { id: string }).id)
    },
  })

  await reg.runAfter({
    key: 'posts.create',
    request: makeRequest(),
    response: { status: 200, body: { id: 'p_42' } },
    ctx,
  })

  assert.equal(ctx.store.get('lastPostId'), 'p_42')
})

test('глобальные хуки срабатывают на любой ключ', async () => {
  const reg = new HookRegistry()
  const calls: string[] = []

  reg.allBefore({ fn: () => void calls.push('gb') })
  reg.allAfter({ fn: () => void calls.push('ga') })

  await reg.runBefore({ key: 'posts.create', request: makeRequest(), ctx: {} })
  await reg.runBefore({ key: 'users.list', request: makeRequest(), ctx: {} })
  await reg.runAfter({
    key: 'anything.else',
    request: makeRequest(),
    response: { status: 200, body: {} },
    ctx: {},
  })

  assert.deepEqual(calls, ['gb', 'gb', 'ga'])
})

test('порядок: global before → per-key before; per-key after → global after', async () => {
  const reg = new HookRegistry()
  const calls: string[] = []

  reg.before({ key: 'posts.create', fn: () => void calls.push('keyBefore') })
  reg.after({ key: 'posts.create', fn: () => void calls.push('keyAfter') })
  reg.allBefore({ fn: () => void calls.push('globalBefore') })
  reg.allAfter({ fn: () => void calls.push('globalAfter') })

  await reg.runBefore({ key: 'posts.create', request: makeRequest(), ctx: {} })
  await reg.runAfter({
    key: 'posts.create',
    request: makeRequest(),
    response: { status: 200, body: {} },
    ctx: {},
  })

  assert.deepEqual(calls, [
    'globalBefore',
    'keyBefore',
    'keyAfter',
    'globalAfter',
  ])
})

test('глобальный before может мутировать запрос (напр. заголовок авторизации)', async () => {
  const reg = new HookRegistry()
  reg.allBefore({
    fn: ({ request, ctx }) => {
      const token = (ctx as { token: string }).token
      request.headers.Authorization = `Bearer ${token}`
    },
  })

  const request = makeRequest()
  await reg.runBefore({ key: 'posts.create', request, ctx: { token: 't_1' } })

  assert.equal(request.headers.Authorization, 'Bearer t_1')
})

test('незарегистрированный ключ — no-op, без ошибок', async () => {
  const reg = new HookRegistry()
  await reg.runBefore({ key: 'unknown.op', request: makeRequest(), ctx: {} })
  await reg.runAfter({
    key: 'unknown.op',
    request: makeRequest(),
    response: { status: 204, body: undefined },
    ctx: {},
  })
  assert.ok(true)
})
