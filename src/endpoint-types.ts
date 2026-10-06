// Типы частей вызова эндпоинта, выведенные из его сигнатуры в `WorldApi`:
// `BodyOf<typeof alice.posts.create>` → `CreatePostDto`. Чистые типы, без
// рантайма; генератор их не знает — работают поверх любого клиента.

import type { ApiResponse, SuccessStatus } from './response'

/** Любой метод сгенерированного клиента: `(input?) => Promise<…>`. */
type Endpoint = (input: never) => Promise<unknown>

/** Аргумент вызова без `undefined` (у `(input?: …)` он необязательный). */
type InputOf<F extends Endpoint> = F extends (input: infer I) => unknown ? NonNullable<I> : never

/** Поле аргумента вызова; нет такого поля у эндпоинта → `never`. */
type FieldOf<F extends Endpoint, K extends string> =
  K extends keyof InputOf<F> ? NonNullable<InputOf<F>[K]> : never

/** Карта «статус → тело» (режим `'test'`); в `'frontend'` — `never`. */
type StatusMapOf<F extends Endpoint> =
  Awaited<ReturnType<F>> extends ApiResponse<infer M> ? M : never

/** Тело запроса: `const post = { … } satisfies BodyOf<typeof alice.posts.create>`. */
export type BodyOf<F extends Endpoint> = FieldOf<F, 'body'>

/** Query-параметры: `QueryOf<typeof alice.posts.list>`. */
export type QueryOf<F extends Endpoint> = FieldOf<F, 'query'>

/** Path-параметры: `PathOf<typeof alice.posts.get>`. */
export type PathOf<F extends Endpoint> = FieldOf<F, 'path'>

/**
 * Тело ответа. В режиме `'test'` — тело статуса `S` (по умолчанию —
 * задекларированных 2xx, как у `res.data`): `ResponseOf<typeof alice.posts.create, 400>`.
 * В режиме `'frontend'` метод возвращает тело напрямую — оно и есть ответ,
 * `S` не используется.
 */
export type ResponseOf<
  F extends Endpoint,
  S extends keyof StatusMapOf<F> = SuccessStatus<StatusMapOf<F>>,
> = Awaited<ReturnType<F>> extends ApiResponse<infer M> ? M[S & keyof M] : Awaited<ReturnType<F>>
