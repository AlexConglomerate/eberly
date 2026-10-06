// Переиспользуемые именованные хендлеры. Типизируются библиотечными
// дженериками `BeforeHook` / `AfterHook` (привязаны к твоему `UserStore`),
// поэтому один хендлер можно вешать на разные endpoint'ы из `hooks.ts`.

import type { AfterHook, BeforeHook } from 'eberly'
import type { UserStore } from './userStore'

/** Логирует любой ответ: метод, путь, статус, тело. */
export const logResponse: AfterHook<UserStore> = ({ request, response }) => {
  console.log(
    `[${request.method}] ${request.path} → ${response.status}`,
    response.body,
  )
}

/** Подставляет общий заголовок трассировки в любой запрос. */
export const withTrace: BeforeHook<UserStore> = ({ request }) => {
  request.headers['x-trace'] = 'demo'
}
