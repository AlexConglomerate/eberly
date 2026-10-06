// Хуки для Nest-бэкенда. `ctx` — store того пользователя, который сделал
// запрос, поэтому токены и `lastPostId` у разных юзеров не смешиваются.

import type { Hooks } from './generated'
import type { UserStore } from './userStore'

export const hooks: Hooks<UserStore> = (h) => {
  // Токен из стора — в каждый запрос. Нет токена (аноним) — нет заголовка.
  h.globalBefore(({ request, ctx }) => {
    const token = ctx.getSafe({ key: 'accessToken' })
    if (token) request.headers.Authorization = `Bearer ${token}`
  })

  // Пост создан — запомнить его id. `response.body` типизирован телом
  // 201, но на 400/401 там на деле ErrorDto — поэтому проверяем статус.
  // #region docs:save-id
  h.posts.create.after(({ response, ctx }) => {
    if (response.status === 201) {
      ctx.set({ key: 'lastPostId', value: response.body.id })
    }
  })
  // #endregion
}
