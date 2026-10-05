// Слой «swagger.paths → плоский список операций».
//
// Берёт сырой документ схемы и превращает его в массив `Operation` —
// удобную промежуточную модель, по которой потом рендерится клиент.
//
// Группа — первый тег операции (`User Management` → `userManagement`).
// Фолбэки по порядку: префикс operationId до точки (`posts.create` →
// `posts`) → первый статический сегмент пути (`/posts/{id}` → `posts`) →
// `default`. Имя метода — operationId после первой точки, иначе
// operationId целиком, иначе `${method}${path}`. См. names.ts.
//
// Коллизии имён. Один и тот же operationId может прийти на разные HTTP-
// методы одного пути (классика — better-auth: GET и POST `/get-session`
// с общим operationId `getSession`). Без разведения это даёт два
// одноимённых свойства в объекте → TS2300 Duplicate identifier. Поэтому
// после сбора имена внутри каждой группы дедуплицируются: если имя
// встречается больше одного раза, к нему спереди добавляется HTTP-метод
// (`getSession` → `getGetSession` / `postGetSession`). Уникальные имена
// не трогаются. См. dedupeNames ниже.

import { toGroupName, type SchemaNames } from './names'
import type { Json } from './types'
import {
  collectResponseSchemas,
  isFileSchema,
  pickResponseSchema,
  resolveRef,
  schemaToType,
} from './schema'

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export interface Operation {
  group: string
  name: string
  method: HttpMethod
  path: string
  pathParams: string[]
  queryParams: string[]
  bodyType: string | null
  bodyRequired: boolean
  /** Тело уходит как `multipart/form-data` (есть файловые поля). */
  isMultipart: boolean
  /** Плоские файловые поля тела — для рантайм-сборки FormData. */
  fileFields: { name: string; array: boolean }[]
  /** Тип тела успешного 2xx-ответа (режим клиента `'frontend'`). */
  responseType: string
  /** Все задекларированные ответы: статус → тип тела (режим `'test'`). */
  responses: { status: number; bodyType: string }[]
  summary?: string
}

/** Собирает плоский список операций из секции paths. */
export function collectOperations(args: { spec: Json; names: SchemaNames }): Operation[] {
  const { spec, names } = args
  const operations: Operation[] = []

  for (const [path, pathItem] of Object.entries<Json>(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op: Json | undefined = pathItem[method]
      if (!op) continue

      const operationId: string = op.operationId ?? `${method}${path}`
      const dotIndex = operationId.indexOf('.')
      const group = pickGroup({ op, operationId, path })
      const name = dotIndex === -1 ? operationId : operationId.slice(dotIndex + 1)

      const parameters: Json[] = op.parameters ?? []
      const pathParams = parameters.filter((p) => p.in === 'path').map((p) => p.name as string)
      const queryParams = parameters.filter((p) => p.in === 'query').map((p) => p.name as string)

      // Тело берём «multipart-aware»: для файловых эндпоинтов oRPC кладёт
      // СРАЗУ два content-типа (application/json + multipart/form-data) с
      // одинаковой схемой; предпочитаем multipart, иначе обычный json.
      const content: Json = op.requestBody?.content ?? {}
      const bodySchema =
        content['multipart/form-data']?.schema ?? content['application/json']?.schema

      const fileFields = collectFileFields({ schema: bodySchema, spec })
      const isMultipart = 'multipart/form-data' in content || fileFields.length > 0

      const responseSchema = pickResponseSchema({ responses: op.responses, spec })
      const responseType = schemaToType({ schema: responseSchema, spec, names, indent: 3 })

      const declared = collectResponseSchemas({ responses: op.responses, spec })
      const responses =
        declared.length > 0
          ? declared.map((r) => ({
              status: r.status,
              bodyType: schemaToType({ schema: r.schema, spec, names, indent: 4 }),
            }))
          : [{ status: 200, bodyType: responseType }]

      operations.push({
        group,
        name,
        method,
        path,
        pathParams,
        queryParams,
        bodyType: bodySchema ? schemaToType({ schema: bodySchema, spec, names, indent: 4 }) : null,
        bodyRequired: Boolean(op.requestBody?.required),
        isMultipart,
        fileFields,
        responseType,
        responses,
        summary: op.summary,
      })
    }
  }

  dedupeNames({ operations })
  return operations
}

/**
 * Группа операции: первый тег → префикс operationId до точки → первый
 * статический сегмент пути → `default`. Кандидат, из которого после
 * санитизации ничего не осталось (`'!!!'`), пропускается.
 */
function pickGroup(args: { op: Json; operationId: string; path: string }): string {
  const { op, operationId, path } = args
  const tag: unknown = op.tags?.[0]
  const dotIndex = operationId.indexOf('.')
  const segment = path.split('/').find((s) => s !== '' && !s.startsWith('{'))
  const candidates = [
    typeof tag === 'string' ? tag : undefined,
    dotIndex === -1 ? undefined : operationId.slice(0, dotIndex),
    segment,
  ]
  for (const raw of candidates) {
    const group = raw === undefined ? '' : toGroupName(raw)
    if (group) return group
  }
  return 'default'
}

/**
 * Обходит top-level свойства схемы тела и собирает файловые поля: прямой
 * файловый узел → `array: false`, массив файловых узлов → `array: true`.
 * `$ref` на свойстве/items разворачивается. Вложенность глубже одного
 * уровня не разбираем (типовой кейс — плоское тело; см. ARCHITECTURE.md §9).
 */
function collectFileFields(args: {
  schema: Json | undefined
  spec: Json
}): { name: string; array: boolean }[] {
  const { schema, spec } = args
  const deref = (s: Json | undefined): Json | undefined =>
    s && typeof s.$ref === 'string' ? resolveRef({ ref: s.$ref, spec }) : s

  const root = deref(schema)
  const props: Json = root?.properties ?? {}
  const out: { name: string; array: boolean }[] = []

  for (const [name, raw] of Object.entries<Json>(props)) {
    const prop = deref(raw)
    if (isFileSchema(prop)) {
      out.push({ name, array: false })
    } else if (prop?.type === 'array' && isFileSchema(deref(prop.items))) {
      out.push({ name, array: true })
    }
  }
  return out
}

/** `getSession` → `getGetSession`: метод спереди, имя с заглавной. */
function prefixMethod(args: { method: HttpMethod; name: string }): string {
  const { method, name } = args
  return method + name.charAt(0).toUpperCase() + name.slice(1)
}

/**
 * Разводит коллизии имён внутри каждой группы (мутирует `op.name`).
 * Если имя встречается больше одного раза — ко всем таким операциям
 * спереди дописывается HTTP-метод. Так результат не зависит от порядка:
 * ни одна из конфликтующих операций не «выигрывает» исходное имя.
 * Если после префикса коллизия всё ещё есть (один метод + одно имя на
 * разных путях) — добавляется числовой суффикс.
 */
function dedupeNames(args: { operations: Operation[] }): void {
  const { operations } = args

  // group → name → count
  const counts = new Map<string, Map<string, number>>()
  for (const op of operations) {
    const byName = counts.get(op.group) ?? new Map<string, number>()
    byName.set(op.name, (byName.get(op.name) ?? 0) + 1)
    counts.set(op.group, byName)
  }

  // Занятые итоговые имена в группе — чтобы давить остаточные коллизии.
  const taken = new Map<string, Set<string>>()
  const claim = (group: string, name: string): string => {
    const used = taken.get(group) ?? new Set<string>()
    let candidate = name
    let i = 2
    while (used.has(candidate)) candidate = `${name}${i++}`
    used.add(candidate)
    taken.set(group, used)
    return candidate
  }

  for (const op of operations) {
    const collides = (counts.get(op.group)?.get(op.name) ?? 0) > 1
    const base = collides ? prefixMethod({ method: op.method, name: op.name }) : op.name
    op.name = claim(op.group, base)
  }
}
