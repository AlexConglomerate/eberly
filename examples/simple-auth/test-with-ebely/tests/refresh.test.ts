// Тест ПРОЗРАЧНОГО повтора запроса на 401 через ГЛОБАЛЬНЫЙ retry-хук.
//
// Сценарий:
//   1. Юзер логинится (токен лежит в его store, globalBefore шлёт его всюду).
//   2. world.revoke(email) отзывает сессии на сервере — токен «протух».
//   3. Защищённый вызов уходит со старым токеном → сервер отвечает 401.
//      Глобальный retry-хук ловит 401, делает refresh (повторный signIn),
//      кладёт свежий токен и просит повтор. ebely САМ переигрывает запрос:
//      заново прогоняет globalBefore (берёт уже обновлённый токен) и шлёт
//      fetch. Поэтому ОДИН вызов сразу возвращает 200 — ручного повтора
//      в тесте больше нет.

import { beforeAll, describe, test } from 'vitest'

import { World } from '../ebely/generated'

describe('refresh on 401 (globalRetry)', () => {
  const world = new World()
  const dave = world.createUser()

  beforeAll(async () => {
    await world.clearDatabase()
    await dave.signUp({ email: 'dave@example.com', password: 'password123', name: 'Dave' })
  })

  test('протухший токен → globalRetry рефрешит и переигрывает → один вызов даёт 200', async () => {
    // sanity: пока токен живой — всё ок.
    const ok = await dave.auth.session({})
    ok.assert(200, { email: 'dave@example.com' })

    // Отзываем сессии: текущий bearer-токен теперь невалиден.
    await world.revoke({ email: 'dave@example.com' })

    // Вызов уходит со старым (протухшим) токеном → 401. retry-хук рефрешит
    // и ebely прозрачно переигрывает запрос на свежем токене → сразу 200.
    const res = await dave.posts.list({})
    res.assert(200 as any)
  })

  test('retry не зацикливается на неверных кредах (auth-эндпоинты исключены)', async () => {
    // У анонимного юзера нет ни токена, ни сохранённых кредов — retry-хук
    // на 401 возвращает false, ebely отдаёт 401 как есть (без бесконечного
    // signIn; вдобавок maxRetries в ядре жёстко ограничивает повторы).
    const anon = world.createUser()
    const res = await anon.posts.list({})
    res.assert(401 as any)
  })
})
