// Тест полного OAuth-флоу через фейковый Google.
//
// Один POST на /auth/oauth/google/login — а внутри бэкенда BetterAuth
// честно проходит authorize → token → userinfo против локального IdP
// (`your-app/src/fake-google.ts`). На выходе — bearer-токен, который
// дальше используется как обычно.

import { beforeAll, describe, test } from 'vitest'

import { World } from '../eberly/generated'

describe('oauth (fake Google)', () => {
  const world = new World()
  const googler = world.createUser()

  beforeAll(async () => {
    await world.clearDatabase()
  })

  test('loginWithGoogle создаёт юзера и выдаёт bearer-токен', async () => {
    await googler.loginWithGoogle()
    const s = await googler.auth.session({})
    s.assert(200, {
      email: 'googler@example.com',
      name: 'Fake Googler',
      role: 'user',
    })
  })

  test('повторный loginWithGoogle линкуется на того же пользователя', async () => {
    const again = world.createUser()
    await again.loginWithGoogle()
    const s = await again.auth.session({})
    s.assert(200, { email: 'googler@example.com' })
  })

  test('OAuth-юзер может создавать посты как обычный user', async () => {
    const post = await googler.posts.create({ body: { title: 'From OAuth', content: 'hi' } })
    post.assert(200, { title: 'From OAuth' })
  })

  test('OAuth-юзер БЕЗ роли admin не может удалять — 403', async () => {
    const created = await googler.posts.create({ body: { title: 't', content: 'c' } })
    created.assert(200)
    const del = await googler.posts.delete({ path: { postId: created.body.id } })
    del.assert(403)
  })
})
