// Юнит-тесты ЧИСТОЙ логики проверки ответа: ни сети, ни fetch.
// Запуск: pnpm test (tsx --test).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ApiResponse,
  EberlyAssertionError,
  assertResponse,
  matchPartial,
} from './response'

test('matchPartial: совпадение по подмножеству полей возвращает null', () => {
  const m = matchPartial({
    actual: { id: '1', title: 'a', extra: true },
    expected: { id: '1' },
  })
  assert.equal(m, null)
})

test('matchPartial: расхождение в листе возвращает путь', () => {
  const m = matchPartial({
    actual: { user: { id: '1', name: 'Bob' } },
    expected: { user: { name: 'Alice' } },
  })
  assert.deepEqual(m, { path: 'user.name', expected: 'Alice', actual: 'Bob' })
})

test('matchPartial: массивы сверяются частично поэлементно', () => {
  assert.equal(
    matchPartial({ actual: [{ a: 1 }, { a: 2 }, { a: 3 }], expected: [{ a: 1 }] }),
    null,
  )
  assert.deepEqual(
    matchPartial({ actual: [{ a: 1 }, { a: 9 }], expected: [{ a: 1 }, { a: 2 }] }),
    { path: '[1].a', expected: 2, actual: 9 },
  )
})

test('matchPartial: тип-несовпадение объект vs примитив (путь = корень)', () => {
  const m = matchPartial({ actual: 'str', expected: { id: '1' } })
  assert.deepEqual(m, { path: '', expected: { id: '1' }, actual: 'str' })
})

test('assertResponse: статус не совпал → EberlyAssertionError', () => {
  assert.throws(
    () =>
      assertResponse({
        actualStatus: 500,
        actualBody: { error: 'boom' },
        expectedStatus: 200,
      }),
    (err: unknown) =>
      err instanceof EberlyAssertionError && /Expected status 200, got 500/.test(String(err)),
  )
})

test('assertResponse: тело не передано → проверяется только статус', () => {
  assert.doesNotThrow(() =>
    assertResponse({ actualStatus: 200, actualBody: { any: 1 }, expectedStatus: 200 }),
  )
})

test('assertResponse: частичное тело не совпало → ошибка с путём', () => {
  assert.throws(
    () =>
      assertResponse({
        actualStatus: 200,
        actualBody: { id: '1', authorId: 'x' },
        expectedStatus: 200,
        expectedBody: { authorId: 'y' },
      }),
    (err: unknown) => err instanceof EberlyAssertionError && /authorId/.test(String(err)),
  )
})

test('ApiResponse.assert: возвращает this и не бросает при совпадении', () => {
  const res = new ApiResponse<{ 200: { id: string } }>({
    status: 200,
    body: { id: '42' },
  })
  const same = res.assert(200, { id: '42' })
  assert.equal(same, res)
  assert.equal(res.body.id, '42')
})

test('ApiResponse.assert: бросает при несовпадении статуса', () => {
  const res = new ApiResponse<{ 200: { id: string } }>({
    status: 404,
    body: { id: '42' },
  })
  assert.throws(() => res.assert(200), EberlyAssertionError)
})

test('ApiResponse.data: на 2xx отдаёт тело', () => {
  const res = new ApiResponse<{ 201: { id: string }; 403: { message: string } }>({
    status: 201,
    body: { id: '42' },
  })
  assert.equal(res.data.id, '42')
})

test('ApiResponse.data: на не-2xx бросает со статусом, телом и эндпоинтом', () => {
  const res = new ApiResponse<{ 201: { id: string }; 403: { message: string } }>({
    status: 403,
    body: { message: 'nope' },
    endpoint: 'POST /posts',
  })
  assert.throws(
    () => res.data,
    (err: unknown) =>
      err instanceof EberlyAssertionError &&
      /^POST \/posts: Expected a 2xx response, got 403\.\nResponse body: \{"message":"nope"\}$/.test(
        err.message,
      ),
  )
})

test('ApiResponse: стек ошибки начинается с вызывающего кода, а не с eberly', () => {
  const res = new ApiResponse<{ 200: { id: string } }>({ status: 500, body: { id: '1' } })
  for (const run of [() => res.data, () => res.assert(200)]) {
    try {
      run()
      assert.fail('должно было бросить')
    } catch (err) {
      const firstFrame = String((err as Error).stack).split('\n').find((l) => l.includes(' at '))
      assert.match(String(firstFrame), /response\.test\.ts/)
    }
  }
})
