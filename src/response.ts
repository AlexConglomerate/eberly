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
      `Ожидался статус ${expectedStatus}, получен ${actualStatus}.\n` +
        `Тело ответа: ${safeJson(actualBody)}`,
    )
  }

  if (expectedBody === undefined) return

  const mismatch = matchPartial({ actual: actualBody, expected: expectedBody })
  if (mismatch) {
    throw new EbelyAssertionError(
      `Тело ответа не совпало по пути "${mismatch.path || '<root>'}": ` +
        `ожидалось ${safeJson(mismatch.expected)}, ` +
        `получено ${safeJson(mismatch.actual)}.\n` +
        `Полное тело: ${safeJson(actualBody)}`,
    )
  }
}

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
   * @param status Ожидаемый статус. Подсказывается интеллисенсом из
   *   swagger; незадекларированный литерал — ошибка типов. Чтобы
   *   проверить статус, которого нет в схеме (например `400`),
   *   используйте `res.assert(400 as any, ...)`.
   * @param expectedBody Необязательная часть тела: проверяются только
   *   переданные поля (глубоко-частично), остальные игнорируются.
   * @returns тот же объект ответа — удобно читать `.body` после проверки.
   */
  assert<S extends keyof M>(status: S, expectedBody?: DeepPartial<M[S]>): this {
    assertResponse({
      actualStatus: this.status,
      actualBody: this.body,
      expectedStatus: status as unknown as number,
      expectedBody,
    })
    return this
  }
}
