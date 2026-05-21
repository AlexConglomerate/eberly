export const PORT = Number(process.env.PORT ?? 3000)
export const BASE_URL = (process.env.BASE_URL ?? `http://localhost:${PORT}`).replace(/\/$/, '')

/** BetterAuth-эндпоинты живут под этим префиксом (default basePath). */
export const AUTH_BASE_PATH = '/api/auth'

/** Фиксированный «фейковый Google-аккаунт» — то, что вернёт наш фейковый IdP. */
export const FAKE_GOOGLE_PROFILE = {
  sub: 'fake-google-user-123',
  email: 'googler@example.com',
  email_verified: true,
  name: 'Fake Googler',
  picture: 'https://example.com/avatar.png',
} as const
