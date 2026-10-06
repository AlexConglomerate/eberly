// Внутренние переменные и СЦЕНАРИИ уровня WORLD — то же, что
// `userStore.ts`, но область не «один пользователь», а весь мир.
// Экземпляр этого класса и есть `world` (генерируемый `World` наследует
// его), поэтому всё объявленное здесь доступно как `world.<...>()`.
//
// `this.api` здесь — АНОНИМНЫЙ клиент (без per-user заголовков): сценарии
// подготовки/очистки бьют по бэкенду «от имени мира». `WorldApi`
// импортируется как `import type` → рантайм-цикла нет (см. hooks.ts /
// ARCHITECTURE.md §8).

import { BaseStore } from "eberly"
import type { WorldApi } from "./generated"

export type WorldVariable = {
    /** Сколько раз за прогон чистили базу — пример world-переменной. */
    resets: number
}

export class WorldStore extends BaseStore<WorldVariable, WorldApi> {
    /** Сценарий: очистить базу одним вызовом `world.clearDatabase()`. */
    public async clearDatabase(): Promise<void> {
        const res = await this.api.admin.clearDatabase()
        res.assert(200, { success: true })
        this.set({ key: "resets", value: (this.getSafe({ key: "resets" }) ?? 0) + 1 })
    }
}
