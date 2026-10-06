import { beforeEach, describe, expect, test } from 'vitest'
import { z } from 'zod'

import { World } from '../eberly/generated'

describe('Песочница', () => {
  beforeEach(() => new World().reset())

  test('Алиса создаёт, читает и удаляет пост', async () => {
    const world = new World()
    const alice = world.createUser()

    await alice.signUp()

    // создадим пост
    const postData = { title: 'Hello', content: 'First post' }
    await alice.posts.create({ body: postData })

    // прочитаем пост
    const postId = alice.get({ key: 'lastPostId' }) // из переменных Алисы (кладёт хук)
    const aliceRead = await alice.posts.get({ path: { postId } })

    // проверим ответ
    aliceRead.assert(200, { // Типизированная проверка статуса
      title: postData.title, // exact value
      createdAt: z.iso.datetime(), // any Standard Schema: Zod, Valibot, ArkType etc
      authorId: expect.any(Number) // Jest/vitest matcher
    })

    // Алиса пытается удалить пост дважды
    const tryToRemove = await alice.posts.remove({ path: { postId } })
    const tryToRemoveAgain = await alice.posts.remove({ path: { postId } })

    tryToRemove.assert(204) // Успешно удалили
    tryToRemoveAgain.assert(404) // Уже удалён, 404
  })

  test.skip('Алиса создаёт, читает и удаляет пост, Боб — нет', async () => {
    const world = new World()

    // Создаём двух пользователей
    const alice = world.createUser()
    const bob = world.createUser()

    // Алиса и Боб регистрируются и логинятся, токены сохраняются в их сторы
    await alice.signUp({ email: 'alice@example.com', password: '123' })
    await bob.signUp() // можно без аргументов — сгенерятся случайные email и пароль

    // Алиса создаёт пост
    const postData = { title: 'Hello', content: 'First post' }
    const post = await alice.posts.create({ body: postData })

    // Три способа достать пост ID
    const v1 = alice.get({ key: 'lastPostId' })
    const v2 = post.data.id
    const v3 = post.assert(201).body.id
    const alicePostId = v1

    // Алиса и Боб читают пост
    const bobRead = await bob.posts.get({ path: { postId: alicePostId } })
    const aliceRead = await alice.posts.get({ path: { postId: alicePostId } })

    bobRead.assert(200) // Можем проверить только статус

    // А можем еще и тело ответа
    aliceRead.assert(200, {
      id: z.number().int(), // any Standard Schema: Zod, Valibot, ArkType etc
      title: postData.title, // exact value
      authorId: expect.any(Number) // Jest/vitest matcher
    })

    // Алиса и Боб пытаются удалить пост
    const bobTryToRemove = await bob.posts.remove({ path: { postId: alicePostId } })
    const aliceTryToRemove = await alice.posts.remove({ path: { postId: alicePostId } })
    const aliceTryToRemoveAgain = await alice.posts.remove({ path: { postId: alicePostId } })

    bobTryToRemove.assert(403) // Боб не может удалить чужой пост
    aliceTryToRemove.assert(204) // Успешно удалили
    aliceTryToRemoveAgain.assert(404) // Уже удалён, 404
  })
})
