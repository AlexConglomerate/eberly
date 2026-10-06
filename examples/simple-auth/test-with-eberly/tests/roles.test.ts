// Тесты ролей. user vs admin:
//   - любой залогиненный может создать пост и читать список;
//   - редактировать чужой пост может только admin (или автор);
//   - удалить пост может ТОЛЬКО admin (даже автор не может — это
//     осознанное решение для демонстрации жёсткого разграничения).

import { beforeAll, describe, expect, test } from 'vitest'

import { World } from '../eberly/generated'

describe('roles (user vs admin)', () => {
  const world = new World()
  const user = world.createUser()
  const admin = world.createUser()

  beforeAll(async () => {
    await world.clearDatabase()
    await user.signUp({ email: 'plain@example.com', password: 'password123', name: 'Plain' })
    await admin.signUp({ email: 'boss@example.com', password: 'password123', name: 'Boss' })
    // Поднимаем boss до админа через тест-helper, потом — релогин,
    // чтобы в токене лежала уже свежая роль.
    await world.promote({ email: 'boss@example.com', role: 'admin' })
    await admin.signIn({ email: 'boss@example.com', password: 'password123' })
  })

  test('user создаёт свой пост — 200', async () => {
    const res = await user.posts.create({ body: { title: 'Hi', content: 'from user' } })
    res.assert(200, { title: 'Hi', content: 'from user' })
    // authorId должен совпасть с id юзера из session.
    const me = await user.auth.session({})
    me.assert(200)
    expect(res.body.authorId).toBe(me.body.id)
  })

  test('user НЕ может удалить пост (даже свой) — 403', async () => {
    const created = await user.posts.create({ body: { title: 'Doomed', content: 'x' } })
    created.assert(200)
    const del = await user.posts.delete({ path: { postId: created.body.id } })
    del.assert(403)
  })

  test('admin удаляет любой пост — 200', async () => {
    const created = await user.posts.create({ body: { title: 'Trash', content: 'x' } })
    created.assert(200)
    const del = await admin.posts.delete({ path: { postId: created.body.id } })
    del.assert(200, { success: true })
    // и теперь он действительно пропал
    const gone = await admin.posts.get({ path: { postId: created.body.id } })
    gone.assert(404)
  })

  test('user НЕ может править ЧУЖОЙ пост — 403', async () => {
    const adminPost = await admin.posts.create({ body: { title: 'Admin post', content: 'a' } })
    adminPost.assert(200)
    const tryUpdate = await user.posts.update({
      path: { postId: adminPost.body.id },
      body: { title: 'hacked' },
    })
    tryUpdate.assert(403)
  })

  test('автор правит СВОЙ пост — 200', async () => {
    const my = await user.posts.create({ body: { title: 'My', content: 'mine' } })
    my.assert(200)
    const upd = await user.posts.update({
      path: { postId: my.body.id },
      body: { title: 'My (edited)' },
    })
    upd.assert(200, { title: 'My (edited)' })
  })

  test('admin может править ЧУЖОЙ пост — 200', async () => {
    const usersPost = await user.posts.create({ body: { title: 'For moderation', content: 'm' } })
    usersPost.assert(200)
    const upd = await admin.posts.update({
      path: { postId: usersPost.body.id },
      body: { content: 'moderated by admin' },
    })
    upd.assert(200, { content: 'moderated by admin' })
  })
})
