// import { describe, it, expect, beforeEach, afterEach } from "vitest";

// type internalVariable = {
//     email: string,
//     password: string,
//     accessToken: string,
//     deviceId: string,
//     telegramUsername: string,
//     createdPosts: { postId: string, date: string }[],
// }


// // здесь у нас находится обработчик, в котором мы можем прописать какие-то действия, которые будут выполняться как до, так и после работы endpoint. То есть, допустим, создан какой-то поток, ну или там создан какой-то пост. И мы перехватываем ответ, который на фронтен будет как бы отсылаться. И после этого записываем во внутренние переменные это.
// const interceptor = (
//     schema: any, // сюда передается swagger схема со всеми point ами что они там принимаются все типизации что не принимают возражают и так далее
// ) => {
//     schema.postUser = ({ body, headers }) => {
//         internalVariable.set('accessToken', headers.authorization)
//     },
//         schema.createPost = ({ body, headers }, after) => { //
//             internalVariable.set('lastFlow', after.body.postId)
//         },
// }

// describe("invite flow", () => {
//     let world: TestWorld;

//     beforeEach(() => {
//         world = new TestWorld({
//             url: "http://localhost:3000",
//         });
//     });

//     afterEach(() => {
//         world.teardown();
//     });

//     it("manager invites curator", async () => {
//         const manager = world.createUser({ email: "m@x.com", password: "password" });
//         const curator = world.createUser({ email: "c@x.com" });

//         // эти функции создает пользователь
//         await world.clearDatabase();
//         await world.seed()


//         manager.set('deviceId', '123')
//         const deviceId = manager.get('deviceId')

//         await manager.sendInvite(curator.email); // внутри метода дергается Endpoint.

//         expect(curator.inbox.at(-1)?.extractCode()).toBeDefined();
//     });
// });