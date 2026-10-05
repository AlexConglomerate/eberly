// Рантайм-обёртка ответа эндпоинта (НЕ генерируется). Попадает в npm-пакет
// как есть и импортируется сгенерированным клиентом — по аналогии с
// BaseStore. Используется только в режиме клиента 'test'.
//
// Вся логика проверки вынесена в ЧИСТЫЕ функции (assertResponse /
// matchPartial) без сети и fetch — их легко юнит-тестировать в изоляции.

/** Глубоко-частичный тип: на каждом уровне все поля необязательны. */
export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

/** Ошибка проваленной проверки `res.assert(...)`. */
export class EbelyAssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EbelyAssertionError'
  }
}

/** Описание первого найденного расхождения тела ответа с эталоном. */
export type Mismatch = { path: string; expected: unknown; actual: unknown }

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
 * Возвращает `null`, если расхождений нет.
 */
export function matchPartial(args: {
  actual: unknown
  expected: unknown
  path?: string
}): Mismatch | null {
  const { actual, expected, path = '' } = args

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return { path, expected, actual }
    for (let i = 0; i < expected.length; i++) {
      const m = matchPartial({
        actual: actual[i],
        expected: expected[i],
        path: `${path}[${i}]`,
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
        path: path ? `${path}.${key}` : key,
      })
      if (m) return m
    }
    return null
  }

  return Object.is(actual, expected) ? null : { path, expected, actual }
}

/**
 * Чистая проверка ответа: статус сверяется строго, тело — опционально и
 * глубоко-частично. Кидает {@link EbelyAssertionError} при расхождении.
 */
export function assertResponse(args: {
  actualStatus: number
  actualBody: unknown
  expectedStatus: number
  expectedBody?: unknown
}): void {
  const { actualStatus, actualBody, expectedStatus, expectedBody } = args

  if (actualStatus !== expectedStatus) {
    throw new EbelyAssertionError(
      `Expected status ${expectedStatus}, got ${actualStatus}.\n` +
        `Response body: ${safeJson(actualBody)}`,
    )
  }

  if (expectedBody === undefined) return

  const mismatch = matchPartial({ actual: actualBody, expected: expectedBody })
  if (mismatch) {
    throw new EbelyAssertionError(
      `Response body mismatch at "${mismatch.path || '<root>'}": ` +
        `expected ${safeJson(mismatch.expected)}, ` +
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

/**
 * Ответ эндпоинта в режиме `'test'`. Дженерик `M` — карта «статус → тело»,
 * собранная генератором по swagger.
 *
 * - `status` / `body` — фактические значения ответа (не-2xx тоже доступен);
 * - `assert(status, body?)` — проверка; статус подсказывается интеллисенсом.
 */
export class ApiResponse<M extends Record<number, unknown>> {
  /** Фактический HTTP-статус ответа. */
  readonly status: number
  /** Распарсенное тело ответа. */
  readonly body: M[keyof M]

  constructor(args: { status: number; body: M[keyof M] }) {
    this.status = args.status
    this.body = args.body
  }

  /**
   * Проверяет статус и (опционально) часть тела ответа.
   *
   * @param status Ожидаемый статус. Задекларированные в swagger статусы
   *   подсказываются интеллисенсом, их тело типизировано. Любой другой
   *   4xx/5xx (`401`, `403`, `500`) можно передать без каста — тело тогда
   *   не типизировано. Незадекларированный 1xx–3xx — ошибка типов.
   * @param expectedBody Необязательная часть тела: проверяются только
   *   переданные поля (глубоко-частично), остальные игнорируются.
   * @returns тот же объект ответа — удобно читать `.body` после проверки.
   */
  assert<S extends keyof M>(status: S, expectedBody?: DeepPartial<M[S]>): this
  assert<S extends number>(status: S & UndeclaredErrorStatus<S, M>, expectedBody?: unknown): this
  assert(status: number, expectedBody?: unknown): this {
    assertResponse({
      actualStatus: this.status,
      actualBody: this.body,
      expectedStatus: status,
      expectedBody,
    })
    return this
  }
}
