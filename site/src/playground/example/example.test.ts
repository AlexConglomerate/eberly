import { expect, test } from 'vitest'
import { z } from 'zod'

import { World } from '../eberly/generated'

test('a user creates a post', async () => {
  const world = new World()
  const user = world.createUser()

  await user.signUp() // register + log in
  const body = { title: 'Hello', content: 'First post' }
  const created = await user.posts.create({ body })

  created.assert(201, { // typed status
    title: 'Hello', // exact value
    createdAt: z.iso.datetime(), // Zod, Valibot, ArkType…
    authorId: expect.any(Number), // vitest / Jest matcher
  })
})
