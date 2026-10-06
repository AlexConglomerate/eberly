// Серверная оркестрация OAuth-флоу через BetterAuth — чтобы клиент
// (eberly-тесты) мог одним POST'ом получить bearer-токен без браузера,
// cookies и редиректов.
//
// Под капотом честно выполняются три шага, каждый — настоящий вызов
// BetterAuth (`auth.handler`) или фейкового IdP (`/fake-google/*`):
//
//   1. POST /api/auth/sign-in/oauth2  (BetterAuth, genericOAuth)
//      → возвращает authorize-URL и Set-Cookie со state.
//   2. GET <authorize-URL>            (наш фейковый IdP)
//      → 302 на /api/auth/oauth2/callback/google?code=...&state=...
//   3. GET <callback>  + cookie state (BetterAuth)
//      → BetterAuth обменивает code на токен у фейкового IdP, тащит
//        userinfo, создаёт user+session+account. Возвращает session
//        cookie и bearer-token (header `set-auth-token`).
//
// На выходе — bearer-token, который дальше клиент шлёт как
// `Authorization: Bearer <token>`.

import { auth } from './auth'
import { BASE_URL, AUTH_BASE_PATH } from './config'

function cookiePairsFromSetCookie(setCookies: string[]): string {
  return setCookies
    .map((c) => c.split(';')[0]!.trim())
    .filter(Boolean)
    .join('; ')
}

function tryReadSessionTokenFromCookies(setCookies: string[]): string | null {
  for (const c of setCookies) {
    const pair = c.split(';')[0]!.trim()
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    const name = pair.slice(0, eq)
    const value = decodeURIComponent(pair.slice(eq + 1))
    if (name === 'better-auth.session_token' || name.endsWith('.session_token')) {
      return value
    }
  }
  return null
}

export type GoogleLoginResult = {
  token: string
}

/**
 * Полный server-side OAuth-флоу. Бросает Error, если что-то пошло не
 * так (это обернёт ORPCError в роутере).
 */
export async function performGoogleLogin(): Promise<GoogleLoginResult> {
  // 1. Старт OAuth: получить authorize URL и state-cookie.
  const startRes = await auth.handler(
    new Request(`${BASE_URL}${AUTH_BASE_PATH}/sign-in/oauth2`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerId: 'google',
        callbackURL: '/',
      }),
    }),
  )
  if (startRes.status !== 200) {
    throw new Error(`oauth start failed: ${startRes.status} ${await startRes.text()}`)
  }
  const startJson = (await startRes.json()) as { url?: string; redirect?: boolean }
  if (!startJson.url) throw new Error('oauth start: missing url')
  const stateCookies = startRes.headers.getSetCookie()

  // 2. Дёргаем фейковый IdP — он сразу 302 на наш callback.
  const authorizeRes = await fetch(startJson.url, { redirect: 'manual' })
  if (authorizeRes.status !== 302) {
    throw new Error(`oauth authorize: expected 302, got ${authorizeRes.status}`)
  }
  const callbackUrl = authorizeRes.headers.get('location')
  if (!callbackUrl) throw new Error('oauth authorize: missing Location')

  // 3. Зовём BetterAuth callback с тем же state-cookie.
  const cookieHeader = cookiePairsFromSetCookie(stateCookies)
  const callbackRes = await auth.handler(
    new Request(callbackUrl, {
      method: 'GET',
      headers: { cookie: cookieHeader },
      redirect: 'manual',
    }),
  )

  // На успех BetterAuth отвечает 302 на callbackURL ('/'), на ошибку — 302
  // на error URL вида '/?error=...'.
  const cbLocation = callbackRes.headers.get('location') ?? ''
  if (cbLocation.includes('error=')) {
    throw new Error(`oauth callback rejected: ${cbLocation}`)
  }

  const setCookies = callbackRes.headers.getSetCookie()
  const bearerFromHeader = callbackRes.headers.get('set-auth-token')
  const token = bearerFromHeader ?? tryReadSessionTokenFromCookies(setCookies)
  if (!token) {
    throw new Error('oauth callback: no session token issued')
  }

  return { token }
}
