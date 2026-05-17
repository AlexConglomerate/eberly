export type internalVariable = {
    email: string,
    password: string,
    accessToken: string,
    deviceId: string,
    telegramUsername: string,
    createdPosts: { postId: string, date: string }[],
    lastPostId: string,
}


export class internalVariableiae<internalVariable> {
    constructor() { }

    public getFirstPostId() {
        const createdPosts = this.get("lastPostId")
        const firstPostId = createdPosts[0].id
        return firstPostId
    }
}
