// World-store: сценарии уровня «всего приложения» — то, что не привязано
// к конкретному пользователю. Здесь это очистка БД (нужна каждому
// тестовому файлу в beforeAll) и повышение пользователя до роли admin
// (нужна тестам ролей).
//
// `this.api` тут — анонимный клиент (без bearer-токена), что и требуется
// для test-helpers `/admin/clear-database` и `/admin/promote`.

import { BaseStore } from 'ebely'

import type { WorldApi } from './generated'

export type WorldVars = {
  resets: number
}

export class WorldStore extends BaseStore<WorldVars, WorldApi> {
  /** Полностью вайпнуть БД (post + все таблицы BetterAuth). */
  public async clearDatabase(): Promise<void> {
    const res = await this.api.admin.clearDatabase()
    res.assert(200, { success: true })
    this.set({ key: 'resets', value: (this.get({ key: 'resets' }) ?? 0) + 1 })
  }

  /** Поднять/опустить роль конкретного пользователя по email. */
  public async promote(args: { email: string; role: string }): Promise<void> {
    const res = await this.api.admin.promote({ body: args })
    res.assert(200, { success: true })
  }
}
