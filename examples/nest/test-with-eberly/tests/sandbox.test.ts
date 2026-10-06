import { beforeEach, describe, expect, test } from 'vitest'
import { z } from 'zod'

import { World } from '../eberly/generated'

describe('Песочница', () => {
  beforeEach(() => new World().reset())

  test('Алиса создаёт, читает и удаляет пост, Боб — нет', async () => {
    const world = new World()

    // Создаём двух пользователей
    const alice = world.createUser()
    const bob = world.createUser()

    // Алиса и Боб регистрируются и логинятся, токены сохраняются в их сторы
    await alice.signUp({ email: 'alice@example.com', password: 'secret123' })
    await bob.signUp() // можно без аргументов — сгенерятся случайные email и пароль

    // Алиса создаёт пост
    const postData = { title: 'Hello', content: 'First post' }
    const post = await alice.posts.create({ body: postData })

    // Как посмотреть ID поста? Три способа, все дают одно и то же:
    // из переменных Алисы (кладёт хук). if (lastPostId === undefined) throw new Error() 
    const fromStore = alice.get({ key: 'lastPostId' })
    const fromAssert = post.assert(201).body.id // Явно проверили статус и взяли из ответа
    const fromData = post.data.id // напрямую: не 2xx — ошибка на этой строке
    expect(fromStore).toEqual(fromAssert)
    expect(fromData).toEqual(fromAssert)
    const alicePostId = fromData

    // Алиса и Боб читают пост
    const bobRead = await bob.posts.get({ path: { id: alicePostId } })
    const aliceRead = await alice.posts.get({ path: { id: alicePostId } })

    bobRead.assert(200) // Можем проверить только статус

    // А можем еще и тело ответа
    aliceRead.assert(200, {
      id: z.number().int(), // any Standard Schema: Zod, Valibot, ArkType etc
      title: postData.title, // exact value
      authorId: expect.any(Number) // Jest/vitest matcher
    })

    // Алиса и Боб пытаются удалить пост
    const bobTryToRemove = await bob.posts.remove({ path: { id: alicePostId } })
    const aliceTryToRemove = await alice.posts.remove({ path: { id: alicePostId } })
    const aliceTryToRemoveAgain = await alice.posts.remove({ path: { id: alicePostId } })

    bobTryToRemove.assert(403) // Боб не может удалить чужой пост
    aliceTryToRemove.assert(204) // Успешно удалили
    aliceTryToRemoveAgain.assert(404) // Уже удалён, 404
  })
})
