// Пример «до и после» из корневого README.md. Тело теста скопировано в
// README один в один — поменяли здесь, поменяйте и там (и наоборот).

import { beforeAll, describe, test } from 'vitest'

import { World } from '../eberly/generated'

describe('README', () => {
  beforeAll(() => new World().reset())

  test('Боб не может удалить пост Алисы → 403', async () => {
    const world = new World()
    const alice = world.createUser()
    const bob = world.createUser()
    await alice.signUp({ email: 'alice@example.com', password: 'secret123' })
    await bob.signUp({ email: 'bob@example.com', password: 'secret123' })

    const post = await alice.posts.create({ body: { title: 'Hello', content: 'First post' } })
    const res = await bob.posts.remove({ path: { id: String(post.assert(201).body.id) } })
    res.assert(403, { message: 'Only the author can do this' })
  })
})
