// Тест ТИПОВ `BodyOf` / `QueryOf` / `PathOf` / `ResponseOf` (не рантайм): это
// не `*.test.ts`, его проверяет `tsc` (`pnpm lint`). Сигнатуры — как в
// сгенерированном `WorldApi` обоих режимов.

import type { BodyOf, PathOf, QueryOf, ResponseOf } from './endpoint-types'
import type { ApiResponse } from './response'

/** `true`, только если типы совпадают точно (а не просто совместимы). */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

type Post = { id: number; title: string }
type NewPost = { title: string }
type Err = { message: string }

// Режим 'test': методы возвращают ApiResponse.
type Create = (input: { body: NewPost }) => Promise<ApiResponse<{ 201: Post; 400: Err }>>
type List = (input?: { query?: { authorId?: number } }) => Promise<ApiResponse<{ 200: Post[] }>>
type Get = (input: { path: { postId: number } }) => Promise<ApiResponse<{ 200: Post; 404: Err }>>
type Me = (input?: {}) => Promise<ApiResponse<{ 200: Post; 201: Err }>>

const body: Equal<BodyOf<Create>, NewPost> = true
const query: Equal<QueryOf<List>, { authorId?: number }> = true
const path: Equal<PathOf<Get>, { postId: number }> = true
// Нет такой части у эндпоинта → never.
const noBody: Equal<BodyOf<Get>, never> = true
const noPath: Equal<PathOf<Me>, never> = true

// По умолчанию — тело 2xx (как `res.data`), с несколькими 2xx — союз.
const created: Equal<ResponseOf<Create>, Post> = true
const twoSuccess: Equal<ResponseOf<Me>, Post | Err> = true
const byStatus: Equal<ResponseOf<Create, 400>, Err> = true
// @ts-expect-error — 404 у Create не задекларирован
type Undeclared = ResponseOf<Create, 404>

// Режим 'frontend': метод возвращает тело напрямую.
type FrontCreate = (input: { body: NewPost }) => Promise<Post>
const frontBody: Equal<BodyOf<FrontCreate>, NewPost> = true
const frontResponse: Equal<ResponseOf<FrontCreate>, Post> = true

// Главный сценарий: ошибки видны там, где объявлены данные.
const ok = { title: 'Hello' } satisfies BodyOf<Create>
// @ts-expect-error — опечатка в поле
const typo = { titel: 'Hello' } satisfies BodyOf<Create>
// @ts-expect-error — `BodyOf` принимает только метод клиента
type NotEndpoint = BodyOf<string>

void [body, query, path, noBody, noPath, created, twoSuccess, byStatus, frontBody, frontResponse, ok, typo]
export type { Undeclared, NotEndpoint }
