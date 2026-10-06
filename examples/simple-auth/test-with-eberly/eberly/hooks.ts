// Регистрация хуков. Здесь демонстрируются ГЛОБАЛЬНЫЕ хуки eberly
// (`h.globalBefore` / `h.globalRetry`) — они срабатывают на КАЖДУЮ
// операцию, поэтому сквозные задачи авторизации описываются один раз, а
// не вешаются на каждый эндпоинт вручную.
//
// Было (поэндпоинтно):
//   h.posts.list.before(withBearer)
//   h.posts.get.before(withBearer)
//   h.posts.create.before(withBearer)
//   ...ещё пять строк...
// Стало (один глобальный хук): h.globalBefore(withBearer).

import type { Hooks } from './generated'
import { withBearer } from './handlers'
import type { UserStore } from './userStore'

export const hooks: Hooks<UserStore> = (h) => {
  // ── ГЛОБАЛЬНЫЙ before ───────────────────────────────────────────────
  // На КАЖДЫЙ запрос подставляет `Authorization: Bearer <token>` из ctx
  // (= store текущего юзера). Один логин «прилипает» к юзеру и едет во все
  // последующие вызовы. На анонимных эндпоинтах (sign-in/sign-up) токена
  // в сторе нет — хук просто молчит.
  // #region docs:global-before
  h.globalBefore(withBearer)
  // #endregion

  // ── ГЛОБАЛЬНЫЙ retry ────────────────────────────────────────────────
  // Прозрачная обработка протухшего токена. На 401 идём за refresh, кладём
  // свежий токен в стор и возвращаем `true` — eberly сам ПЕРЕИГРЫВАЕТ тот
  // же запрос: заново прогонит globalBefore (withBearer возьмёт уже
  // обновлённый токен) и пошлёт fetch. Для теста 401 «растворяется»: вызов
  // сразу отдаёт 200. Никаких ручных повторных вызовов.
  // НЕ рефрешим сами auth-эндпоинты: иначе 401 на signIn (неверный пароль)
  // → refresh → signIn → 401 → ... И /auth/session после signOut честно
  // должен оставаться 401. (Плюс есть жёсткий потолок maxRetries в ядре.)
  // refresh = повторный signIn; без сохранённых кредов (анонимный юзер,
  // OAuth-юзер без пароля) рефрешить нечем — оставляем 401 как есть.
  // Комментарии внутри региона — на английском: он виден на сайте.
  // #region docs:global-retry
  h.globalRetry(async ({ request, response, ctx }) => {
    if (response.status !== 401) return false
    // Don't refresh auth endpoints themselves: a wrong password must stay 401.
    if (request.path.startsWith('/auth/')) return false
    if (!ctx.get({ key: 'email' }) || !ctx.get({ key: 'password' })) return false
    await ctx.refresh()
    return true // → eberly replays the request with the fresh token
  })
  // #endregion

  // ── Поименный after ─────────────────────────────────────────────────
  // После создания поста — сохранить id у того юзера, который его создал.
  // ctx здесь = store именно этого пользователя, так что lastPostId
  // не «течёт» между юзерами. Порядок: поименные after → глобальные after.
  h.posts.create.after(({ response, ctx }) => {
    if (response.status === 200) {
      ctx.set({ key: 'lastPostId', value: response.body.id })
    }
  })
}
