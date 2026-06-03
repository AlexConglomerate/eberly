// Юнит-тесты сборщика операций: collectOperations — чистая функция
// «spec.paths → плоский список», тестируется без сети.
//
// Главный фокус — разведение коллизий имён (dedupeNames): один
// operationId на GET и POST одного пути не должен давать два одноимённых
// свойства (классика better-auth `getSession`).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectOperations } from './operations'
import type { Json } from './types'

const ok = {
  responses: { 200: { description: 'ok' } },
}

test('коллизия имени на GET+POST одного пути: метод дописывается спереди', () => {
  const spec: Json = {
    paths: {
      '/auth/get-session': {
        get: { operationId: 'auth.getSession', ...ok },
        post: { operationId: 'auth.getSession', ...ok },
      },
    },
  }
  const ops = collectOperations({ spec })
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
  const ops = collectOperations({ spec })
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
  const ops = collectOperations({ spec })
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
  const ops = collectOperations({ spec })
  // оба GET → оба префиксуются методом, второй получает суффикс
  assert.deepEqual(
    ops.map((o) => o.name).sort(),
    ['getPing', 'getPing2'],
  )
})
