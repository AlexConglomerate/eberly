// Юнит-тесты BaseStore: строгий `get` и мягкий `getSafe`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BaseStore } from './base-store'

type Vars = { lastPostId: number; note: string | null }

test('get возвращает заданное значение', () => {
  const store = new BaseStore<Vars>()
  store.set({ key: 'lastPostId', value: 42 })
  assert.equal(store.get({ key: 'lastPostId' }), 42)
})

test('get бросает на незаданном ключе и подсказывает getSafe', () => {
  const store = new BaseStore<Vars>()
  assert.throws(() => store.get({ key: 'lastPostId' }), {
    message: /"lastPostId" is not set on this user.*getSafe\(\{ key: 'lastPostId' \}\)/,
  })
})

test('get не бросает на явно заданном null', () => {
  const store = new BaseStore<Vars>()
  store.set({ key: 'note', value: null })
  assert.equal(store.get({ key: 'note' }), null)
})

test('getSafe возвращает undefined на незаданном ключе', () => {
  const store = new BaseStore<Vars>()
  assert.equal(store.getSafe({ key: 'lastPostId' }), undefined)
  store.set({ key: 'lastPostId', value: 7 })
  assert.equal(store.getSafe({ key: 'lastPostId' }), 7)
})
