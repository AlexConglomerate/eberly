// Слой «модель операций → исходный текст клиента».
//
// Здесь рождается содержимое будущего сгенерированного файла (world):
// класс `World` с методом `createUser()`, сгруппированными по
// operationId типизированными вызовами и общей функцией `request`.
// Это единственное место, где задаётся форма публичного API клиента.
//
// Форма зависит от режима (см. ClientMode):
//   - 'test'     → методы возвращают ApiResponse<{ статус: тело }> с .assert();
//                  request НЕ бросает на не-2xx — проверка через res.assert().
//   - 'frontend' → методы возвращают тело напрямую; request бросает на не-2xx.
//
// Хуки (before/after) одинаковы в обоих режимах: генератор эмитит
// типизированное дерево `EbelyHookTree` + экспортируемый тип `Hooks`
// (пользователь объявляет хуки в отдельном файле и кладёт одной
// переменной в конфиг), а общий `request` прогоняет `registry.runBefore`
// до fetch и `registry.runAfter` после разбора ответа. `ctx` внутри хука
// — store КОНКРЕТНОГО пользователя (изоляция между юзерами бесплатна).
//
// Сценарии (actions): генератор эмитит ТИП `WorldApi` — дерево
// типизированных вызовов эндпоинтов. Пользователь подставляет его вторым
// дженериком в свой store (`InternalStore<Vars, WorldApi>`) и из методов
// дёргает `this.api.<группа>.<метод>()`. Значение `this.api` подставляет
// `World`: для user-store — клиент этого юзера, для world-store —
// анонимный клиент. См. ARCHITECTURE.md §8.

import type { ClientMode } from '../config'
import type { Operation } from './operations'
import type { Json } from './types'

/** Описывает тип единственного аргумента-объекта метода (паттерн options object). */
function buildInputType(op: Operation): { type: string; optional: boolean } {
  const parts: string[] = []

  if (op.pathParams.length > 0) {
    const fields = op.pathParams.map((p) => `${JSON.stringify(p)}: string`).join('; ')
    parts.push(`path: { ${fields} }`)
  }
  if (op.queryParams.length > 0) {
    const fields = op.queryParams.map((p) => `${JSON.stringify(p)}?: string | number | boolean`).join('; ')
    parts.push(`query?: { ${fields} }`)
  }
  if (op.bodyType) {
    parts.push(`body${op.bodyRequired ? '' : '?'}: ${op.bodyType}`)
  }

  if (parts.length === 0) return { type: '{}', optional: true }

  const optional = op.pathParams.length === 0 && (!op.bodyType || !op.bodyRequired)
  return { type: `{ ${parts.join('; ')} }`, optional }
}

/** Тип-карта «статус → тело» для режима `'test'`: `{ 200: {...}; 404: {...} }`. */
function buildStatusMapType(op: Operation): string {
  const entries = op.responses.map((r) => `${r.status}: ${r.bodyType}`)
  return `{ ${entries.join('; ')} }`
}

/** Тип возвращаемого значения вызова эндпоинта под выбранный режим. */
function methodReturnType(args: { op: Operation; mode: ClientMode }): string {
  const { op, mode } = args
  if (mode === 'frontend') return `Promise<${op.responseType}>`
  return `Promise<ApiResponse<${buildStatusMapType(op)}>>`
}

/** Ключ операции для реестра хуков: `"<группа>.<метод>"` (как operationId). */
function hookKey(op: Operation): string {
  return `${op.group}.${op.name}`
}

/** Тип тела запроса для хука (`undefined`, если у операции нет body). */
function hookBodyType(op: Operation): string {
  return op.bodyType ?? 'undefined'
}

/** Рендерит реализацию одного метода группы (внутри `buildApiTree`). */
function renderMethod(args: { op: Operation; mode: ClientMode }): string {
  const { op, mode } = args
  const { type, optional } = buildInputType(op)
  const inputParam = `input${optional ? '?' : ''}: ${type}`
  const doc = op.summary ? `\n        /** ${op.summary} */` : ''
  const call = `request({
            method: ${JSON.stringify(op.method.toUpperCase())},
            path: ${JSON.stringify(op.path)},
            opKey: ${JSON.stringify(hookKey(op))},
            input: input as RequestInput,
          })`

  if (mode === 'frontend') {
    return `${doc}
        ${JSON.stringify(op.name)}: (${inputParam}): Promise<${op.responseType}> =>
          ${call} as Promise<${op.responseType}>,`
  }

  const map = buildStatusMapType(op)
  return `${doc}
        ${JSON.stringify(op.name)}: async (${inputParam}): Promise<ApiResponse<${map}>> => {
          const res = await ${call}
          return new ApiResponse(res) as unknown as ApiResponse<${map}>
        },`
}

/** Импорты сгенерированного файла. В 'test' дополнительно нужен ApiResponse. */
function renderImports(args: { mode: ClientMode; internalStoreImport: string; configImport: string }): string {
  const { mode, internalStoreImport, configImport } = args
  const values =
    mode === 'frontend'
      ? 'InternalStore, HookRegistry'
      : 'InternalStore, ApiResponse, HookRegistry'
  return `import { ${values} } from ${JSON.stringify(internalStoreImport)}
import type { BeforeHook, AfterHook } from ${JSON.stringify(internalStoreImport)}
import { ebely } from ${JSON.stringify(configImport)}`
}

/**
 * Финальные строки `request` после разбора ответа и `registry.runAfter`:
 * - 'frontend' — бросает на не-2xx, иначе возвращает тело;
 * - 'test'     — НЕ бросает, возвращает `{ status, body }` для `res.assert()`.
 */
function renderRequestTail(mode: ClientMode): { returnType: string; ret: string } {
  if (mode === 'frontend') {
    return {
      returnType: 'unknown',
      ret: `      if (!response.ok) {
        throw new Error(
          \`Request \${method} \${resolvedPath} failed with \${response.status}: \${text}\`,
        )
      }

      return data`,
    }
  }

  return {
    returnType: '{ status: number; body: unknown }',
    ret: `      return { status: response.status, body: data }`,
  }
}

/** Группирует операции по `op.group`, сохраняя порядок появления. */
function groupOperations(operations: Operation[]): Map<string, Operation[]> {
  const groups = new Map<string, Operation[]>()
  for (const op of operations) {
    const list = groups.get(op.group) ?? []
    list.push(op)
    groups.set(op.group, list)
  }
  return groups
}

/**
 * Тип дерева типизированных вызовов эндпоинтов (`this.api` в методах-
 * сценариях). Пользователь подставляет его вторым дженериком в свой
 * store: `class AppStore extends InternalStore<Vars, WorldApi>`.
 */
function renderApiType(args: { groups: Map<string, Operation[]>; mode: ClientMode }): string {
  const { groups, mode } = args
  const blocks = [...groups.entries()].map(([group, ops]) => {
    const leaves = ops.map((op) => {
      const { type, optional } = buildInputType(op)
      const inputParam = `input${optional ? '?' : ''}: ${type}`
      return `      ${JSON.stringify(op.name)}: (${inputParam}) => ${methodReturnType({ op, mode })}`
    })
    return `    ${JSON.stringify(group)}: {\n${leaves.join('\n')}\n    }`
  })
  return `export type WorldApi = {\n${blocks.join('\n')}\n}`
}

/** Тип типизированного дерева хуков `h.<группа>.<метод>.before/after`. */
function renderHookTreeType(groups: Map<string, Operation[]>): string {
  const blocks = [...groups.entries()].map(([group, ops]) => {
    const leaves = ops.map((op) => {
      const body = hookBodyType(op)
      return `      ${JSON.stringify(op.name)}: {
        before(fn: BeforeHook<Store, ${body}>): void
        after(fn: AfterHook<Store, ${body}, ${op.responseType}>): void
      }`
    })
    return `    ${JSON.stringify(group)}: {\n${leaves.join('\n')}\n    }`
  })
  return `type EbelyHookTree<Store extends InternalStore> = {\n${blocks.join('\n')}\n}`
}

/** Рантайм-строитель дерева хуков: связывает имена с общим HookRegistry. */
function renderHookTreeBuilder(groups: Map<string, Operation[]>): string {
  const blocks = [...groups.entries()].map(([group, ops]) => {
    const leaves = ops.map((op) => {
      const key = JSON.stringify(hookKey(op))
      return `        ${JSON.stringify(op.name)}: {
          before: (fn: BeforeHook<Store>) => r.before({ key: ${key}, fn }),
          after: (fn: AfterHook<Store>) => r.after({ key: ${key}, fn }),
        },`
    })
    return `      ${JSON.stringify(group)}: {\n${leaves.join('\n')}\n      },`
  })
  return `  private buildHookTree(): EbelyHookTree<Store> {
    const r = this.hookRegistry
    return {
${blocks.join('\n')}
    } as unknown as EbelyHookTree<Store>
  }`
}

/** Рантайм-строитель дерева вызовов эндпоинтов (общий для user/world). */
function renderApiTreeBuilder(args: { groups: Map<string, Operation[]>; mode: ClientMode }): string {
  const { groups, mode } = args
  const groupBlocks = [...groups.entries()].map(([group, ops]) => {
    const methods = ops.map((op) => renderMethod({ op, mode }))
    return `      ${JSON.stringify(group)}: {\n${methods.join('\n')}\n      },`
  })
  return `  /** Дерево типизированных вызовов эндпоинтов поверх одного \`request\`. */
  private buildApiTree(request: RequestFn) {
    return {
${groupBlocks.join('\n')}
    }
  }`
}

/** Рендерит финальный исходник клиента (world). */
export function renderClient(args: {
  spec: Json
  operations: Operation[]
  mode: ClientMode
  internalStoreImport: string
  configImport: string
}): string {
  const { spec, operations, mode, internalStoreImport, configImport } = args
  const basePath: string = spec.servers?.[0]?.url ?? ''

  const groups = groupOperations(operations)
  const tail = renderRequestTail(mode)

  return `// AUTO-GENERATED by ebely (generateClient) — НЕ редактировать вручную.
// Источник: ${spec.info?.title ?? 'OpenAPI spec'} v${spec.info?.version ?? '?'}
// Режим клиента: ${mode}
// Перегенерация: pnpm run client:generate

${renderImports({ mode, internalStoreImport, configImport })}

type RequestInput = {
  path?: Record<string, string>
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

type RequestFn = (req: {
  method: string
  path: string
  opKey: string
  input?: RequestInput
}) => Promise<${tail.returnType}>

export type CreateUserArgs = {
  /** Заголовки, которые будут добавляться ко всем запросам этого пользователя. */
  headers?: Record<string, string>
}

${renderApiType({ groups, mode })}

${renderHookTreeType(groups)}

/**
 * Тип регистратора хуков для ЭТОГО бэкенда. Объявите хуки в отдельном
 * файле и положите одной переменной в конфиг (\`EbelyConfig.hooks\`).
 * Передайте СВОЙ класс store параметром, чтобы \`ctx\` был типизирован:
 *
 *   import type { AppStore } from './internalVariable'
 *   export const hooks: Hooks<AppStore> = (h) => {
 *     h.posts.create.after(({ response, ctx }) => { … })
 *   }
 *
 * (Параметр НЕ выводится из \`ebely.internalStore\` намеренно: это создало
 * бы цикл типов \`ebely\` ⇄ \`Hooks\`, т.к. \`hooks\` лежит внутри \`ebely\`.)
 */
export type Hooks<Store extends InternalStore = InternalStore> = (
  h: EbelyHookTree<Store>,
) => void

/**
 * База \`World\` — это сконфигурированный \`ebely.worldStore\` (или пустой
 * \`InternalStore\`, если не задан). Поэтому \`world.<сценарий>()\` и
 * \`world.get/set\` доступны и типизированы ровно как у пользователя,
 * только область — весь мир. Тип берётся из \`ebely\` тем же приёмом, что
 * и \`Store\` (никаких рантайм-условий — см. ARCHITECTURE.md §8).
 */
type ConfiguredWorldStore =
  typeof ebely extends { worldStore: new () => infer I extends InternalStore }
    ? I
    : InternalStore
const WorldStoreBase = ((ebely as { worldStore?: new () => InternalStore })
  .worldStore ?? InternalStore) as new () => ConfiguredWorldStore

export class World<
  Store extends InternalStore = InstanceType<typeof ebely.internalStore>,
> extends WorldStoreBase {
  /**
   * Общий реестр хуков. Регистрация — статическая (один раз из конфига),
   * но \`ctx\` подставляется в момент запроса = store конкретного юзера.
   */
  private hookRegistry = new HookRegistry()

  constructor(
    public args: {
      /** URL бэкенда. Если не задан — берётся ebely.url из конфига. */
      url?: string
      /** Класс-хранилище. Если не задан — берётся ebely.internalStore. */
      store?: new () => Store
    } = {},
  ) {
    super()
    const registrar = (ebely as { hooks?: (h: unknown) => void }).hooks
    if (registrar) registrar(this.buildHookTree())
    // world-store ходит АНОНИМНЫМ клиентом (без per-user заголовков);
    // ctx хуков для таких вызовов = сам world.
    ;(this as unknown as { api: unknown }).api = this.buildApiTree(
      this.makeRequest({ headers: {}, store: this }),
    )
  }

  /** Базовый URL с учётом server.url из схемы. */
  private baseUrl(): string {
    return (this.args.url ?? ebely.url).replace(/\\/$/, '') + ${JSON.stringify(basePath)}
  }

${renderHookTreeBuilder(groups)}

  /**
   * Создаёт \`request\`, замкнутый на заголовки и \`store\` (он же \`ctx\`
   * хуков). Один и тот же движок и для пользователя, и для world.
   */
  private makeRequest(cfg: {
    headers: Record<string, string>
    store: InternalStore
  }): RequestFn {
    const baseUrl = this.baseUrl()
    const registry = this.hookRegistry
    const { headers: baseHeaders, store } = cfg

    return async (req): Promise<${tail.returnType}> => {
      const { method, path, opKey, input } = req

      const hookReq = {
        method,
        path,
        pathParams: { ...(input?.path ?? {}) },
        query: { ...(input?.query ?? {}) },
        body: input?.body,
        headers: { ...baseHeaders },
      }
      await registry.runBefore({ key: opKey, request: hookReq, ctx: store })

      let resolvedPath = path
      for (const [k, v] of Object.entries(hookReq.pathParams)) {
        resolvedPath = resolvedPath.replace(
          \`{\${k}}\`,
          encodeURIComponent(String(v)),
        )
      }

      const url = new URL(baseUrl + resolvedPath)
      for (const [k, v] of Object.entries(hookReq.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v))
      }

      const hasBody = hookReq.body !== undefined
      const response = await fetch(url, {
        method,
        headers: {
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
          ...hookReq.headers,
        },
        body: hasBody ? JSON.stringify(hookReq.body) : undefined,
      })

      const text = await response.text()
      let data: unknown
      try {
        data = text ? JSON.parse(text) : undefined
      } catch {
        data = text
      }

      await registry.runAfter({
        key: opKey,
        request: hookReq,
        response: { status: response.status, body: data },
        ctx: store,
      })

${tail.ret}
    }
  }

${renderApiTreeBuilder({ groups, mode })}

  /**
   * Создаёт «пользователя» — изолированный набор типизированных вызовов
   * эндпоинтов, который под капотом ходит fetch-запросами. \`store.api\`
   * указывает на то же дерево, поэтому методы-сценарии этого store
   * (\`fullRegister\` и т.п.) ходят от лица именно этого пользователя.
   */
  createUser(userArgs: CreateUserArgs = {}) {
    const StoreClass =
      this.args.store ?? (ebely.internalStore as unknown as new () => Store)
    const store = new StoreClass()
    const tree = this.buildApiTree(
      this.makeRequest({ headers: { ...userArgs.headers }, store }),
    )
    ;(store as unknown as { api: unknown }).api = tree
    return Object.assign(store, tree)
  }
}
`
}
