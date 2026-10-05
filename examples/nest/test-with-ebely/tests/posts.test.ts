// Посты двух пользователей: права автора (403 для чужого), публикация
// черновика, 204 без тела и 404 после удаления.

import { randomUUID } from 'node:crypto'

import { beforeAll, describe, expect, test } from 'vitest'

import { World } from '../ebely/generated'

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
    // Алиса создаёт черновик: 201 и publishedAt = null.
    const created = await alice.posts.create({ body: { title: 'Hello', content: 'First post' } })
    created.assert(201, { title: 'Hello', publishedAt: null })

    // after-хук положил id в стор именно Алисы.
    const postId = alice.get({ key: 'lastPostId' })!
    expect(postId).toBe(created.assert(201).body.id)
    expect(bob.get({ key: 'lastPostId' })).toBeUndefined()
    const path = { id: String(postId) }

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
    ;(await alice.posts.publish({ path: { id: String(readyId) } })).assert(200)

    const list = await bob.posts.list()
    const ids = list.assert(200).body.map((p) => p.id)
    expect(ids).toContain(readyId)
    expect(ids).not.toContain(draftId)
  })

  test('без токена создать пост нельзя → 401', async () => {
    const anon = world.createUser()
    const res = await anon.posts.create({ body: { title: 'x', content: 'y' } })
    res.assert(401)
  })
})
