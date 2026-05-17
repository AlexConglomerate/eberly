const main = async () => {
    const world = new World({
        url: "http://localhost:3000",
    })
    const user1 = world.createUser()
    const answer = await user1.posts.create()
    console.log(answer)
}

main()