// Этот файл редактирует пользователь библиотеки. Генератор client:generate
// его НЕ трогает. Здесь описывается набор внутренних переменных пользователя
// и производные методы поверх get/set.

import { InternalStore } from "./internal-store"

export type InternalVariable = {
    email: string
    password: string
    accessToken: string
    deviceId: string
    telegramUsername: string
    createdPosts: { postId: string; date: string }[]
    lastPostId: string
}

export class AppStore extends InternalStore<InternalVariable> {
    /** Пример производного метода: id первого созданного поста. */
    public getFirstPostId(): string | undefined {
        const createdPosts = this.get({ key: "createdPosts" })
        return createdPosts?.[0]?.postId
    }
}
