// Регистрация хуков. `withBearer` вешается на все защищённые эндпоинты —
// этого достаточно, чтобы тесты могли просто звать `user.posts.create(...)`
// после `user.signIn(...)`, не передавая токен вручную.

import type { Hooks } from './generated'
import { withBearer } from './handlers'
import type { UserStore } from './userStore'

export const hooks: Hooks<UserStore> = (h) => {
  // Защищённые эндпоинты — у каждого свой before-хук, который читает
  // токен из ctx (= store текущего юзера).
  h.posts.list.before(withBearer)
  h.posts.get.before(withBearer)
  h.posts.create.before(withBearer)
  h.posts.update.before(withBearer)
  h.posts.delete.before(withBearer)
  h.auth.session.before(withBearer)
  h.auth.signOut.before(withBearer)

  // После создания поста — сохранить id у того юзера, который его создал.
  // ctx здесь = store именно этого пользователя, так что lastPostId
  // не «течёт» между юзерами.
  h.posts.create.after(({ response, ctx }) => {
    if (response.status === 200) {
      ctx.set({ key: 'lastPostId', value: response.body.id })
    }
  })
}
