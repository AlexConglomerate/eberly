// Тест ТИПОВ `ApiResponse.assert` (не рантайм): это не `*.test.ts`, его
// проверяет `tsc` (`pnpm lint`). Если ожидаемая ошибка пропадёт, `tsc`
// скажет «Unused '@ts-expect-error' directive».

import type { ApiResponse } from './response'

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
