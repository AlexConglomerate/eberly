
// pnpm --filter @ebely-examples/test-with-ebely run test

import { World } from "../ebely/generated"

const test1 = async () => {
    // url и store берутся из ebely/ebely.ts — аргументы не нужны.
    const world = new World()
    const user1 = world.createUser()

    // Режим 'test': метод возвращает ApiResponse, а не тело напрямую.
    const created = await user1.posts.create({
        body: { title: "Hello", content: "World" },
    })
    // Статус подсказывается интеллисенсом. 200 — ок; написать, например,
    // created.assert(201) — будет ошибка типов (в схеме только 200).
    created.assert(200)
    console.log("created", created.body)

    user1.set({ key: "lastPostId", value: created.body.id })
    const lastPostId = user1.get({ key: "lastPostId" })!

    const res = await user1.posts.get({ path: { id: lastPostId } })
    // Второй аргумент опционален и проверяется глубоко-частично:
    // сверяется только переданное поле, остальные игнорируются.
    res.assert(200, { id: lastPostId })

    // // На будущее.
    // const wsAnswer = await user1.ws.getAndClear({
    //     topic: 'created.post',
    //     // count: 2 // Если ожидаем два сообщения. Если ничего не указано, то по умолчанию ждем одно сообщение.
    //     // под капотом мы постоянно ожидаем ответы. Как только ответ дан, мы сразу же возвращаемся сюда.
    // })
    // wsAnswer.assert({ id: lastPostId, title: "Hello", })

    console.log("res", res.body)

    // Незадекларированный в схеме статус — через `as any`.
    const missing = await user1.posts.get({ path: { id: "does-not-exist" } })
    missing.assert(404 as any)
    console.log("missing", missing.status, missing.body)

    const user2 = world.createUser()
    const created2 = await user2.posts.create({
        body: { title: "Hello", content: "World" },
    })
    created2.assert(200)
    user2.set({ key: "lastPostId", value: created2.body.id })
}

test1()
