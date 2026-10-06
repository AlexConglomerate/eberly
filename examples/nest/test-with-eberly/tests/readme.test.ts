// Пример «до и после» из корневого README.md и лендинга сайта (регионы
// `docs:readme-before` / `docs:readme-after` → site/). Тела тестов
// скопированы в README один в один — поменяли здесь, поменяйте и там.

import { beforeEach, describe, expect, test } from 'vitest'

import { World } from '../eberly/generated'

describe('README', () => {
  beforeEach(() => new World().reset())

  test('Боб не может удалить пост Алисы → 403', async () => {
    // #region docs:readme-after
    const world = new World()

    // Создаём двух пользователей
    const alice = world.createUser()
    const bob = world.createUser()

    // Алиса и Боб регистрируются и логинятся, токены сохраняются в сторы
    await alice.signUp({ email: 'alice@example.com', password: 'secret123' })
    await bob.signUp() // random email/password, Если не задали

    // Алиса создаёт пост
    const postData = { title: 'Hello', content: 'First post' }
    const post = await alice.posts.create({ body: postData })

    const alicePostIdFromStore = alice.get({ key: 'lastPostId' }) // Автоматически сохраняется внутри Алисы. 
    const alicePostIdFromBody = post.assert(201).body.id // То же самое можем получить из ответа
    expect(alicePostIdFromStore).toEqual(alicePostIdFromBody)
    const alicePostId = post.assert(201).body.id

    // Алиса и Боб читают пост
    const bobRead = await bob.posts.get({ path: { id: alicePostId } })
    const aliceRead = await alice.posts.get({ path: { id: alicePostId } })

    bobRead.assert(200, postData) // Можем проверить все поля
    aliceRead.assert(200, { title: postData.title }) // Можем проверить только часть полей

    // Алиса и Боб пытаются удалить пост
    const bobTryToRemove = await bob.posts.remove({ path: { id: alicePostId } })
    const aliceTryToRemove = await alice.posts.remove({ path: { id: alicePostId } })
    const aliceTryToRemoveAgain = await alice.posts.remove({ path: { id: alicePostId } })

    bobTryToRemove.assert(403) // Боб не может удалить чужой пост
    aliceTryToRemove.assert(204) // Успешно удалили
    aliceTryToRemoveAgain.assert(404) // Уже удалён, 404
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
