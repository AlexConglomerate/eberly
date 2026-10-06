// Песочница для экспериментов с API. В README и на сайт не попадает —
// пример для README лежит в `readme.test.ts`.

import { beforeEach, describe, expect, test } from 'vitest'

import { World } from '../eberly/generated'

describe('Песочница', () => {
  beforeEach(() => new World().reset())

  test('Алиса создаёт, читает и удаляет пост, Боб — нет', async () => {
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

    // Как посмотреть ID поста? 
    const store = alice.get({ key: 'lastPostId' }) // Можем достать из внутренних переменных Алисы.  
    const body = post.assert(201).body.id // То же самое можем получить из ответа
    expect(store).toEqual(body)
    const alicePostId = store

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
  })
})
