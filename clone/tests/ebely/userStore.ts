// Внутренние переменные и СЦЕНАРИИ одного пользователя.
//
// Второй дженерик `BaseStore<Vars, WorldApi>` даёт `this.api` —
// типизированное дерево вызовов эндпоинтов ОТ ЛИЦА ЭТОГО пользователя
// (его заголовки, его переменные, его `ctx` в хуках). Поэтому
// многошаговую подготовку (регистрация → подтверждение по коду) можно
// спрятать за одним методом `fullRegister`, а в тестах звать его одной
// строкой. `WorldApi` — `import type` → рантайм-цикла нет (как hooks.ts).

import { BaseStore } from "ebely"
import type { WorldApi } from "./generated"

export type InternalVariable = {
    email: string
    password: string
    accessToken: string
    deviceId: string
    telegramUsername: string
    createdPosts: { postId: string; date: string }[]
    lastPostId: string
}

export class UserStore extends BaseStore<InternalVariable, WorldApi> {
    /** Пример производного метода: id первого созданного поста. */
    public getFirstPostId(): string | undefined {
        const createdPosts = this.get({ key: "createdPosts" })
        return createdPosts?.[0]?.postId
    }

    /**
     * Сценарий: полная регистрация одним вызовом. Под капотом — серия
     * эндпоинтов (register → confirm), как было бы в реальном флоу с
     * кодом из письма. Тест зовёт это одной строкой и не дублирует шаги.
     */
    public async fullRegister(args: {
        email: string
        password: string
    }): Promise<void> {
        const { email, password } = args

        const registered = await this.api.auth.register({
            body: { email, password },
        })
        registered.assert(200, { email })

        // «код из письма» — здесь просто заглушка (бэкенд его не проверяет)
        const confirmed = await this.api.auth.confirm({
            body: { code: "0000" },
        })
        confirmed.assert(200)

        this.set({ key: "email", value: email })
        this.set({ key: "password", value: password })
        this.set({ key: "accessToken", value: `token-for-${email}` })
    }
}
