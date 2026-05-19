// Хуки before/after для этого бэкенда. Файл ПОЛНОСТЬЮ типизирован: тип
// `Hooks` экспортирует сгенерированный клиент (`generated.ts`), поэтому
// `h.posts.create` автокомплитится, `response.body.id` типизирован, а
// `ctx` — это твой `UserStore`.
//
// Регистрировать можно где угодно (это просто функция) — кладётся одной
// переменной в конфиг (`ebely.ts`). Вызывается один раз при `new World()`.
// Важно: `ctx` внутри хука — store КОНКРЕТНОГО пользователя, сделавшего
// запрос, поэтому запись в переменные не «течёт» между пользователями.

import type { Hooks } from './generated'
import type { UserStore } from './userStore'
import { logResponse } from './handlers'

export const hooks: Hooks<UserStore> = (h) => {
  // после создания поста — сохранить id в переменные ИМЕННО этого юзера
  h.posts.create.after(({ response, ctx }) => {
    ctx.set({ key: 'lastPostId', value: response.body.id })
  })

  // перед получением поста — подставить заголовок (before может править запрос)
  h.posts.get.before(({ request }) => {
    request.headers['x-trace'] = 'demo'
  })

  // несколько хуков на один endpoint складываются в очередь
  h.posts.create.after(logResponse)
}