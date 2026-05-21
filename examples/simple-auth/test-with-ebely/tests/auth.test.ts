// Тесты email/пароля.
// Проверяем: регистрация → bearer-токен → /auth/session возвращает того же
// юзера; повторный логин работает; неверный пароль → 401; запрос без
// токена к защищённому эндпоинту → 401.

import { beforeAll, describe, test } from 'vitest'

import { World } from '../ebely/generated'

describe('auth (email + пароль)', () => {
  const world = new World()
  const alice = world.createUser()
  const bob = world.createUser()
  const anon = world.createUser()

  beforeAll(async () => {
    await world.clearDatabase()
    await alice.signUp({ email: 'alice@example.com', password: 'password123', name: 'Alice' })
    await bob.signUp({ email: 'bob@example.com', password: 'password123', name: 'Bob' })
  })

  test('session возвращает залогиненного пользователя', async () => {
    const res = await alice.auth.session({})
    res.assert(200, { email: 'alice@example.com', name: 'Alice', role: 'user' })
  })

  test('signIn выдаёт рабочий токен', async () => {
    const other = world.createUser()
    await other.signIn({ email: 'bob@example.com', password: 'password123' })
    const s = await other.auth.session({})
    s.assert(200, { email: 'bob@example.com' })
  })

  test('неверный пароль → 401', async () => {
    const res = await anon.auth.signIn({
      body: { email: 'alice@example.com', password: 'wrong-password' },
    })
    res.assert(401 as any)
  })

  test('защищённый эндпоинт без токена → 401', async () => {
    const res = await anon.posts.list({})
    res.assert(401 as any)
  })

  test('signOut отзывает токен', async () => {
    const charlie = world.createUser()
    await charlie.signUp({ email: 'charlie@example.com', password: 'password123', name: 'Charlie' })
    const out = await charlie.auth.signOut({})
    out.assert(200, { success: true })
    // После signOut session по этому же токену должен отказать.
    const s = await charlie.auth.session({})
    s.assert(401 as any)
  })
})
