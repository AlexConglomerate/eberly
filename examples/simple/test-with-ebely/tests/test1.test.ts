import { randomUUID } from "node:crypto"
import { beforeAll, describe, expect, test } from "vitest"
import { World } from "../ebely/generated"

describe("posts", () => {
    const world = new World()
    const user1 = world.createUser()
    const user2 = world.createUser()

    beforeAll(async () => {
        await world.clearDatabase()
        await user1.fullRegister({ email: "a@x.com", password: "password" })
        await user1.fullRegister({ email: "b@x.com", password: "password" })
    })

    test("user1 создаёт пост", async () => {
        const created = await user1.posts.create({
            body: { title: "Hello", content: "World" },
        })
        created.assert(200)
    })

    test("user1 читает созданный пост", async () => {
        const created = await user1.posts.create({
            body: { title: "Hello", content: "World" },
        })
        created.assert(200)

        const lastPostId = user1.get({ key: "lastPostId" })!
        const res = await user1.posts.get({ path: { id: lastPostId } })
        res.assert(200, { id: lastPostId, title: created.body.title })
    })

    test("несуществующий пост → 404", async () => {
        const missing = await user1.posts.get({ path: { id: "does-not-exist" } })
        missing.assert(404)
    })

    test("изоляция: у каждого пользователя свой lastPostId", async () => {
        const testContent = randomUUID()
        const created2 = await user2.posts.create({
            body: { title: "Hello", content: testContent },
        })
        created2.assert(200, { content: testContent })

        const p1 = user1.get({ key: "lastPostId" })!
        const p2 = user2.get({ key: "lastPostId" })!

        // Тот же хук, но ctx = store user2 → у каждого свой lastPostId.
        expect(p1).toBeTruthy()
        expect(p2).toBeTruthy()
        expect(p1).not.toBe(p2)
    })
})

// Два эндпоинта, отличающиеся ТОЛЬКО методом (GET/POST /auth/session с
// общим operationId `auth.getSession`). Генератор развёл коллизию имён
// префиксом метода: getGetSession / postGetSession.
describe("эндпоинты, отличающиеся только методом", () => {
    const world = new World()
    const user = world.createUser()

    test("GET /auth/session → getGetSession", async () => {
        const res = await user.auth.getGetSession()
        res.assert(200, { method: "GET" })
    })

    test("POST /auth/session → postGetSession", async () => {
        const res = await user.auth.postGetSession({ body: { token: "t" } })
        res.assert(200, { method: "POST" })
    })
})

// // На будущее.
// const wsAnswer = await user1.ws.getAndClear({
//     topic: 'created.post',
//     // count: 2 // Если ожидаем два сообщения. Если ничего не указано, то по умолчанию ждем одно сообщение.
//     // под капотом мы постоянно ожидаем ответы. Как только ответ дан, мы сразу же возвращаемся сюда.
// })
// wsAnswer.assert({ id: lastPostId, title: "Hello", })
