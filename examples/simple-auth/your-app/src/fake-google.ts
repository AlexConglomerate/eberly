// Минимальный «фейковый Google» — локальный OAuth2 Identity Provider.
//
// Цель: пройти весь реальный OAuth2-флоу из BetterAuth (genericOAuth),
// НЕ имея настоящих ключей и не выходя в интернет. BetterAuth ничего не
// знает о том, что IdP фейковый — он честно делает authorize-redirect →
// обмен `code` на `access_token` → запрос `/userinfo`, и получает наш
// фиксированный «гугловый» аккаунт (`FAKE_GOOGLE_PROFILE` в config.ts).
//
// Три эндпоинта:
//   GET  /fake-google/authorize  — без UI, сразу 302 на redirect_uri.
//   POST /fake-google/token      — обмен code → access_token (JSON).
//   GET  /fake-google/userinfo   — возвращает фиксированный профиль.

import type { IncomingMessage, ServerResponse } from 'node:http'

import { FAKE_GOOGLE_PROFILE } from './config'

/** code/access_token → 1, чтобы не выдавать одно и то же дважды. Не критично. */
const issuedCodes = new Set<string>()
const issuedTokens = new Set<string>()

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = ''
    req.on('data', (chunk) => (buf += chunk))
    req.on('end', () => resolve(buf))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

/**
 * Пытается обработать запрос как fake-google-роут. Возвращает `true`,
 * если ответ уже отдан, иначе `false` — пусть основной роутер разбирается.
 */
export async function handleFakeGoogle({
  req,
  res,
  url,
}: {
  req: IncomingMessage
  res: ServerResponse
  url: URL
}): Promise<boolean> {
  if (!url.pathname.startsWith('/fake-google/')) return false

  // --- /authorize: моментальный «approve»: 302 на redirect_uri с code+state.
  if (url.pathname === '/fake-google/authorize' && req.method === 'GET') {
    const redirectUri = url.searchParams.get('redirect_uri')
    const state = url.searchParams.get('state') ?? ''
    if (!redirectUri) {
      json(res, 400, { error: 'invalid_request', error_description: 'missing redirect_uri' })
      return true
    }
    const code = `fake-code-${Math.random().toString(36).slice(2, 12)}`
    issuedCodes.add(code)

    const dest = new URL(redirectUri)
    dest.searchParams.set('code', code)
    if (state) dest.searchParams.set('state', state)

    res.statusCode = 302
    res.setHeader('location', dest.toString())
    res.end()
    return true
  }

  // --- /token: обмен code → access_token.
  if (url.pathname === '/fake-google/token' && req.method === 'POST') {
    const raw = await readBody(req)
    const contentType = req.headers['content-type'] ?? ''
    let params: URLSearchParams
    if (contentType.includes('application/x-www-form-urlencoded')) {
      params = new URLSearchParams(raw)
    } else if (contentType.includes('application/json')) {
      try {
        const obj = JSON.parse(raw) as Record<string, string>
        params = new URLSearchParams(obj)
      } catch {
        params = new URLSearchParams()
      }
    } else {
      // best-effort: пробуем и так, и так
      params = raw.includes('=') ? new URLSearchParams(raw) : new URLSearchParams()
    }

    const code = params.get('code')
    const grantType = params.get('grant_type')
    if (grantType !== 'authorization_code' || !code || !issuedCodes.has(code)) {
      json(res, 400, { error: 'invalid_grant' })
      return true
    }
    issuedCodes.delete(code)

    const accessToken = `fake-access-${Math.random().toString(36).slice(2, 14)}`
    issuedTokens.add(accessToken)

    json(res, 200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid email profile',
    })
    return true
  }

  // --- /userinfo: возвращаем фиксированный «гугловый» профиль.
  if (url.pathname === '/fake-google/userinfo' && req.method === 'GET') {
    const auth = req.headers['authorization'] ?? ''
    const match = /^bearer\s+(.+)$/i.exec(String(auth))
    if (!match || !issuedTokens.has(match[1]!)) {
      json(res, 401, { error: 'invalid_token' })
      return true
    }
    json(res, 200, { ...FAKE_GOOGLE_PROFILE })
    return true
  }

  // Любой другой путь под /fake-google/ — 404.
  json(res, 404, { error: 'not_found' })
  return true
}
