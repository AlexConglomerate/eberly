// Слой «модель операций → исходный текст клиента».
//
// Здесь рождается содержимое будущего сгенерированного файла (world):
// именованные типы схем (`export type PostDto = …`), класс `World` с
// методом `createUser()`, сгруппированными типизированными вызовами и
// общей функцией `request`. Это единственное место, где задаётся форма
// публичного API клиента.
//
// Типы вызовов описаны ОДИН раз — в `WorldApi`. Реализация
// (`buildApiTree(): WorldApi`) типизируется контекстно и литералы типов
// не повторяет; JSDoc тоже живёт только в `WorldApi`.
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
// дженериком в свой store (`BaseStore<Vars, WorldApi>`) и из методов
// дёргает `this.api.<группа>.<метод>()`. Значение `this.api` подставляет
// `World`: для user-store — клиент этого юзера, для world-store —
// анонимный клиент. См. ARCHITECTURE.md §8.

import type { ClientMode } from '../config'
import type { SchemaNames } from './names'
import type { Operation } from './operations'
import { renderSchemaDecls } from './schema'
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

/**
 * Рендерит реализацию одного метода группы (внутри `buildApiTree`). Типы
 * параметра и результата приходят контекстно из `WorldApi`, поэтому здесь
 * их нет: `input as RequestInput` и `as never` на выходе.
 */
function renderMethod(args: { op: Operation; mode: ClientMode }): string {
  const { op, mode } = args
  const call = `request({
            method: ${JSON.stringify(op.method.toUpperCase())},
            path: ${JSON.stringify(op.path)},
            opKey: ${JSON.stringify(hookKey(op))},
            input: input as RequestInput,
          })`

  if (mode === 'frontend') {
    return `        ${JSON.stringify(op.name)}: (input) =>
          ${call} as never,`
  }

  return `        ${JSON.stringify(op.name)}: async (input) =>
          new ApiResponse(await ${call}) as never,`
}

/** Импорты сгенерированного файла. В 'test' дополнительно нужен ApiResponse. */
function renderImports(args: { mode: ClientMode; userStoreImport: string; configImport: string }): string {
  const { mode, userStoreImport, configImport } = args
  const core =
    mode === 'frontend'
      ? 'BaseStore, HookRegistry'
      : 'BaseStore, ApiResponse, HookRegistry'
  return `import { ${core}, toMultipartFormData } from ${JSON.stringify(userStoreImport)}
import type { BeforeHook, AfterHook, RetryHook } from ${JSON.stringify(userStoreImport)}
import type { FileInput, FileEncoding, FileFieldMeta } from ${JSON.stringify(userStoreImport)}
import { ebely } from ${JSON.stringify(configImport)}`
}

/**
 * Статическая карта файловых операций `opKey → файловые поля тела`. Общий
 * `request` берёт из неё `fileFields`, чтобы собрать FormData нужной
 * кодировкой. Пустой объект, если в схеме нет multipart-эндпоинтов.
 */
function renderFileOps(operations: Operation[]): string {
  const entries = operations
    .filter((op) => op.isMultipart && op.fileFields.length > 0)
    .map((op) => {
      const fields = op.fileFields
        .map((f) => `{ name: ${JSON.stringify(f.name)}, array: ${f.array} }`)
        .join(', ')
      return `  ${JSON.stringify(hookKey(op))}: [${fields}],`
    })
  if (entries.length === 0) return 'const FILE_OPS: Record<string, FileFieldMeta[]> = {}'
  return `const FILE_OPS: Record<string, FileFieldMeta[]> = {\n${entries.join('\n')}\n}`
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
 * store: `class UserStore extends BaseStore<Vars, WorldApi>`.
 */
function renderApiType(args: { groups: Map<string, Operation[]>; mode: ClientMode }): string {
  const { groups, mode } = args
  const blocks = [...groups.entries()].map(([group, ops]) => {
    const leaves = ops.map((op) => {
      const { type, optional } = buildInputType(op)
      const inputParam = `input${optional ? '?' : ''}: ${type}`
      const doc = op.summary ? `      /** ${op.summary} */\n` : ''
      return `${doc}      ${JSON.stringify(op.name)}: (${inputParam}) => ${methodReturnType({ op, mode })}`
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
  // Глобальные хуки на ВСЕ операции: `Body`/`ResBody` неизвестны заранее,
  // поэтому без уточнения (по умолчанию `unknown`). `globalRetry` решает,
  // переиграть ли запрос (вернуть `true` → ebely шлёт его заново).
  const global = `    globalBefore(fn: BeforeHook<Store>): void
    globalAfter(fn: AfterHook<Store>): void
    globalRetry(fn: RetryHook<Store>): void`
  return `type EbelyHookTree<Store extends BaseStore> = {\n${global}\n${blocks.join('\n')}\n}`
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
      globalBefore: (fn: BeforeHook<Store>) => r.globalBefore({ fn }),
      globalAfter: (fn: AfterHook<Store>) => r.globalAfter({ fn }),
      globalRetry: (fn: RetryHook<Store>) => r.globalRetry({ fn }),
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
  private buildApiTree(request: RequestFn): WorldApi {
    return {
${groupBlocks.join('\n')}
    }
  }`
}

/** Рендерит финальный исходник клиента (world). */
export function renderClient(args: {
  spec: Json
  names: SchemaNames
  operations: Operation[]
  mode: ClientMode
  userStoreImport: string
  configImport: string
}): string {
  const { spec, names, operations, mode, userStoreImport, configImport } = args
  const basePath: string = spec.servers?.[0]?.url ?? ''

  const groups = groupOperations(operations)
  const decls = renderSchemaDecls({ spec, names })
  const tail = renderRequestTail(mode)
  // Хвост `request` (return/throw) теперь живёт ВНУТРИ retry-цикла, на один
  // уровень глубже — добавим 2 пробела к каждой непустой строке, чтобы
  // сгенерированный файл оставался ровным.
  const tailRet = tail.ret
    .split('\n')
    .map((l) => (l.trim() ? `  ${l}` : l))
    .join('\n')

  return `// AUTO-GENERATED by ebely (generateClient) — НЕ редактировать вручную.
// Источник: ${spec.info?.title ?? 'OpenAPI spec'} v${spec.info?.version ?? '?'}
// Режим клиента: ${mode}
// Перегенерация: pnpm run client:generate

${renderImports({ mode, userStoreImport, configImport })}

${decls ? `${decls}\n\n` : ''}${renderFileOps(operations)}

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
 *   import type { UserStore } from './userStore'
 *   export const hooks: Hooks<UserStore> = (h) => {
 *     h.posts.create.after(({ response, ctx }) => { … })
 *   }
 *
 * (Параметр НЕ выводится из \`ebely.userStore\` намеренно: это создало
 * бы цикл типов \`ebely\` ⇄ \`Hooks\`, т.к. \`hooks\` лежит внутри \`ebely\`.)
 */
export type Hooks<Store extends BaseStore = BaseStore> = (
  h: EbelyHookTree<Store>,
) => void

/**
 * База \`World\` — это сконфигурированный \`ebely.worldStore\` (или пустой
 * \`BaseStore\`, если не задан). Поэтому \`world.<сценарий>()\` и
 * \`world.get/set\` доступны и типизированы ровно как у пользователя,
 * только область — весь мир. Тип берётся из \`ebely\` тем же приёмом, что
 * и \`Store\` (никаких рантайм-условий — см. ARCHITECTURE.md §8).
 */
type ConfiguredWorldStore =
  typeof ebely extends { worldStore: new () => infer I extends BaseStore }
    ? I
    : BaseStore
const WorldStoreBase = ((ebely as { worldStore?: new () => BaseStore })
  .worldStore ?? BaseStore) as new () => ConfiguredWorldStore

export class World<
  Store extends BaseStore = InstanceType<typeof ebely.userStore>,
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
      /** Класс-хранилище. Если не задан — берётся ebely.userStore. */
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
    store: BaseStore
  }): RequestFn {
    const baseUrl = this.baseUrl()
    const registry = this.hookRegistry
    const { headers: baseHeaders, store } = cfg
    // Потолок ПОВТОРОВ (сверх первой попытки) для globalRetry-хуков —
    // защита от бесконечного цикла, если хук упрямо просит повтор.
    const maxRetries = (ebely as { maxRetries?: number }).maxRetries ?? 3

    return async (req): Promise<${tail.returnType}> => {
      const { method, path, opKey, input } = req

      // Retry-цикл: каждую попытку hookReq собирается ЗАНОВО и заново
      // прогоняются before-хуки, поэтому правки из retry-хука (напр.
      // свежий токен в ctx) подхватываются повторным before. \`for (;;)\`
      // крутится, пока не сработает return/throw в хвосте или \`continue\`.
      let attempt = 0
      for (;;) {
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
        // Файловые (multipart) операции: FormData собирается ПОСЛЕ before-хуков
        // (тело к этому моменту — обычный объект, хуки видят/правят его как
        // JSON). Кодировка имён полей для массива файлов — из ebely.files
        // (дефолт 'repeat': веб-стандарт busboy/Go/Rust; oRPC ставит
        // 'bracket-index'). На retry FormData пересобирается заново.
        const fileFields = FILE_OPS[opKey]
        const form =
          fileFields && fileFields.length > 0 && hasBody
            ? await toMultipartFormData({
                body: hookReq.body as Record<string, unknown>,
                fileFields,
                encoding:
                  (ebely as { files?: { encoding?: FileEncoding } }).files?.encoding ?? 'repeat',
              })
            : undefined
        const isMultipart = form !== undefined

        const response = await fetch(url, {
          method,
          headers: {
            // multipart: content-type НЕ ставим — fetch сам выставит boundary.
            ...(isMultipart ? {} : hasBody ? { 'content-type': 'application/json' } : {}),
            ...hookReq.headers,
          },
          body: isMultipart ? form : hasBody ? JSON.stringify(hookReq.body) : undefined,
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

        // Пока есть бюджет повторов — спрашиваем retry-хуки. Вернули
        // true → новый виток (заново before → fetch); иначе отдаём ответ.
        if (attempt < maxRetries) {
          const shouldRetry = await registry.runRetry({
            key: opKey,
            request: hookReq,
            response: { status: response.status, body: data },
            ctx: store,
          })
          if (shouldRetry) {
            attempt++
            continue
          }
        }

${tailRet}
      }
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
      this.args.store ?? (ebely.userStore as unknown as new () => Store)
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
