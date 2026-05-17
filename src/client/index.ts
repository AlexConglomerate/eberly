import { World } from "./world"

const main = async () => {
    const world = new World({
        url: "http://localhost:3000",
    })
    const user1 = world.createUser()
    const answer = await user1.posts.create({
        body: { title: "Hello", content: "World" },
    })
    console.log(answer)
}

main()