import { beforeEach, describe, expect, test } from 'vitest'
import { z } from 'zod'

import { World } from '../eberly/generated'

describe('Sandbox', () => {
  beforeEach(() => new World().reset())

  // Landing candidate v2
  test.only('A reader cannot delete the post of the author', async () => {
    const world = new World()
    const author = world.createUser()
    const reader = world.createUser()

    await author.signUp() // register + log in
    await reader.signUp()

    const postData = { title: 'Hello', content: 'First post' }
    const created = await author.posts.create({ body: st post' } })
    const post = created.assert(201, { // typed status
      title: 'Hello', // exact value
      createdAt: z.iso.datetime(), // any Standard Schema: Zod, Valibot, ArkType…
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

  // Landing candidate: two users, three kinds of matchers, statuses from the spec.
  test('Bob cannot delete the post of Alice', async () => {
    const world = new World()
    const alice = world.createUser()
    const james = world.createUser()

    await alice.signUp() // register + log in: the token goes into every request of Alice
    await james.signUp()

    const postData = { title: 'Hello', content: 'First post' }
    const created = await alice.posts.create({ body: postData })

    const post = created.assert(201, { // only the statuses declared in the spec
      title: 'Hello', // exact value
      createdAt: z.iso.datetime(), // any Standard Schema: Zod, Valibot, ArkType…
      authorId: expect.any(Number), // vitest / Jest matcher
    })

    const postId = post.body.id
    const byJames = await james.posts.remove({ path: { postId } })
    const byAlice = await alice.posts.remove({ path: { postId } })
    const alAgain = await alice.posts.remove({ path: { postId } })

    byJames.assert(403) // Нельзя удалить чужой пост
    byAlice.assert(204) // успешное удаление
    alAgain.assert(404) // уже удалено
  })


  test('Alice creates, reads and deletes a post', async () => {
    const world = new World()
    const alice = world.createUser()

    await alice.signUp()

    // create a post
    const postData = { title: 'Hello', content: 'First post' }
    await alice.posts.create({ body: postData })

    // read it back
    const postId = alice.get({ key: 'lastPostId' }) // from Alice's variables (an after-hook saves it)
    const aliceRead = await alice.posts.get({ path: { postId } })

    // check the response
    aliceRead.assert(200, { // typed status check
      title: postData.title, // exact value
      createdAt: z.iso.datetime(), // any Standard Schema: Zod, Valibot, ArkType etc
      authorId: expect.any(Number) // Jest/vitest matcher
    })

    // Alice tries to delete the post twice
    const tryToRemove = await alice.posts.remove({ path: { postId } })
    const tryToRemoveAgain = await alice.posts.remove({ path: { postId } })

    tryToRemove.assert(204) // deleted
    tryToRemoveAgain.assert(404) // already gone
  })

  // Landing candidate v2
  test('A reader cannot delete the post of the author', async () => {
    const world = new World()
    const author = world.createUser()
    const reader = world.createUser()

    await author.signUp() // register + log in
    await reader.signUp()

    const postData = { title: 'Hello', content: 'First post' }
    const created = await author.posts.create({ body: postData })

    const post = created.assert(201, { // typed status
      title: postData.title, // exact value
      createdAt: z.iso.datetime(), // any Standard Schema: Zod, Valibot, ArkType…
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

  test.skip('Alice creates, reads and deletes a post, Bob cannot', async () => {
    const world = new World()

    // Two users
    const alice = world.createUser()
    const bob = world.createUser()

    // Alice and Bob register and log in, the tokens go into their stores
    await alice.signUp({ email: 'alice@example.com', password: '123' })
    await bob.signUp() // no arguments: a random email and password are generated

    // Alice creates a post
    const postData = { title: 'Hello', content: 'First post' }
    const post = await alice.posts.create({ body: postData })

    // Three ways to get the post id
    const v1 = alice.get({ key: 'lastPostId' })
    const v2 = post.data.id
    const v3 = post.assert(201).body.id
    const alicePostId = v1

    // Alice and Bob read the post
    const bobRead = await bob.posts.get({ path: { postId: alicePostId } })
    const aliceRead = await alice.posts.get({ path: { postId: alicePostId } })

    bobRead.assert(200) // status only

    // or the body too
    aliceRead.assert(200, {
      id: z.number().int(), // any Standard Schema: Zod, Valibot, ArkType etc
      title: postData.title, // exact value
      authorId: expect.any(Number) // Jest/vitest matcher
    })

    // Alice and Bob try to delete the post
    const bobTryToRemove = await bob.posts.remove({ path: { postId: alicePostId } })
    const aliceTryToRemove = await alice.posts.remove({ path: { postId: alicePostId } })
    const aliceTryToRemoveAgain = await alice.posts.remove({ path: { postId: alicePostId } })

    bobTryToRemove.assert(403) // Bob cannot delete a post of someone else
    aliceTryToRemove.assert(204) // deleted
    aliceTryToRemoveAgain.assert(404) // already gone
  })
})

// "It is all typed", for the landing. Never runs: `pnpm typecheck` checks
// that every line below is a compile error.
export async function caughtByTypeScript(): Promise<void> {
  const alice = new World().createUser()

  // @ts-expect-error: `titel` does not exist in CreatePostDto
  const res = await alice.posts.create({ body: { titel: 'Hello', content: 'First post' } })

  // @ts-expect-error: POST /posts answers 201, not 200
  res.assert(200)

  // @ts-expect-error: `createdAt` is a string, the schema gives a number
  res.assert(201, { createdAt: z.number() })

  // @ts-expect-error: the path param is `postId`, not `id`
  await alice.posts.get({ path: { id: 1 } })
}
