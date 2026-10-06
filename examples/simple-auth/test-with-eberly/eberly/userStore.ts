// Хранилище переменных и сценариев одного пользователя.
//
// Главные переменные — `token` и `role`: их выставляют сценарии
// (`signUp` / `signIn` / `loginWithGoogle`), а ГЛОБАЛЬНЫЙ before-хук
// `withBearer` (см. `./hooks.ts` + `./handlers.ts`) при КАЖДОМ запросе
// кладёт токен в заголовок `Authorization: Bearer <token>`. Так один
// логин «прилипает» к юзеру и автоматически применяется ко всем
// последующим вызовам — никаких дублирующих `headers:` в тестах.
//
// `email` + `password` сценарии тоже сохраняют — это нужно `refresh()`:
// у BetterAuth для bearer-сессий НЕТ отдельного refresh-token флоу, так
// что «обновление токена» = повторный `signIn` сохранёнными кредами. Его
// дёргает глобальный retry-хук на 401, после чего eberly сам переигрывает
// упавший запрос на свежем токене (см. `./hooks.ts`).

import { BaseStore } from 'eberly'

import type { WorldApi } from './generated'

export type UserVars = {
  email: string
  name: string
  password: string
  token: string
  role: string
  lastPostId: string
}

export class UserStore extends BaseStore<UserVars, WorldApi> {
  /** Зарегистрироваться и сохранить bearer-токен у себя в переменных. */
  public async signUp(args: { email: string; password: string; name: string }): Promise<void> {
    const res = await this.api.auth.signUp({ body: args })
    res.assert(200, { user: { email: args.email, name: args.name, role: 'user' } })
    this.set({ key: 'email', value: args.email })
    this.set({ key: 'name', value: args.name })
    this.set({ key: 'password', value: args.password })
    this.set({ key: 'token', value: res.body.token })
    this.set({ key: 'role', value: res.body.user.role })
  }

  /** Логин по email/паролю — тот же эффект, что и `signUp`, но без создания. */
  public async signIn(args: { email: string; password: string }): Promise<void> {
    const res = await this.api.auth.signIn({ body: args })
    res.assert(200, { user: { email: args.email } })
    this.set({ key: 'email', value: args.email })
    this.set({ key: 'password', value: args.password })
    this.set({ key: 'token', value: res.body.token })
    this.set({ key: 'role', value: res.body.user.role })
  }

  /**
   * «Refresh» токена. BetterAuth не выдаёт refresh-token для bearer-сессий,
   * поэтому обновление = повторный `signIn` сохранёнными email+password.
   * Вызывается из глобального retry-хука на 401 (см. `./hooks.ts`); после
   * него eberly прозрачно переигрывает упавший запрос на свежем токене.
   */
  public async refresh(): Promise<void> {
    const email = this.getSafe({ key: 'email' })
    const password = this.getSafe({ key: 'password' })
    if (!email || !password) {
      throw new Error('refresh: нет сохранённых кредов — сначала signUp/signIn')
    }
    const res = await this.api.auth.signIn({ body: { email, password } })
    res.assert(200)
    this.set({ key: 'token', value: res.body.token })
    this.set({ key: 'role', value: res.body.user.role })
  }

  /** Полный server-side OAuth-флоу через фейковый Google. */
  public async loginWithGoogle(): Promise<void> {
    const res = await this.api.auth.googleLogin({})
    res.assert(200)
    this.set({ key: 'email', value: res.body.user.email })
    this.set({ key: 'name', value: res.body.user.name })
    this.set({ key: 'token', value: res.body.token })
    this.set({ key: 'role', value: res.body.user.role })
  }
}
