// World-store: сценарии уровня «всего приложения» — то, что не привязано
// к конкретному пользователю. Здесь это очистка БД (нужна каждому
// тестовому файлу в beforeAll) и повышение пользователя до роли admin
// (нужна тестам ролей).
//
// `this.api` тут — анонимный клиент (без bearer-токена), что и требуется
// для test-helpers `/admin/clear-database` и `/admin/promote`.

import { BaseStore } from 'eberly'

import type { WorldApi } from './generated'

export type WorldVars = {
  resets: number
}

export class WorldStore extends BaseStore<WorldVars, WorldApi> {
  /** Полностью вайпнуть БД (post + все таблицы BetterAuth). */
  public async clearDatabase(): Promise<void> {
    const res = await this.api.admin.clearDatabase()
    res.assert(200, { success: true })
    this.set({ key: 'resets', value: (this.getSafe({ key: 'resets' }) ?? 0) + 1 })
  }

  /** Поднять/опустить роль конкретного пользователя по email. */
  public async promote(args: { email: string; role: string }): Promise<void> {
    const res = await this.api.admin.promote({ body: args })
    res.assert(200, { success: true })
  }

  /**
   * Отозвать все сессии пользователя — его bearer-токен «протухает».
   * Нужно тесту refresh: после revoke первый защищённый вызов вернёт 401,
   * глобальный after-хук сходит за свежим токеном (см. `tests/refresh.test.ts`).
   */
  public async revoke(args: { email: string }): Promise<void> {
    const res = await this.api.admin.revoke({ body: args })
    res.assert(200, { success: true })
  }
}
