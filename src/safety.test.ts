// Юнит-тесты allowlist хостов (защита от прода): чистые функции, без сети.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EberlyUnsafeHostError, assertHostAllowed, isHostAllowed } from './safety'

test('loopback разрешён без списка', () => {
  for (const url of ['http://localhost:3000', 'http://127.0.0.1:8080/api', 'http://[::1]:3000']) {
    assert.equal(isHostAllowed({ url }), true, url)
  }
})

test('чужой хост запрещён', () => {
  assert.equal(isHostAllowed({ url: 'https://api.prod.com' }), false)
  assert.equal(isHostAllowed({ url: 'https://api.prod.com', allowedHosts: ['staging.prod.com'] }), false)
})

test('точное совпадение разрешает хост, порт игнорируется', () => {
  const allowedHosts = ['staging.x.com']
  assert.equal(isHostAllowed({ url: 'https://staging.x.com:8443/api', allowedHosts }), true)
  assert.equal(isHostAllowed({ url: 'https://staging.x.com', allowedHosts: ['staging.x.com:8443'] }), true)
})

test('wildcard совпадает с поддоменом, но не с самим доменом', () => {
  const allowedHosts = ['*.staging.x.com']
  assert.equal(isHostAllowed({ url: 'https://api.staging.x.com', allowedHosts }), true)
  assert.equal(isHostAllowed({ url: 'https://a.b.staging.x.com', allowedHosts }), true)
  assert.equal(isHostAllowed({ url: 'https://staging.x.com', allowedHosts }), false)
  assert.equal(isHostAllowed({ url: 'https://evilstaging.x.com', allowedHosts }), false)
})

test('регистр не важен', () => {
  assert.equal(isHostAllowed({ url: 'https://API.Staging.X.com', allowedHosts: ['api.staging.x.com'] }), true)
  assert.equal(isHostAllowed({ url: 'https://api.staging.x.com', allowedHosts: ['*.STAGING.x.COM'] }), true)
  assert.equal(isHostAllowed({ url: 'http://LOCALHOST:3000' }), true)
})

test('текст ошибки содержит хост и подсказку', () => {
  assert.throws(
    () => assertHostAllowed({ url: 'https://api.prod.com:443/v1' }),
    (err: unknown) =>
      err instanceof EberlyUnsafeHostError &&
      err.message.includes('"api.prod.com"') &&
      err.message.includes('add the host to `allowedHosts` in eberly.ts'),
  )
  assert.doesNotThrow(() => assertHostAllowed({ url: 'http://localhost:3000' }))
})
