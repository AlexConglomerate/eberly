// Рантайм-ядро (НЕ генерируется). Реестр хуков before/after + типы
// контекста. Попадает в npm-пакет и импортируется сгенерированным
// клиентом — по аналогии с BaseStore / ApiResponse. Здесь НЕТ сети и
// fetch: реестр и его «прогонщики» — чистые функции, их легко
// юнит-тестировать в изоляции (src/hooks.test.ts).

/**
 * Изменяемое описание исходящего запроса, доступное хукам. `before`-хук
 * МОЖЕТ его править (`headers` / `query` / `body` / `pathParams`) —
 * изменения уедут в реальный fetch. `path` — это ШАБЛОН из swagger
 * (`/posts/{id}`); подстановка `pathParams` происходит уже после хуков.
 */
export type HookRequest = {
  method: string
  path: string
  pathParams: Record<string, string | number | boolean>
  query: Record<string, string | number | boolean | undefined>
  body: unknown
  headers: Record<string, string>
}

/** Ответ эндпоинта в том виде, в каком его видит `after`-хук (read-only). */
export type HookResponse = { status: number; body: unknown }

/** Аргумент `before`-хука. `Body` уточняется генератором на каждую операцию. */
export type BeforeHookArgs<Ctx, Body = unknown> = {
  request: HookRequest & { body: Body }
  ctx: Ctx
}

/** Аргумент `after`-хука. `Body` / `ResBody` уточняются генератором. */
export type AfterHookArgs<Ctx, Body = unknown, ResBody = unknown> = {
  request: HookRequest & { body: Body }
  response: { status: number; body: ResBody }
  ctx: Ctx
}

/** `before`-хук: вызывается ДО запроса; может мутировать `request`. */
export type BeforeHook<Ctx, Body = unknown> = (
  args: BeforeHookArgs<Ctx, Body>,
) => void | Promise<void>

/** `after`-хук: вызывается ПОСЛЕ ответа; `response` — только на чтение. */
export type AfterHook<Ctx, Body = unknown, ResBody = unknown> = (
  args: AfterHookArgs<Ctx, Body, ResBody>,
) => void | Promise<void>

/**
 * `retry`-хук: вызывается ПОСЛЕ ответа (и после всех `after`-хуков) и
 * РЕШАЕТ, нужно ли переиграть тот же запрос. Возврат `true` → eberly
 * выполняет запрос заново (с нуля: снова прогоняет `before`-хуки и шлёт
 * fetch), поэтому правки, сделанные внутри хука (напр. свежий токен в
 * `ctx`), автоматически подхватятся повторным `before`. Любой
 * не-истинный возврат (`false` / `undefined`) → ретрая нет, отдаём ответ
 * как есть.
 *
 * Аргумент — тот же, что у `after` (`request` / `response` / `ctx`):
 * `response` тут на чтение (его смотрят, чтобы решить про ретрай), а
 * подготовку к повтору (refresh токена и т.п.) хук делает через `ctx`.
 *
 * Число повторов ограничено ядром (`EberlyConfig.maxRetries`, по
 * умолчанию 3) — даже если хук упрямо возвращает `true`, бесконечного
 * цикла не будет.
 */
export type RetryHook<Ctx, Body = unknown, ResBody = unknown> = (
  args: AfterHookArgs<Ctx, Body, ResBody>,
) => boolean | void | Promise<boolean | void>

/**
 * Регистратор хуков, который пользователь передаёт в конфиг одной
 * переменной (`EberlyConfig.hooks`). Точную типизированную форму аргумента
 * (`h.<группа>.<метод>.before/after`) задаёт СГЕНЕРИРОВАННЫЙ клиент —
 * он экспортирует конкретный тип `Hooks`. В библиотеке тип намеренно
 * широкий (`any`): здесь ещё не известны ни операции, ни класс store.
 */
export type HooksRegistrar = (registrar: any) => void

/**
 * Реестр хуков. Ключ — `"<группа>.<метод>"` (как `operationId`, напр.
 * `posts.create`). Несколько хуков на один ключ выполняются ПО ОЧЕРЕДИ в
 * порядке регистрации.
 *
 * Реестр ОБЩИЙ (живёт на экземпляре `World`), но `ctx` подставляется не
 * при регистрации, а в момент запроса — это store КОНКРЕТНОГО
 * пользователя, сделавшего вызов. Поэтому запись хуком во внутренние
 * переменные не «течёт» между пользователями: изоляция получается
 * бесплатно из того, что `ctx` приходит из инстанса в момент вызова.
 *
 * Реестр НЕ знает ни про сеть, ни про то, ЧЕЙ это store — это и есть
 * архитектурный шов: добавить позже второй уровень контекста (общий
 * account/session для «один юзер с двух устройств») можно аддитивно,
 * не меняя этот класс.
 */
export class HookRegistry {
  private beforeMap = new Map<string, BeforeHook<unknown>[]>()
  private afterMap = new Map<string, AfterHook<unknown>[]>()
  // Глобальные хуки — срабатывают на КАЖДУЮ операцию (вне зависимости от
  // ключа). Удобны для сквозных задач: подстановка `Authorization` из
  // `ctx` во все запросы, логирование, обработка 401 и т.п.
  private globalBeforeHooks: BeforeHook<unknown>[] = []
  private globalAfterHooks: AfterHook<unknown>[] = []
  // Глобальные retry-хуки — решают, переигрывать ли запрос (напр. на 401
  // сходить за refresh и вернуть `true`). Цикл повторов и его лимит живут
  // в сгенерированном `request` (см. render.ts) — сам реестр сети не знает.
  private globalRetryHooks: RetryHook<unknown>[] = []

  /** Зарегистрировать `before`-хук на ключ `"<группа>.<метод>"`. */
  before(args: { key: string; fn: BeforeHook<any> }): void {
    const list = this.beforeMap.get(args.key) ?? []
    list.push(args.fn)
    this.beforeMap.set(args.key, list)
  }

  /** Зарегистрировать `after`-хук на ключ `"<группа>.<метод>"`. */
  after(args: { key: string; fn: AfterHook<any> }): void {
    const list = this.afterMap.get(args.key) ?? []
    list.push(args.fn)
    this.afterMap.set(args.key, list)
  }

  /** Зарегистрировать ГЛОБАЛЬНЫЙ `before`-хук (на все операции). */
  globalBefore(args: { fn: BeforeHook<any> }): void {
    this.globalBeforeHooks.push(args.fn)
  }

  /** Зарегистрировать ГЛОБАЛЬНЫЙ `after`-хук (на все операции). */
  globalAfter(args: { fn: AfterHook<any> }): void {
    this.globalAfterHooks.push(args.fn)
  }

  /** Зарегистрировать ГЛОБАЛЬНЫЙ `retry`-хук (решает про повтор запроса). */
  globalRetry(args: { fn: RetryHook<any> }): void {
    this.globalRetryHooks.push(args.fn)
  }

  /**
   * Прогнать `before`-хуки по очереди (await на async): сначала глобальные,
   * затем поименные для ключа — так общая подготовка (напр. заголовок
   * авторизации) ложится раньше, а точечный хук может её переопределить.
   */
  async runBefore(args: {
    key: string
    request: HookRequest
    ctx: unknown
  }): Promise<void> {
    const hooks = [...this.globalBeforeHooks, ...(this.beforeMap.get(args.key) ?? [])]
    for (const fn of hooks) {
      await fn({ request: args.request, ctx: args.ctx })
    }
  }

  /**
   * Прогнать `after`-хуки по очереди (await на async): сначала поименные
   * для ключа, затем глобальные — так глобальный «оборачивает» точечные
   * (видит итоговый эффект, удобно для логирования/обработки статуса).
   */
  async runAfter(args: {
    key: string
    request: HookRequest
    response: HookResponse
    ctx: unknown
  }): Promise<void> {
    const hooks = [...(this.afterMap.get(args.key) ?? []), ...this.globalAfterHooks]
    for (const fn of hooks) {
      await fn({ request: args.request, response: args.response, ctx: args.ctx })
    }
  }

  /**
   * Спросить retry-хуки, нужно ли переиграть запрос. Прогон по очереди
   * регистрации; ПЕРВЫЙ хук, вернувший истину, выигрывает (он уже сделал
   * подготовку — напр. refresh — поэтому остальные не дёргаем). Если ни
   * один не вернул истину — `false` (повтора нет). Цикл и лимит повторов
   * — на стороне вызывающего (сгенерированный `request`).
   */
  async runRetry(args: {
    key: string
    request: HookRequest
    response: HookResponse
    ctx: unknown
  }): Promise<boolean> {
    for (const fn of this.globalRetryHooks) {
      const decision = await fn({
        request: args.request,
        response: args.response,
        ctx: args.ctx,
      })
      if (decision) return true
    }
    return false
  }
}
