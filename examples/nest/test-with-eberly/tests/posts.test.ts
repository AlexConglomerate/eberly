// Посты двух пользователей: права автора (403 для чужого), публикация
// черновика, 204 без тела и 404 после удаления.

import { randomUUID } from 'node:crypto'

import { beforeAll, describe, expect, test } from 'vitest'
import type { BodyOf, PathOf, ResponseOf } from 'eberly'
import { z } from 'zod'

import { World, api } from '../eberly/generated'

describe('posts', () => {
  const world = new World()
  const alice = world.createUser()
  const bob = world.createUser()

  beforeAll(async () => {
    await world.reset()
    await alice.signUp({ email: `alice-${randomUUID()}@example.com`, password: 'secret123' })
    await bob.signUp({ email: `bob-${randomUUID()}@example.com`, password: 'secret123' })
  })

  test('жизненный цикл поста: создать → чужой не удалит → опубликовать → удалить', async () => {
    // Алиса создаёт черновик: 201 и publishedAt = null. after-хук кладёт
    // id в стор именно Алисы.
    // #region docs:last-post-id
    const created = await alice.posts.create({ body: { title: 'Hello', content: 'First post' } })
    created.assert(201, { title: 'Hello', publishedAt: null })

    const postId = alice.get({ key: 'lastPostId' })
    expect(postId).toBe(created.assert(201).body.id)
    expect(bob.getSafe({ key: 'lastPostId' })).toBeUndefined()
    // #endregion
    const path = { postId }

    // Боб — не автор: 403.
    const foreign = await bob.posts.remove({ path })
    foreign.assert(403, { message: 'Only the author can do this' })

    // Алиса публикует: publishedAt был null, стал строкой.
    const published = await alice.posts.publish({ path })
    const post = published.assert(200, { id: postId }).body
    expect(post.publishedAt).toBeTypeOf('string')

    // Алиса удаляет: 204, тела нет.
    const removed = await alice.posts.remove({ path })
    removed.assert(204)

    const gone = await alice.posts.get({ path })
    gone.assert(404, { message: 'Post not found' })
  })

  test('черновики не попадают в список, опубликованные — попадают', async () => {
    const draft = await alice.posts.create({ body: { title: 'Draft', content: 'draft' } })
    const draftId = draft.assert(201).body.id

    const ready = await alice.posts.create({ body: { title: 'Ready', content: 'ready' } })
    const readyId = ready.assert(201).body.id
    ;(await alice.posts.publish({ path: { postId: readyId } })).assert(200)

    const list = await bob.posts.list()
    const ids = list.assert(200).body.map((p) => p.id)
    expect(ids).toContain(readyId)
    expect(ids).not.toContain(draftId)
  })

  test('тело проверяется схемами и матчерами, а не только точными значениями', async () => {
    // #region docs:assert-schemas
    const created = await alice.posts.create({ body: { title: 'Hello', content: 'First post' } })

    created.assert(201, {
      title: 'Hello', // exact value
      id: z.number().int().positive(), // any Standard Schema: Zod, Valibot, ArkType…
      createdAt: z.iso.datetime(),
      publishedAt: null,
      authorId: expect.any(Number), // a vitest asymmetric matcher works too
    })

    // A schema can check the whole body; fields it does not list are ignored
    created.assert(201, z.object({ id: z.number(), title: z.string().min(1) }))
    // #endregion

    // Провал схемы — путь, текст от схемы и фактическое значение.
    expect(() => created.assert(201, { title: z.email() })).toThrow(
      'mismatch at "title": expected a value matching the zod schema (Invalid email address), got "Hello"',
    )
    expect(() => created.assert(201, { id: expect.any(String) })).toThrow(
      /mismatch at "id": expected Any<String>, got \d+/,
    )
  })

  test('данные запроса объявлены заранее и типизированы по эндпоинту', async () => {
    // #region docs:endpoint-types
    // Typed where it is declared: a typo or an extra field fails on this line
    const newPost = { title: 'Hello', content: 'First post' } satisfies BodyOf<typeof api.posts.create>
    const created = await alice.posts.create({ body: newPost })
    created.assert(201, { title: newPost.title })

    // Response body of a status, the 2xx one by default: here ErrorDto
    type CreateError = ResponseOf<typeof api.posts.create, 400>
    const empty = await alice.posts.create({ body: { title: '', content: '' } })
    const error: CreateError = empty.assert(400).body

    const path: PathOf<typeof api.posts.publish> = { postId: created.data.id }
    ;(await alice.posts.publish({ path })).assert(200)
    // #endregion

    expect(error.statusCode).toBe(400)
    // `api` is for types only: it does not call the backend
    expect(() => api.posts.create).toThrow('api from the generated client is for types only')
  })

  test('без токена создать пост нельзя → 401', async () => {
    const anon = world.createUser()
    const res = await anon.posts.create({ body: { title: 'x', content: 'y' } })
    res.assert(401)
  })
})
