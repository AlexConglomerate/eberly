// Юнит-тесты генератора: renderClient — чистая функция «модель → текст»,
// тестируется без сети и без записи на диск.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSchemaNames } from './names'
import { collectOperations, type Operation } from './operations'
import { renderClient } from './render'
import { makeSpec } from './test-utils'
import type { Json } from './types'
import type { ClientMode } from '../config'

const spec = { info: { title: 'T', version: '1' }, servers: [{ url: '/api' }] }

const op: Operation = {
  group: 'posts',
  name: 'get',
  method: 'get',
  path: '/posts/{id}',
  pathParams: [{ name: 'id', required: true }],
  queryParams: [],
  bodyType: null,
  bodyRequired: false,
  isMultipart: false,
  fileFields: [],
  responseType: '{ "id": string }',
  responses: [{ status: 200, bodyType: '{ "id": string }' }],
  summary: 'Get a post',
}

// Файловая (multipart) операция — для проверки FILE_OPS и ветки в request.
const fileOp: Operation = {
  group: 'media',
  name: 'upload',
  method: 'post',
  path: '/media',
  pathParams: [],
  queryParams: [],
  bodyType: '{\n          "files": Array<FileInput>\n        }',
  bodyRequired: true,
  isMultipart: true,
  fileFields: [{ name: 'files', array: true }],
  responseType: '{ "ok": boolean }',
  responses: [{ status: 200, bodyType: '{ "ok": boolean }' }],
}

const render = (mode: ClientMode) =>
  renderClient({
    spec,
    names: new Map(),
    operations: [op],
    mode,
    userStoreImport: 'ebely',
    configImport: './ebely',
  })

test("режим 'test': ApiResponse, карта статусов, request не бросает", () => {
  const out = render('test')
  assert.match(out, /import \{ BaseStore, ApiResponse, HookRegistry, toMultipartFormData \} from "ebely"/)
  assert.match(out, /Promise<ApiResponse<\{ 200: \{ "id": string \} \}>>/)
  assert.match(out, /return \{ status: response\.status, body: data \}/)
  assert.doesNotMatch(out, /throw new Error\(/)
})

test("режим 'frontend': тело напрямую, без ApiResponse, request бросает", () => {
  const out = render('frontend')
  assert.match(out, /import \{ BaseStore, HookRegistry, toMultipartFormData \} from "ebely"/)
  assert.doesNotMatch(out, /ApiResponse/)
  assert.match(out, /Promise<\{ "id": string \}>/)
  assert.match(out, /throw new Error\(/)
})

test('оба режима: типизированное дерево хуков + проводка в request', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = render(mode)
    // публичный тип регистратора и дерево
    assert.match(out, /export type Hooks</)
    assert.match(out, /type EbelyHookTree<Store extends BaseStore> = \{/)
    assert.match(out, /before\(fn: BeforeHook<Store, undefined>\): void/)
    assert.match(out, /after\(fn: AfterHook<Store, undefined, \{ "id": string \}>\): void/)
    // глобальные хуки на все операции
    assert.match(out, /globalBefore\(fn: BeforeHook<Store>\): void/)
    assert.match(out, /globalAfter\(fn: AfterHook<Store>\): void/)
    assert.match(out, /globalRetry\(fn: RetryHook<Store>\): void/)
    assert.match(out, /globalBefore: \(fn: BeforeHook<Store>\) => r\.globalBefore\(\{ fn \}\)/)
    assert.match(out, /globalAfter: \(fn: AfterHook<Store>\) => r\.globalAfter\(\{ fn \}\)/)
    assert.match(out, /globalRetry: \(fn: RetryHook<Store>\) => r\.globalRetry\(\{ fn \}\)/)
    assert.match(out, /import type \{ BeforeHook, AfterHook, RetryHook \} from "ebely"/)
    // retry-цикл и обращение к runRetry в общем request
    assert.match(out, /const maxRetries = \(ebely as \{ maxRetries\?: number \}\)\.maxRetries \?\? 3/)
    assert.match(out, /await registry\.runRetry\(\{/)
    // реестр на World и применение конфиг-регистратора
    assert.match(out, /private hookRegistry = new HookRegistry\(\)/)
    assert.match(out, /if \(registrar\) registrar\(this\.buildHookTree\(\)\)/)
    // ключ операции и прогон до/после в общем request
    assert.match(out, /opKey: "posts\.get"/)
    assert.match(out, /await registry\.runBefore\(\{ key: opKey, request: hookReq, ctx: store \}\)/)
    assert.match(out, /await registry\.runAfter\(\{/)
  }
})

test('оба режима: путь, метод и summary на месте', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = render(mode)
    assert.match(out, / {7}\* Get a post\n/)
    assert.match(out, /method: "GET"/)
    assert.match(out, /path: "\/posts\/\{id\}"/)
  }
})

test('сценарии: экспортируется тип WorldApi (дерево вызовов для this.api)', () => {
  const t = render('test')
  assert.match(t, /export type WorldApi = \{/)
  assert.match(
    t,
    /"get": \(input: \{ path: \{ "id": string \} \}\) => Promise<ApiResponse<\{ 200: \{ "id": string \} \}>>/,
  )
  const f = render('frontend')
  assert.match(
    f,
    /"get": \(input: \{ path: \{ "id": string \} \}\) => Promise<\{ "id": string \}>/,
  )
})

test('world-store: World наследует сконфигурированный worldStore', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = render(mode)
    assert.match(out, /type ConfiguredWorldStore =/)
    assert.match(out, /const WorldStoreBase = \(\(ebely as \{ worldStore\?:/)
    assert.match(out, /> extends WorldStoreBase \{/)
    // конструктор инициализирует super() и анонимный api для world
    assert.match(out, /super\(\)/)
    assert.match(
      out,
      /;\(this as unknown as \{ api: unknown \}\)\.api = this\.buildApiTree\(/,
    )
  }
})

test('сценарии: один движок request, общий buildApiTree, store.api', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = render(mode)
    assert.match(out, /private makeRequest\(cfg: \{/)
    assert.match(out, /private buildApiTree\(request: RequestFn\): WorldApi \{/)
    // user-store получает то же дерево в .api (сценарии ходят от его лица)
    assert.match(
      out,
      /;\(store as unknown as \{ api: unknown \}\)\.api = tree/,
    )
    assert.match(out, /return Object\.assign\(store, tree\)/)
  }
})

test('multipart: FILE_OPS, ветка request, импорт файловых хелперов (оба режима)', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = renderClient({
      spec,
      names: new Map(),
      operations: [fileOp],
      mode,
      userStoreImport: 'ebely',
      configImport: './ebely',
    })
    // импорты: значение toMultipartFormData + типы файлов
    assert.match(out, /import type \{ FileInput, FileEncoding, FileFieldMeta \} from "ebely"/)
    // статическая карта файловых операций
    assert.match(out, /const FILE_OPS: Record<string, FileFieldMeta\[\]> = \{/)
    assert.match(out, /"media\.upload": \[\{ name: "files", array: true \}\]/)
    // ветка в общем request: дефолт 'repeat', чтение ebely.files.encoding
    assert.match(out, /const fileFields = FILE_OPS\[opKey\]/)
    assert.match(out, /await toMultipartFormData\(\{/)
    assert.match(out, /\.files\?\.encoding \?\? 'repeat'/)
    assert.match(out, /const isMultipart = form !== undefined/)
    // тип поля в сигнатуре — FileInput, а не string
    assert.match(out, /"files": Array<FileInput>/)
  }
})

test('без файловых операций: FILE_OPS пустой', () => {
  const out = render('test')
  assert.match(out, /const FILE_OPS: Record<string, FileFieldMeta\[\]> = \{\}/)
})

// --- именованные типы, один источник типов --------------------------------

/** Полный путь генератора на мини-спеке: names → operations → render. */
function renderSpec(args: { spec: Json; mode?: ClientMode }): string {
  const { spec, mode = 'test' } = args
  const names = buildSchemaNames({ spec })
  return renderClient({
    spec,
    names,
    operations: collectOperations({ spec, names }),
    mode,
    userStoreImport: 'ebely',
    configImport: './ebely',
  })
}

const postsSpec = makeSpec({
  schemas: {
    PostDto: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'number' }, related: { type: 'array', items: { $ref: '#/components/schemas/PostDto' } } },
    },
  },
  paths: {
    '/posts': {
      post: {
        operationId: 'posts.create',
        tags: ['Posts'],
        summary: 'Create a post',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { title: { type: 'string' } } },
            },
          },
        },
        responses: {
          201: { content: { 'application/json': { schema: { $ref: '#/components/schemas/PostDto' } } } },
        },
      },
    },
  },
})

/** Кусок исходника — реализация дерева вызовов. */
const apiTreeImpl = (out: string): string =>
  out.slice(out.indexOf('private buildApiTree'), out.indexOf('createUser('))

test('именованный тип объявлен ровно один раз, после импортов', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = renderSpec({ spec: postsSpec, mode })
    assert.equal(out.match(/export type PostDto =/g)?.length, 1)
    assert.ok(out.indexOf('export type PostDto =') > out.indexOf('import { ebely }'))
    assert.match(out, /"related"\?: Array<PostDto>/)
  }
})

test('WorldApi ссылается на именованный тип', () => {
  assert.match(
    renderSpec({ spec: postsSpec, mode: 'test' }),
    /"create": \(input: \{ body: \{[^]*?\} \}\) => Promise<ApiResponse<\{ 201: PostDto \}>>/,
  )
  assert.match(renderSpec({ spec: postsSpec, mode: 'frontend' }), /=> Promise<PostDto>/)
})

test('реализация типизирована через WorldApi и не повторяет типы', () => {
  for (const mode of ['test', 'frontend'] as const) {
    const out = renderSpec({ spec: postsSpec, mode })
    assert.match(out, /private buildApiTree\(request: RequestFn\): WorldApi \{/)
    const impl = apiTreeImpl(out)
    assert.doesNotMatch(impl, /"title"\?: string/)
    assert.doesNotMatch(impl, /PostDto/)
    assert.doesNotMatch(impl, /\/\*\* Create a post \*\//)
  }
})

/** Кусок исходника — тип `WorldApi`. */
const worldApiType = (out: string): string =>
  out.slice(out.indexOf('export type WorldApi'), out.indexOf('type EbelyHookTree'))

test('JSDoc эндпоинта: summary, description и маршрут — над методом в WorldApi', () => {
  const spec = makeSpec({
    paths: {
      '/posts': {
        post: {
          operationId: 'posts.create',
          summary: 'Create a post',
          description: 'Only for authenticated users.\nThe author is the current user.',
          responses: { 201: { description: 'ok' } },
        },
      },
    },
  })
  const worldApi = worldApiType(renderSpec({ spec }))
  assert.ok(
    worldApi.includes(
      [
        '      /**',
        '       * Create a post',
        '       *',
        '       * Only for authenticated users.',
        '       * The author is the current user.',
        '       *',
        '       * `POST /posts`',
        '       */',
        '      "create": ',
      ].join('\n'),
    ),
  )
  assert.doesNotMatch(worldApi, /@deprecated/)
})

test('JSDoc эндпоинта: deprecated → @deprecated', () => {
  const spec = makeSpec({
    paths: { '/auth/whoami': { get: { operationId: 'auth.whoami', deprecated: true, responses: {} } } },
  })
  assert.match(worldApiType(renderSpec({ spec })), /\* `GET \/auth\/whoami`\n {7}\* @deprecated\n {7}\*\/\n {6}"whoami"/)
})

test('JSDoc: "*/" в описании экранируется и не закрывает комментарий', () => {
  const spec = makeSpec({
    paths: {
      '/x': { get: { operationId: 'x.get', summary: 'a */ b', description: 'c */ process.exit(1)', responses: {} } },
    },
  })
  const worldApi = worldApiType(renderSpec({ spec }))
  assert.match(worldApi, /\* a \*\\\/ b\n/)
  assert.match(worldApi, /\* c \*\\\/ process\.exit\(1\)\n/)
  // единственный `*/` в типе — штатное закрытие комментария
  assert.equal(worldApi.match(/\*\//g)?.length, 1)
})

test('JSDoc параметров path / query; без описаний — в одну строку', () => {
  const spec = makeSpec({
    paths: {
      '/posts/{id}': {
        get: {
          operationId: 'posts.get',
          parameters: [
            { name: 'id', in: 'path', description: 'Post id' },
            { name: 'full', in: 'query' },
          ],
          responses: {},
        },
      },
    },
  })
  const worldApi = worldApiType(renderSpec({ spec }))
  assert.match(worldApi, /path: \{\n {10}\/\*\* Post id \*\/\n {10}"id": string\n {8}\}/)
  assert.match(worldApi, /query\?: \{ "full"\?: string \| number \| boolean \}/)
})

test('JSDoc полей схемы: description и deprecated', () => {
  const spec = makeSpec({
    schemas: {
      PostDto: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Post title' },
          legacy: { type: 'string', deprecated: true },
          plain: { type: 'string' },
        },
      },
    },
  })
  const out = renderSpec({ spec })
  assert.match(out, / {2}\/\*\* Post title \*\/\n {2}"title"\?: string/)
  assert.match(out, / {2}\/\*\* @deprecated \*\/\n {2}"legacy"\?: string/)
  assert.match(out, /\n {2}"plain"\?: string/)
  assert.doesNotMatch(out, /"plain"\?: string[^]*\/\*\*\s*\*\//)
})

test('без описаний — без пустых /** */', () => {
  const spec = makeSpec({
    schemas: { A: { type: 'object', properties: { x: { type: 'string' } } } },
    paths: { '/a/{id}': { get: { operationId: 'a.get', parameters: [{ name: 'id', in: 'path' }], responses: {} } } },
  })
  const out = renderSpec({ spec })
  assert.doesNotMatch(out, /\/\*\*\s*\*\//)
  // у эндпоинта остаётся только маршрут
  assert.match(worldApiType(out), /\/\*\* `GET \/a\/\{id\}` \*\/\n {6}"get": \(input: \{ path: \{ "id": string \} \}\)/)
})

test('без схем блок объявлений не рендерится', () => {
  const out = renderSpec({ spec: makeSpec() })
  assert.match(out, /from "\.\/ebely"\n\nconst FILE_OPS/)
})
