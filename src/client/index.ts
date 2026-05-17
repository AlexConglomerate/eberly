import { World } from "./world"

const main = async () => {
    const world = new World({
        url: "http://localhost:3000",
    })
    const user1 = world.createUser()
    const answer1 = await user1.posts.create({
        body: { title: "Hello", content: "World" },
    })
    console.log(answer1)

    user1.set("lastPostId", answer1.id)
    const lastPostId1 = user1.get("lastPostId")
    console.log(lastPostId1)

    const user2 = world.createUser()
    const answer2 = await user2.posts.create({
        body: { title: "Hello", content: "World" },
    })
    user2.set("lastPostId", answer1.id)
    const lastPostId2 = user2.get("lastPostId")
    console.log(lastPostId2)
}

main()