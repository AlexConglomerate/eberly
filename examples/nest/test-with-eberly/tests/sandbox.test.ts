import { beforeEach, describe, expect, test } from 'vitest'
import { z } from 'zod'

import { World } from '../eberly/generated'

describe('Sandbox', () => {
  beforeEach(() => new World().reset())

  // Landing candidate
  test('A reader cannot delete the post of the author', async () => {
    const world = new World()
    const author = world.createUser()
    const reader = world.createUser()

    await author.signUp() // register + log in
    await reader.signUp()

    const body = { title: 'Hello', content: 'First post' }
    const created = await author.posts.create({ body })
    const post = created.assert(201, { // typed status
      title: 'Hello', // exact value
      createdAt: z.iso.datetime(), // Zod, Valibot, ArkType…
      authorId: expect.any(Number), // vitest / Jest matcher
    })

    const postId = post.body.id
    const byReader = await reader.posts.remove({ path: { postId } })
    byReader.assert(403) // not the author

    const byAuthor = await author.posts.remove({ path: { postId } })
    byAuthor.assert(204) // deleted

    const twice = await author.posts.remove({ path: { postId } })
    twice.assert(404) // already gone
  })
})
