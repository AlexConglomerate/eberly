// Переиспользуемые именованные хендлеры. Типизируются библиотечными
// дженериками `BeforeHook` / `AfterHook` (привязаны к твоему `AppStore`),
// поэтому один хендлер можно вешать на разные endpoint'ы из `hooks.ts`.

import type { AfterHook, BeforeHook } from 'ebely'
import type { AppStore } from './internalVariable'

/** Логирует любой ответ: метод, путь, статус, тело. */
export const logResponse: AfterHook<AppStore> = ({ request, response }) => {
  console.log(
    `[${request.method}] ${request.path} → ${response.status}`,
    response.body,
  )
}

/** Подставляет общий заголовок трассировки в любой запрос. */
export const withTrace: BeforeHook<AppStore> = ({ request }) => {
  request.headers['x-trace'] = 'demo'
}
