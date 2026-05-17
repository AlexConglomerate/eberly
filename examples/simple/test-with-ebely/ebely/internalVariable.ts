import { InternalStore } from "ebely"

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
