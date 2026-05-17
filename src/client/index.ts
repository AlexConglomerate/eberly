import { World } from "./world"
import { AppStore } from "./internalVariable"

// pnpm tsx src/client/index.ts

const main = async () => {
    const world = new World({
        url: "http://localhost:3000",
        store: AppStore,
    })
    const user1 = world.createUser()
    const answer1 = await user1.posts.create({
        body: { title: "Hello", content: "World" },
    })
    console.log(answer1)

    user1.set({ key: "lastPostId", value: answer1.id })
    const lastPostId1 = user1.get({ key: "lastPostId" })
    console.log(lastPostId1)
    console.log(user1.getFirstPostId())

    const user2 = world.createUser()
    const answer2 = await user2.posts.create({
        body: { title: "Hello", content: "World" },
    })
    user2.set({ key: "lastPostId", value: answer2.id })
    const lastPostId2 = user2.get({ key: "lastPostId" })
    console.log(lastPostId2)
}

main()