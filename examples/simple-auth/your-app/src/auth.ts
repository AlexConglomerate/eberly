// Конфигурация BetterAuth. Здесь живёт ВСЯ логика авторизации:
// email+пароль, bearer-токены (чтобы клиенту удобно слать
// `Authorization: Bearer <token>`), доп.поле `role` на пользователе,
// и genericOAuth-провайдер с providerId `google`, который смотрит в наш
// локальный фейковый IdP (`./fake-google.ts`) — реальных ключей Google нет.
//
// Сам HTTP-handler BetterAuth (`auth.handler`) НЕ выставлен наружу.
// Все эндпоинты приложения — это oRPC-роутеры (`./router.ts`), которые
// дёргают server-side API BetterAuth (`auth.api.*`) или внутрипроцессно
// вызывают `auth.handler(new Request(...))` для OAuth-флоу.

import { betterAuth } from 'better-auth'
import { bearer, genericOAuth } from 'better-auth/plugins'

import { BASE_URL } from './config'
import { sqlite } from './sqlite'

export const authOptions = {
  baseURL: BASE_URL,
  // BetterAuth понимает better-sqlite3 Database напрямую — внутри
  // подкладывает Kysely-адаптер для SQLite.
  database: sqlite,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      // Доп. поле в таблице `user`. `input: false` означает, что клиент
      // НЕ может передать роль при регистрации — она проставляется по
      // умолчанию ('user'), повышение делается через admin-эндпоинт.
      role: {
        type: 'string' as const,
        required: false,
        defaultValue: 'user',
        input: false,
      },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },
  plugins: [
    // Позволяет авторизовываться через `Authorization: Bearer <token>`
    // (без cookie). Возвращает `set-auth-token` header при логине.
    bearer(),
    // Фейковый Google: BetterAuth честно гоняет authorize → token →
    // userinfo против `./fake-google.ts`, который мы примонтировали на
    // том же HTTP-сервере по путям `/fake-google/*`.
    genericOAuth({
      config: [
        {
          providerId: 'google',
          clientId: 'fake-google-client-id',
          clientSecret: 'fake-google-client-secret',
          authorizationUrl: `${BASE_URL}/fake-google/authorize`,
          tokenUrl: `${BASE_URL}/fake-google/token`,
          userInfoUrl: `${BASE_URL}/fake-google/userinfo`,
          scopes: ['openid', 'email', 'profile'],
          pkce: false,
        },
      ],
    }),
  ],
  // Доверяем нашему BASE_URL — иначе BetterAuth блокирует callback
  // на «чужие» origin'ы.
  trustedOrigins: [BASE_URL],
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-only-secret-please-override',
}

export const auth = betterAuth(authOptions)

/** Какие поля пользователя мы возвращаем наружу. */
export type PublicUser = {
  id: string
  email: string
  name: string
  role: string
}

export function pickUser(user: unknown): PublicUser {
  const u = user as Record<string, unknown>
  return {
    id: String(u.id ?? ''),
    email: String(u.email ?? ''),
    name: String(u.name ?? ''),
    role: String(u.role ?? 'user'),
  }
}
