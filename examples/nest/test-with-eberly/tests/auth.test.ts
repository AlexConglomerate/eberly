// Регистрация, логин и bearer-токен. Здесь же — типизированные ошибки:
// 409 и 400 задекларированы в свагере, их тело (`ErrorDto`) проверяется
// так же, как тело успешного ответа.

import { randomUUID } from 'node:crypto'

import { beforeAll, describe, expect, test } from 'vitest'

import { World } from '../eberly/generated'

const uniqueEmail = () => `${randomUUID()}@example.com`

describe('auth', () => {
  const world = new World()

  beforeAll(() => world.reset())

  test('register → 201, тело — UserDto', async () => {
    const anon = world.createUser()
    const email = uniqueEmail()

    const res = await anon.auth.register({ body: { email, password: 'secret123' } })
    const user = res.assert(201, { email, avatarUrl: null }).body
    expect(user.id).toBeTypeOf('number')
  })

  test('повторная регистрация → 409 с ErrorDto', async () => {
    const anon = world.createUser()
    const email = uniqueEmail()
    await anon.auth.register({ body: { email, password: 'secret123' } })

    const again = await anon.auth.register({ body: { email, password: 'secret123' } })
    again.assert(409, { statusCode: 409, message: 'Email is already registered' })
  })

  test('кривой email → 400, message — массив ошибок валидации', async () => {
    const anon = world.createUser()

    const res = await anon.auth.register({ body: { email: 'not-an-email', password: 'secret123' } })
    res.assert(400, { statusCode: 400, message: ['email must be an email'] })
  })

  test('неверный пароль → 401', async () => {
    const alice = world.createUser()
    const email = uniqueEmail()
    await alice.signUp({ email, password: 'secret123' })

    const res = await alice.auth.login({ body: { email, password: 'wrong-password' } })
    res.assert(401, { message: 'Invalid email or password' })
  })

  test('me: без токена → 401, с токеном → 200', async () => {
    const anon = world.createUser()
    const noToken = await anon.auth.me()
    noToken.assert(401)

    const alice = world.createUser()
    const email = uniqueEmail()
    await alice.signUp({ email, password: 'secret123' })

    const me = await alice.auth.me()
    me.assert(200, { email })
  })

  test('устаревший whoami работает так же, как me', async () => {
    const alice = world.createUser()
    const email = uniqueEmail()
    await alice.signUp({ email, password: 'secret123' })

    const res = await alice.auth.whoami()
    res.assert(200, { email, avatarUrl: null })
  })
})
