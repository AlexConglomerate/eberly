// Сценарии уровня всего приложения. `this.api` — анонимный клиент.

import { BaseStore } from 'eberly'

import type { WorldApi } from './generated'

export type WorldVars = Record<string, never>

export class WorldStore extends BaseStore<WorldVars, WorldApi> {
  /** Очистить все данные бэкенда (`POST /test/reset`, только `TEST_MODE=1`). */
  public async reset(): Promise<void> {
    const res = await this.api.test.reset()
    res.assert(200, { ok: true })
  }
}
