// Юнит-тесты политики версий: 3.0/3.1 генерируем, остальное — понятная ошибка.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertSupportedVersion } from './version'

test('OpenAPI 3.1 поддерживается', () => {
  assert.doesNotThrow(() => assertSupportedVersion({ spec: { openapi: '3.1.1' } }))
})

test('OpenAPI 3.0 поддерживается', () => {
  assert.doesNotThrow(() => assertSupportedVersion({ spec: { openapi: '3.0.0' } }))
})

test('Swagger 2.0 → ошибка с подсказкой про конвертацию', () => {
  assert.throws(
    () => assertSupportedVersion({ spec: { swagger: '2.0' } }),
    /got Swagger 2\.0\. Convert the spec \(e\.g\. with swagger2openapi\)/,
  )
})

test('неизвестная версия → ошибка с найденным значением', () => {
  assert.throws(() => assertSupportedVersion({ spec: { openapi: '4.0.0' } }), /got openapi: "4\.0\.0"/)
})

test('нет поля openapi → ошибка', () => {
  assert.throws(() => assertSupportedVersion({ spec: {} }), /no "openapi" field/)
})
