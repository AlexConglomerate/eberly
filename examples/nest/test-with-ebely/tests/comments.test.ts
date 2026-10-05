// Дерево комментариев: `CommentDto.replies` ссылается сам на себя.
// Deep-partial `assert` проверяет рекурсивную структуру на любой глубине.

import { randomUUID } from 'node:crypto'

import { beforeAll, describe, test } from 'vitest'

import { World } from '../ebely/generated'

describe('comments', () => {
  const world = new World()
  const alice = world.createUser()
  const bob = world.createUser()

  beforeAll(async () => {
    await world.reset()
    await alice.signUp({ email: `alice-${randomUUID()}@example.com`, password: 'secret123' })
    await bob.signUp({ email: `bob-${randomUUID()}@example.com`, password: 'secret123' })
  })

  test('ответы вкладываются в replies', async () => {
    const created = await alice.posts.create({ body: { title: 'Tree', content: 'comments' } })
    const path = { id: String(created.assert(201).body.id) }

    const a = await alice.comments.create({ path, body: { text: 'a' } })
    const aId = a.assert(201, { text: 'a', replies: [] }).body.id

    const b = await bob.comments.create({ path, body: { text: 'b', parentId: aId } })
    const bId = b.assert(201).body.id

    const c = await alice.comments.create({ path, body: { text: 'c', parentId: bId } })
    c.assert(201)

    const tree = await bob.comments.list({ path })
    tree.assert(200, [{ text: 'a', replies: [{ text: 'b', replies: [{ text: 'c', replies: [] }] }] }])
  })

  test('parentId из чужого поста → 404', async () => {
    const first = await alice.posts.create({ body: { title: 'One', content: '1' } })
    const second = await alice.posts.create({ body: { title: 'Two', content: '2' } })
    const firstPath = { id: String(first.assert(201).body.id) }
    const secondPath = { id: String(second.assert(201).body.id) }

    const parent = await alice.comments.create({ path: firstPath, body: { text: 'root' } })
    const parentId = parent.assert(201).body.id

    const res = await alice.comments.create({ path: secondPath, body: { text: 'x', parentId } })
    res.assert(404, { message: 'Parent comment not found' })
  })
})
