import { describe, test } from 'vitest'

import { World } from '../eberly/generated'

// Rename `title` in the spec and click outside it:
// this test turns red.
describe('posts', () => {
  test('Bob cannot delete the post of Alice', async () => {
    const world = new World()
    const alice = world.createUser()
    const bob = world.createUser()

    const res = await alice.posts.create({
      body: { title: 'Hello', content: 'First post' },
    })
    // Statuses come from the spec, the body is
    // checked partially and typed by the status.
    const post = res.assert(201, { title: 'Hello' }).body
    const id = String(post.id)

    const removed = await bob.posts.remove({ path: { id } })
    removed.assert(403, { message: 'Only the author can do this' })

    const found = await alice.posts.get({ path: { id } })
    found.assert(200, { id: post.id, publishedAt: null })
  })
})
