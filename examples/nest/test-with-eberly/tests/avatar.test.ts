// Загрузка файла (multipart, OpenAPI 3.0 `format: binary`). Файл
// передаётся путём — eberly сам читает его и собирает форму.

import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, test } from 'vitest'

import { World } from '../eberly/generated'

// #region docs:avatar-path
const avatarPath = fileURLToPath(new URL('./fixtures/avatar.png', import.meta.url))
// #endregion

describe('avatar', () => {
  const world = new World()
  const alice = world.createUser()

  beforeAll(async () => {
    await world.reset()
    await alice.signUp({ email: `alice-${randomUUID()}@example.com`, password: 'secret123' })
  })

  test('загрузка по пути → avatarUrl заполнен', async () => {
    // #region docs:avatar-upload
    const res = await alice.users.uploadAvatar({ body: { file: avatarPath } })
    const user = res.assert(201).body
    expect(user.avatarUrl).toBe(`/avatars/${user.id}.png`)
    // #endregion

    const me = await alice.auth.me()
    me.assert(200, { avatarUrl: user.avatarUrl })
  })
})
