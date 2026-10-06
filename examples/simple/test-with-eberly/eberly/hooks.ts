// Хуки before/after для этого бэкенда. Файл ПОЛНОСТЬЮ типизирован: тип
// `Hooks` экспортирует сгенерированный клиент (`generated.ts`), поэтому
// `h.posts.create` автокомплитится, `response.body.id` типизирован, а
// `ctx` — это твой `UserStore`.
//
// Регистрировать можно где угодно (это просто функция) — кладётся одной
// переменной в конфиг (`eberly.ts`). Вызывается один раз при `new World()`.
// Важно: `ctx` внутри хука — store КОНКРЕТНОГО пользователя, сделавшего
// запрос, поэтому запись в переменные не «течёт» между пользователями.

import type { Hooks } from './generated'
import type { UserStore } from './userStore'
import { logResponse } from './handlers'

export const hooks: Hooks<UserStore> = (h) => {
  // ГЛОБАЛЬНЫЙ before — срабатывает на КАЖДЫЙ запрос. Прикручивает токен
  // авторизации из переменных ИМЕННО этого юзера ко всем эндпоинтам разом.
  // `fullRegister` кладёт `accessToken` в стор → дальше все запросы юзера
  // автоматически несут заголовок. У разных юзеров — свои токены (ctx — это
  // store того, кто сделал запрос), так что они не «текут» между собой.
  h.globalBefore(({ request, ctx }) => {
    const token = ctx.get({ key: 'accessToken' })
    if (token) request.headers.Authorization = `Bearer ${token}`
  })

  // ГЛОБАЛЬНЫЙ after — место для сквозной обработки статуса. Например, на
  // 401 здесь можно сходить за refresh и положить новый токен в стор
  // (логику пишет пользователь библиотеки под свой бэкенд):
  //   h.globalAfter(async ({ response, ctx }) => {
  //     if (response.status === 401) await ctx.refreshToken()
  //   })

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