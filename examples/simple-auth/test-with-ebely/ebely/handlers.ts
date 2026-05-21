// Переиспользуемые именованные хуки. Один файл — много эндпоинтов в
// `./hooks.ts`. Так в тесте не нужно вручную таскать bearer-токен по
// всем `headers`: достаточно один раз вызвать `user.signIn(...)`, и
// дальше все защищённые эндпоинты автоматически уйдут с этим токеном.

import type { AfterHook, BeforeHook } from 'ebely'

import type { UserStore } from './userStore'

/**
 * Подставляет `Authorization: Bearer <token>` из переменных юзера в
 * каждый запрос, к которому этот хук привязан. Если токена нет — хук
 * молча ничего не делает (анонимный запрос).
 */
export const withBearer: BeforeHook<UserStore> = ({ request, ctx }) => {
  const token = ctx.get({ key: 'token' })
  if (token) {
    request.headers['authorization'] = `Bearer ${token}`
  }
}

/** Лог любого ответа: метод, путь, статус, тело. */
export const logResponse: AfterHook<UserStore> = ({ request, response }) => {
  // Чтобы не «пачкать» вывод тестов, по умолчанию молчим. Включите по
  // желанию: разкомментируйте console.log ниже.
  void request
  void response
  // console.log(`[${request.method}] ${request.path} → ${response.status}`, response.body)
}
