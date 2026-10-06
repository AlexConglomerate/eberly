// Примеры из корневого README.md и лендинга сайта: короткий тест под
// установкой (регион `docs:readme-hero`) и «до и после» (`docs:readme-before`
// / `docs:readme-after`). Тела тестов скопированы в README один в один —
// поменяли здесь, поменяйте и там.

import { beforeEach, describe, expect, test } from 'vitest'
import { z } from 'zod'

import { World } from '../eberly/generated'

describe('README', () => {
  beforeEach(() => new World().reset())

  test('Автор создаёт пост, ответ проверен по статусу, значению, схеме и матчеру', async () => {
    // #region docs:readme-hero
    const world = new World()
    const user = world.createUser()

    await user.signUp() // register + log in
    const body = { title: 'Hello', content: 'First post' }
    const created = await user.posts.create({ body })

    created.assert(201, { // typed status
      title: 'Hello', // exact value
      createdAt: z.iso.datetime(), // Zod, Valibot, ArkType…
      authorId: expect.any(Number), // vitest / Jest matcher
    })
    // #endregion
  })

  test('Боб не может удалить пост Алисы → 403', async () => {
    // #region docs:readme-after
    const world = new World()
    const alice = world.createUser()
    const bob = world.createUser()
    await alice.signUp({ email: 'alice@example.com', password: 'secret123' })
    await bob.signUp({ email: 'bob@example.com', password: 'secret123' })

    const post = await alice.posts.create({ body: { title: 'Hello', content: 'First post' } })
    const res = await bob.posts.remove({ path: { postId: post.assert(201).body.id } })
    res.assert(403, { message: 'Only the author can do this' })
    // #endregion
  })

  test('то же без eberly: голый fetch, токены руками', async () => {
    // #region docs:readme-before
    const base = 'http://localhost:3000'
    const json = { 'Content-Type': 'application/json' }

    async function signUp(email: string) {
      const body = JSON.stringify({ email, password: 'secret123' })
      await fetch(`${base}/auth/register`, { method: 'POST', headers: json, body })
      const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: json, body })
      const { accessToken } = await login.json() // any
      return { ...json, Authorization: `Bearer ${accessToken}` }
    }

    const alice = await signUp('alice@example.com')
    const bob = await signUp('bob@example.com')

    const created = await fetch(`${base}/posts`, {
      method: 'POST',
      headers: alice,
      body: JSON.stringify({ title: 'Hello', content: 'First post' }),
    })
    const post = await created.json() // any: `post.titel` compiles just fine
    const res = await fetch(`${base}/posts/${post.id}`, { method: 'DELETE', headers: bob })
    expect(res.status).toBe(403)
    expect((await res.json()).message).toBe('Only the author can do this')
    // #endregion
  })
})
