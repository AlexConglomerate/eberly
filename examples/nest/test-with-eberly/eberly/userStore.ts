// Переменные и сценарии одного пользователя.
//
// `signUp` прячет за одним вызовом регистрацию и логин: тесты зовут его
// одной строкой, а токен сохраняется в стор и дальше сам едет во все
// запросы этого юзера (глобальный before-хук в `./hooks.ts`).

import { BaseStore } from 'eberly'

import type { WorldApi } from './generated'

export type UserVars = {
  email: string
  password: string
  accessToken: string
  lastPostId: number
}

export class UserStore extends BaseStore<UserVars, WorldApi> {
  /** Сценарий: register (201) → login (200) → сохранить токен. */
  public async signUp(args: { email: string; password: string }): Promise<void> {
    const { email, password } = args

    const registered = await this.api.auth.register({ body: { email, password } })
    registered.assert(201, { email, avatarUrl: null })

    const loggedIn = await this.api.auth.login({ body: { email, password } })
    // assert сужает тело до 200 (TokenDto) — `accessToken` без каста.
    const { accessToken } = loggedIn.assert(200, { user: { email } }).body

    this.set({ key: 'email', value: email })
    this.set({ key: 'password', value: password })
    this.set({ key: 'accessToken', value: accessToken })
  }
}
