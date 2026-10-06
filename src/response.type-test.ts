// Тест ТИПОВ `ApiResponse.assert` (не рантайм): это не `*.test.ts`, его
// проверяет `tsc` (`pnpm lint`). Если ожидаемая ошибка пропадёт, `tsc`
// скажет «Unused '@ts-expect-error' directive».

import type { ApiResponse } from './response'
import type { StandardSchemaV1 } from './standard-schema'

declare const res: ApiResponse<{ 201: { id: string }; 409: { message: string } }>

res.assert(201, { id: 'x' })
res.assert(409, { message: 'x' })
res.assert(403)
res.assert(500, { anything: true })
// @ts-expect-error — 200 не задекларирован (опечатка вместо 201)
res.assert(200)
// @ts-expect-error — 3xx не задекларирован
res.assert(302)
// @ts-expect-error — тело задекларированного 409 типизировано
res.assert(409, { wrong: 1 })
// @ts-expect-error — тело 201 типизировано
res.assert(201, { id: 1 })

// После задекларированного статуса тело сужено до него.
const created: { id: string } = res.assert(201).body
const conflict: { message: string } = res.assert(409).body
// @ts-expect-error — без assert тело — союз всех статусов
const raw: { id: string } = res.body
void [created, conflict, raw]

// Статус из массива требует `as const`, иначе это просто `number`.
for (const s of [401, 403] as const) res.assert(s)

// `data` — тело только 2xx-статусов, без assert.
const fromData: { id: string } = res.data
// @ts-expect-error — тело 4xx в `data` не попадает
const notError: { message: string } = res.data
void [fromData, notError]

// Standard Schema и матчеры во втором аргументе. Схема типизирована своим
// выходом: он должен подходить под тип поля (или частичного тела целиком).

declare const str: StandardSchemaV1<string>
declare const num: StandardSchemaV1<number>
declare const partialBody: StandardSchemaV1<unknown, { id: string }>
declare const wrongBody: StandardSchemaV1<unknown, { id: number }>
declare const anyMatcher: any // так типизирован `expect.any(String)` у vitest

declare const post: ApiResponse<{ 200: { id: string; tags: string[]; author: { age: number } } }>

post.assert(200, { id: str, tags: [str], author: { age: num } })
post.assert(200, { id: anyMatcher })
post.assert(200, partialBody) // схема на всё тело может описывать часть полей
// @ts-expect-error — выход схемы number, а поле — string
post.assert(200, { id: num })
// @ts-expect-error — схема тела с неверным типом поля
post.assert(200, wrongBody)
// @ts-expect-error — схемы не спасают от лишнего поля
post.assert(200, { title: str })
