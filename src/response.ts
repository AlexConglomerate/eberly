// Рантайм-обёртка ответа эндпоинта (НЕ генерируется). Попадает в npm-пакет
// как есть и импортируется сгенерированным клиентом — по аналогии с
// BaseStore. Используется только в режиме клиента 'test'.
//
// Вся логика проверки вынесена в ЧИСТЫЕ функции (assertResponse /
// matchPartial) без сети и fetch — их легко юнит-тестировать в изоляции.

import { isStandardSchema, type StandardSchemaV1 } from './standard-schema'

/** Глубоко-частичный тип: на каждом уровне все поля необязательны. */
export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

/**
 * Ожидаемое тело для `assert`: глубоко-частичное, и на любом уровне вместо
 * значения можно передать
 * - Standard Schema (Zod, Valibot, ArkType…) — её выход должен подходить
 *   под тип поля: `id: z.uuid()` на числовом `id` — ошибка типов;
 * - асимметричный матчер vitest/jest (`expect.any(Number)`): он типизирован
 *   как `any`, поэтому подходит к любому полю.
 */
export type Expected<T> =
  | StandardSchemaV1<unknown, DeepPartial<T>>
  | (T extends (infer U)[]
      ? Expected<U>[]
      : T extends object
        ? { [K in keyof T]?: Expected<T[K]> }
        : T)

/** Ошибка проваленной проверки `res.assert(...)`. */
export class EberlyAssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EberlyAssertionError'
  }
}

/**
 * Обрезает стек ошибки по вызов `fn` включительно: первым кадром становится
 * строка теста, и vitest показывает её, а не внутренности eberly.
 */
function trimStack(args: { error: Error; fn: (...args: never[]) => unknown }): Error {
  Error.captureStackTrace?.(args.error, args.fn)
  return args.error
}

/**
 * Описание первого найденного расхождения тела ответа с эталоном.
 * `message` — текст проблемы от схемы (`Invalid email address`).
 */
export type Mismatch = { path: string; expected: unknown; actual: unknown; message?: string }

/** Асимметричный матчер vitest/jest: `expect.any(Number)`, `expect.stringMatching(…)`. */
type AsymmetricMatcher = {
  asymmetricMatch: (other: unknown) => boolean
  toAsymmetricMatcher?: () => string
}

function isAsymmetricMatcher(value: unknown): value is AsymmetricMatcher {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { asymmetricMatch?: unknown }).asymmetricMatch === 'function'
  )
}

/** `user` + `name` → `user.name`, `items` + `0` → `items[0]`. */
function joinPath(args: { path: string; key: PropertyKey }): string {
  const { path, key } = args
  if (typeof key === 'number') return `${path}[${key}]`
  return path ? `${path}.${String(key)}` : String(key)
}

/** Проверка значения схемой; путь из `issue.path` дописывается к `path`. */
function matchSchema(args: {
  actual: unknown
  schema: StandardSchemaV1
  path: string
}): Mismatch | null {
  const { actual, schema, path } = args
  const result = schema['~standard'].validate(actual)
  if (result instanceof Promise) {
    result.catch(() => {})
    throw new TypeError(
      `Async schemas are not supported in assert (at "${path || '<root>'}"). ` +
        'Remove async refinements or validate the body yourself.',
    )
  }
  const issue = result.issues?.[0]
  if (!issue) return null

  let issuePath = path
  let issueActual = actual
  for (const segment of issue.path ?? []) {
    const key = typeof segment === 'object' ? segment.key : segment
    issuePath = joinPath({ path: issuePath, key })
    issueActual =
      issueActual !== null && typeof issueActual === 'object'
        ? (issueActual as Record<PropertyKey, unknown>)[key]
        : undefined
  }
  return { path: issuePath, expected: schema, actual: issueActual, message: issue.message }
}

/** Как показать ожидаемое значение в сообщении об ошибке. */
function describeExpected(expected: unknown): string {
  if (isStandardSchema(expected)) {
    return `a value matching the ${expected['~standard'].vendor} schema`
  }
  if (isAsymmetricMatcher(expected)) {
    if (expected.toAsymmetricMatcher) return expected.toAsymmetricMatcher()
    const sample = (expected as { sample?: unknown }).sample
    if (sample === undefined) return String(expected)
    return `${String(expected)}(${sample instanceof RegExp ? String(sample) : safeJson(sample)})`
  }
  return safeJson(expected)
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

/**
 * Чистая функция: ищет первое расхождение `actual` с «частичным эталоном»
 * `expected`. Проверяются ТОЛЬКО поля/индексы, присутствующие в `expected`
 * (глубоко-частичное сравнение); остальное в `actual` игнорируется.
 * Standard Schema на любом уровне валидирует значение, асимметричный
 * матчер — вызывает свой `asymmetricMatch`.
 * Возвращает `null`, если расхождений нет.
 */
export function matchPartial(args: {
  actual: unknown
  expected: unknown
  path?: string
}): Mismatch | null {
  const { actual, expected, path = '' } = args

  if (isStandardSchema(expected)) return matchSchema({ actual, schema: expected, path })
  if (isAsymmetricMatcher(expected)) {
    return expected.asymmetricMatch(actual) ? null : { path, expected, actual }
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return { path, expected, actual }
    for (let i = 0; i < expected.length; i++) {
      const m = matchPartial({
        actual: actual[i],
        expected: expected[i],
        path: joinPath({ path, key: i }),
      })
      if (m) return m
    }
    return null
  }

  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
      return { path, expected, actual }
    }
    const exp = expected as Record<string, unknown>
    const act = actual as Record<string, unknown>
    for (const key of Object.keys(exp)) {
      const m = matchPartial({
        actual: act[key],
        expected: exp[key],
        path: joinPath({ path, key }),
      })
      if (m) return m
    }
    return null
  }

  return Object.is(actual, expected) ? null : { path, expected, actual }
}

/**
 * Чистая проверка ответа: статус сверяется строго, тело — опционально и
 * глубоко-частично. Кидает {@link EberlyAssertionError} при расхождении.
 */
export function assertResponse(args: {
  actualStatus: number
  actualBody: unknown
  expectedStatus: number
  expectedBody?: unknown
  /** `"POST /posts"` — префикс сообщения, чтобы было видно, какой запрос упал. */
  endpoint?: string
}): void {
  const { actualStatus, actualBody, expectedStatus, expectedBody, endpoint } = args
  const prefix = endpoint ? `${endpoint}: ` : ''

  if (actualStatus !== expectedStatus) {
    throw new EberlyAssertionError(
      `${prefix}Expected status ${expectedStatus}, got ${actualStatus}.\n` +
        `Response body: ${safeJson(actualBody)}`,
    )
  }

  if (expectedBody === undefined) return

  const mismatch = matchPartial({ actual: actualBody, expected: expectedBody })
  if (mismatch) {
    throw new EberlyAssertionError(
      `${prefix}Response body mismatch at "${mismatch.path || '<root>'}": ` +
        `expected ${describeExpected(mismatch.expected)}` +
        `${mismatch.message ? ` (${mismatch.message})` : ''}, ` +
        `got ${safeJson(mismatch.actual)}.\n` +
        `Full body: ${safeJson(actualBody)}`,
    )
  }
}

/**
 * 4xx/5xx-статус, которого НЕТ в карте `M`. Задекларированные статусы
 * исключены намеренно: они идут через первую перегрузку `assert` с
 * типизированным телом — иначе `assert(409, { wrong: 1 })` молча прошёл бы
 * здесь с телом `unknown`. 1xx–3xx → `never` (опечатка 200 вместо 201).
 */
export type UndeclaredErrorStatus<S extends number, M> = S extends keyof M
  ? never
  : `${S}` extends `4${string}` | `5${string}`
    ? S
    : never

/** Задекларированные 2xx-статусы карты `M` (тело — то, что отдаёт `data`). */
export type SuccessStatus<M> = {
  [K in keyof M]: `${K & number}` extends `2${string}` ? K : never
}[keyof M]

/**
 * Ответ эндпоинта в режиме `'test'`. Дженерик `M` — карта «статус → тело»,
 * собранная генератором по swagger.
 *
 * - `status` / `body` — фактические значения ответа (не-2xx тоже доступен);
 * - `data` — тело успешного ответа, на не-2xx бросает (как `get` у стора);
 * - `assert(status, body?)` — проверка; статус подсказывается интеллисенсом.
 */
export class ApiResponse<M extends Record<number, unknown>> {
  /** Фактический HTTP-статус ответа. */
  readonly status: number
  /** Распарсенное тело ответа любого статуса. */
  readonly body: M[keyof M]
  /** Метод и путь из swagger (`"POST /posts"`) для сообщений об ошибках. */
  readonly endpoint?: string

  constructor(args: { status: number; body: M[keyof M]; endpoint?: string }) {
    this.status = args.status
    this.body = args.body
    this.endpoint = args.endpoint
  }

  /**
   * Тело успешного (2xx) ответа. На любой другой статус бросает
   * {@link EberlyAssertionError} со статусом и телом — стек указывает на
   * строку теста. Для подготовки данных: `(await alice.posts.create(…)).data.id`.
   * Если статус и есть предмет теста, пишите `assert(201)`: `data` примет
   * любой 2xx, а не именно 201.
   */
  get data(): M[SuccessStatus<M>] {
    if (this.status >= 200 && this.status < 300) return this.body as M[SuccessStatus<M>]
    const prefix = this.endpoint ? `${this.endpoint}: ` : ''
    const error = new EberlyAssertionError(
      `${prefix}Expected a 2xx response, got ${this.status}.\n` +
        `Response body: ${safeJson(this.body)}`,
    )
    throw trimStack({ error, fn: dataGetter })
  }

  /**
   * Проверяет статус и (опционально) часть тела ответа.
   *
   * @param status Ожидаемый статус. Задекларированные в swagger статусы
   *   подсказываются интеллисенсом, их тело типизировано. Любой другой
   *   4xx/5xx (`401`, `403`, `500`) можно передать без каста — тело тогда
   *   не типизировано. Незадекларированный 1xx–3xx — ошибка типов.
   * @param expectedBody Необязательная часть тела: проверяются только
   *   переданные поля (глубоко-частично), остальные игнорируются. Вместо
   *   любого значения — Standard Schema (`z.email()`, `v.uuid()`…) или
   *   матчер vitest (`expect.any(Number)`); схемой можно и всё тело.
   * @returns тот же объект ответа. После задекларированного статуса `.body`
   *   сужен до его тела: `res.assert(201).body.id` без каста.
   */
  assert<S extends keyof M>(
    status: S,
    expectedBody?: Expected<M[S]>,
  ): this & { readonly body: M[S] }
  assert<S extends number>(status: S & UndeclaredErrorStatus<S, M>, expectedBody?: unknown): this
  assert(status: number, expectedBody?: unknown): this {
    try {
      assertResponse({
        actualStatus: this.status,
        actualBody: this.body,
        expectedStatus: status,
        expectedBody,
        endpoint: this.endpoint,
      })
    } catch (error) {
      throw error instanceof Error ? trimStack({ error, fn: this.assert }) : error
    }
    return this
  }
}

/** Геттер `data` как функция — точка обрезки стека в `trimStack`. */
const dataGetter = Object.getOwnPropertyDescriptor(ApiResponse.prototype, 'data')?.get ?? (() => {})
