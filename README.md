# eberly

**Typed end-to-end API tests for any backend with an OpenAPI 3 spec.**

[![npm](https://img.shields.io/npm/v/eberly)](https://www.npmjs.com/package/eberly)
[![license](https://img.shields.io/npm/l/eberly)](LICENSE)

eberly reads your backend's OpenAPI spec (JSON or YAML) and generates a typed TypeScript
client for tests. Every test user gets their own state, hooks keep tokens and
ids for you, and when the backend changes its contract, the tests stop
compiling.

## Before and after

Scenario: Alice creates a post, Bob tries to delete it and must get `403`.

**Before:** bare `fetch`, tokens by hand, `any` everywhere.

```ts
const base = 'http://localhost:3000'
const json = { 'Content-Type': 'application/json' }

async function signUp(email: string) {
  const body = JSON.stringify({ email, password: 'secret123' })
  await fetch(`${base}/auth/register`, { method: 'POST', headers: json, body })
  const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: json, body })
  const { accessToken } = await login.json() // any
  return { ...json, Authorization: `Bearer ${accessToken}` }
}

const alice = await signUp('alice@example.com')
const bob = await signUp('bob@example.com')

const created = await fetch(`${base}/posts`, {
  method: 'POST',
  headers: alice,
  body: JSON.stringify({ title: 'Hello', content: 'First post' }),
})
const post = await created.json() // any: `post.titel` compiles just fine
const res = await fetch(`${base}/posts/${post.id}`, { method: 'DELETE', headers: bob })
expect(res.status).toBe(403)
expect((await res.json()).message).toBe('Only the author can do this')
```

**After:** eberly
([`tests/readme.test.ts`](examples/nest/test-with-eberly/tests/readme.test.ts)).

```ts
const world = new World()
const alice = world.createUser()
const bob = world.createUser()
await alice.signUp({ email: 'alice@example.com', password: 'secret123' })
await bob.signUp({ email: 'bob@example.com', password: 'secret123' })

const post = await alice.posts.create({ body: { title: 'Hello', content: 'First post' } })
const res = await bob.posts.remove({ path: { id: String(post.assert(201).body.id) } })
res.assert(403, { message: 'Only the author can do this' })
```

`signUp` is a scenario you write once in your
[`userStore.ts`](examples/nest/test-with-eberly/eberly/userStore.ts). A hook
([`hooks.ts`](examples/nest/test-with-eberly/eberly/hooks.ts)) adds the Bearer
token to every request of that user. `posts.create`, `posts.remove`, the body
and the statuses `201` / `403` are all checked by TypeScript.

## Why eberly

- **Typed client from your swagger.** Request bodies, path params, response
  bodies and statuses come from the spec. The backend renames a field, and the
  test turns red before it even runs.
- **Many users, each with their own state.** `world.createUser()` gives a user
  with their own token and variables, so "Bob can't touch Alice's post" is
  three lines.
- **Hooks keep tokens and ids for you.** A `before` hook adds the token, an
  `after` hook saves the id of the created entity. Tests don't pass them
  around.
- **Status with autocomplete, partial body check.** `res.assert(201, { title })`
  suggests the statuses declared in the spec, checks only the fields you pass
  (at any depth) and narrows `res.body` to the type of that status.
- **Transparent token refresh.** A `globalRetry` hook refreshes the token on
  `401`, and eberly replays the request: the test sees `200`.
- **File upload by path.** `{ body: { file: './avatar.png' } }`, and eberly
  builds the multipart form.
- **Endpoint docs for AI agents.** The generator writes `eberly/api/`: one short
  Markdown file per endpoint, so an agent writes tests without reading the
  whole client or the backend code.

## Quick start

```sh
npx eberly create my-tests   # template + Claude Code skills in my-tests/.claude/skills
cd my-tests
```

**With Claude Code:** run `claude` in this folder, then

```
/eberly-setup                                        # a few questions → config, client, stores, hooks, green smoke tests
/eberly-write-tests Bob cannot delete Alice's post   # test written and run
```

**By hand:**

1. In `eberly/eberly.ts`, set `url` (your backend) and `swagger` (a file or a
   URL of your spec).
2. Install and generate the client:

   ```sh
   pnpm install
   pnpm run client:generate   # writes eberly/generated.ts and eberly/api/
   ```

3. The template's stores and `tests/` are written for the demo backend.
   Replace them with your own (`/eberly-setup` does this for you).
4. Run the checks:

   ```sh
   pnpm typecheck && pnpm test
   ```

**Existing project:** `pnpm add -D eberly`, then `npx eberly skills` (or
`npx eberly skills --user` to install them into `~/.claude/skills`). Skills are
copied, so run the command again after updating eberly.

## Examples

All snippets below come from tests that pass in `pnpm e2e` against real
backends in [`examples/`](examples).

### Auth and token refresh

[`examples/simple-auth`](examples/simple-auth/test-with-eberly): one
`globalBefore` adds the token to every request; `globalRetry` refreshes it on
`401` and asks eberly to replay the request
([`hooks.ts`](examples/simple-auth/test-with-eberly/eberly/hooks.ts)).

```ts
h.globalBefore(withBearer)

h.globalRetry(async ({ request, response, ctx }) => {
  if (response.status !== 401) return false
  // Don't refresh auth endpoints themselves: a wrong password must stay 401.
  if (request.path.startsWith('/auth/')) return false
  if (!ctx.get({ key: 'email' }) || !ctx.get({ key: 'password' })) return false
  await ctx.refresh()
  return true // → eberly replays the request with the fresh token
})
```

The test revokes the session, and a single call still returns `200`
([`refresh.test.ts`](examples/simple-auth/test-with-eberly/tests/refresh.test.ts)):

```ts
await world.revoke({ email: 'dave@example.com' })

const res = await dave.posts.list({})
res.assert(200)
```

Replays are capped by `maxRetries` (default `3`).

### The id of a created entity is saved by a hook

[`hooks.ts`](examples/nest/test-with-eberly/eberly/hooks.ts): `ctx` is the store
of the user who made the request, so ids never leak between users.

```ts
h.posts.create.after(({ response, ctx }) => {
  if (response.status === 201) {
    ctx.set({ key: 'lastPostId', value: response.body.id })
  }
})
```

[`posts.test.ts`](examples/nest/test-with-eberly/tests/posts.test.ts):

```ts
const created = await alice.posts.create({ body: { title: 'Hello', content: 'First post' } })
created.assert(201, { title: 'Hello', publishedAt: null })

const postId = alice.get({ key: 'lastPostId' })!
expect(postId).toBe(created.assert(201).body.id)
expect(bob.get({ key: 'lastPostId' })).toBeUndefined()
```

### Recursive comments and deep-partial checks

`CommentDto.replies` refers to itself. `assert` checks only the fields you pass,
at any depth
([`comments.test.ts`](examples/nest/test-with-eberly/tests/comments.test.ts)):

```ts
const tree = await bob.comments.list({ path })
tree.assert(200, [{ text: 'a', replies: [{ text: 'b', replies: [{ text: 'c', replies: [] }] }] }])
```

### File upload

Pass a path, eberly reads the file and builds the multipart form
([`avatar.test.ts`](examples/nest/test-with-eberly/tests/avatar.test.ts)):

```ts
const avatarPath = fileURLToPath(new URL('./fixtures/avatar.png', import.meta.url))

const res = await alice.users.uploadAvatar({ body: { file: avatarPath } })
const user = res.assert(201).body
expect(user.avatarUrl).toBe(`/avatars/${user.id}.png`)
```

A file can also be a `URL`, `{ path, name?, type? }`, `{ content, name }`,
`Blob` or `File`.

### The backend breaks the contract

Rename `title` to `headline` in the Nest backend's `CreatePostDto`, regenerate
the client and run `pnpm typecheck`:

```
tests/readme.test.ts(20,53): error TS2353: Object literal may only specify known properties, and 'title' does not exist in type 'CreatePostDto'.
```

Every test that sends the old field fails to compile, with the file and line.
No test run, no backend needed.

## Writing tests with AI agents

`pnpm run client:generate` writes, next to the client, an `eberly/api/` folder
for agents:

- [`INDEX.md`](examples/nest/test-with-eberly/eberly/api/INDEX.md): one line per
  endpoint, grouped by tag.

  ```md
  ## posts
  - posts.list — GET /posts — List published posts
  - posts.create — POST /posts — Create a post
  ```

- `<group>.<method>.md`, e.g.
  [`posts.create.md`](examples/nest/test-with-eberly/eberly/api/posts.create.md):
  description, a ready-to-paste call, input, responses by status and the types
  they use, with field descriptions from the spec.

An agent reads the index, then opens only the endpoints of its scenario: a few
dozen lines each, instead of the whole `generated.ts` (700+ lines for a small
backend) or the backend source. Less context spent, fewer made-up fields.

Two Claude Code skills use this folder:

- `/eberly-setup`: asks where the spec is, how auth works and how to reset data,
  then writes the config, stores, hooks and smoke tests until they are green.
- `/eberly-write-tests <scenario>`: writes and runs a test for a scenario in
  plain words.

`npx eberly create` installs both; `npx eberly skills` installs them into an
existing project.

## What your backend needs

- **OpenAPI 3.0 or 3.1**, as JSON or YAML. Swagger 2.0 is rejected with a
  clear error.
- **`tags` on operations.** The first tag is the group: `user.posts.create(…)`.
  Without tags the group comes from the `operationId` prefix, then the path.
- **A test mode.** Tests need to start from a known state and finish flows
  without real email or SMS:
  - an endpoint that resets data (only in test mode);
  - predictable confirmation codes;
  - no real emails or SMS.

  See `TEST_MODE` in the Nest example:
  [`main.ts`](examples/nest/your-app/src/main.ts) and
  [`app.module.ts`](examples/nest/your-app/src/app.module.ts) mount
  `POST /test/reset` only when `TEST_MODE=1`.

### Recipes

**NestJS.** By default Nest names operations `PostsController_create`. An
`operationIdFactory` gives `posts.create`
([`openapi.ts`](examples/nest/your-app/src/openapi.ts)):

```ts
return SwaggerModule.createDocument(app, config, {
  operationIdFactory: (controllerKey, methodKey) =>
    `${controllerKey.replace(/Controller$/, '').toLowerCase()}.${methodKey}`,
})
```

With `SwaggerModule.setup('docs', …)` Nest serves the spec at `/docs-json`.
Point eberly straight at it: `swagger: { url: 'http://localhost:3000/docs-json' }`.
Any http(s) URL works, with or without `.json` (springdoc's `/v3/api-docs`
too).

**oRPC.** Its OpenAPI handler expects arrays of files as `files[0]`,
`files[1]`, so set:

```ts
files: { encoding: 'bracket-index' },
```

## ⚠️ Gotchas

- **Tests run sequentially.** All test files share one backend and one
  database, and each resets it in `beforeAll`. In parallel they would wipe each
  other's data. The template already sets this in `vitest.config.ts`; with
  your own config add it yourself:

  ```ts
  export default defineConfig({
    test: {
      fileParallelism: false,
    },
  })
  ```

- **`allowedHosts`: localhost only by default.** In `test` mode the client
  sends requests only to `localhost`, `127.0.0.1`, `[::1]` and the hosts you
  list. Anything else throws `EberlyUnsafeHostError` in `new World()`, before
  the first request. Add a staging host if you need one; never production.

  ```ts
  export const eberly = {
    url: 'https://api.staging.example.com',
    allowedHosts: ['*.staging.example.com'],
    // …
  } satisfies EberlyConfig
  ```

- **vitest doesn't check types.** A test with a type error still runs. Run
  `pnpm typecheck` (`tsc --noEmit`) in CI, before `pnpm test`.
- **The spec changed → regenerate.** `pnpm run client:generate` after every
  change of the swagger, then `pnpm typecheck`.
- **Commit `eberly/generated.ts` and `eberly/api/`.** Then a contract change
  shows up in the diff of a pull request.
- **A status from a variable needs `as const`.** Otherwise it is just
  `number`:

  ```ts
  for (const s of [401, 403] as const) res.assert(s)
  ```

## Config reference

`eberly/eberly.ts` exports the config with `satisfies EberlyConfig`:

```ts
export const eberly = {
  userStore: UserStore,
  worldStore: WorldStore,

  url: 'http://localhost:3000',
  swagger: { pathToFile: 'swagger.json' },
  generateClientTo: 'eberly/generated.ts',
  hooks,
  mode: 'test',
} satisfies EberlyConfig
```

| Field | Default | Description |
| --- | --- | --- |
| `url` | (required) | Base URL of the backend under test. `new World({ url })` overrides it. |
| `swagger` | (required) | Where to read the spec, JSON or YAML: a file `{ pathToFile: 'swagger.json' }` (`.json`, `.yaml` or `.yml`) or any http(s) URL `{ url: 'http://localhost:3000/docs-json' }`. |
| `generateClientTo` | (required) | Path of the generated client, e.g. `'eberly/generated.ts'`. `eberly/api/` is written next to it. |
| `userStore` | (required) | Class extending `BaseStore`: variables and scenarios of one user. |
| `worldStore` | none | Class extending `BaseStore`: app-level scenarios such as `reset()`, called as `world.reset()`. |
| `hooks` | none | Hook registrar, typed as `Hooks<UserStore>` from the generated client. |
| `mode` | `'test'` | `'test'`: methods return a response with `.status`, `.body`, `.assert()`; non-2xx doesn't throw. `'frontend'`: methods return the body and throw on non-2xx. |
| `maxRetries` | `3` | Max replays of one request when a `globalRetry` hook returns `true`. |
| `files` | `{ encoding: 'repeat' }` | Field names for an array of files: `'repeat'` (`files`, `files`), `'bracket-index'` (`files[0]`), `'bracket-empty'` (`files[]`) or a function. |
| `allowedHosts` | `[]` | Hosts besides loopback the client may call in `test` mode: exact names or `*.domain`. |
| `userStoreImport` | `'eberly'` | Module the generated file imports `BaseStore` from. Only for unusual layouts. |
| `configImport` | `'./eberly'` | Path from the generated file to this config. Only for unusual layouts. |

`maxRetries`, `files` and `allowedHosts` are read at runtime: changing them
doesn't need a regeneration.

## API cheat sheet

```ts
import { World } from '../eberly/generated'

const world = new World()             // reads eberly.ts: url, stores, hooks
const alice = world.createUser()      // a user with their own variables and token
await world.reset()                   // a worldStore scenario

const res = await alice.posts.get({ path: { id: '1' } })   // also: body, query
res.status                            // number
res.body                              // union of the declared response bodies
res.assert(200)                       // status only
res.assert(200, { title: 'Hello' })   // + deep-partial body check
res.assert(200).body.title            // body narrowed to the 200 type
res.assert(403)                       // any undeclared 4xx/5xx works without a cast

alice.set({ key: 'lastPostId', value: 1 })
alice.get({ key: 'lastPostId' })      // number | undefined
```

Stores (`eberly/userStore.ts`):

```ts
export class UserStore extends BaseStore<UserVars, WorldApi> {
  public async signUp(args: { email: string; password: string }): Promise<void> {
    // this.api.<group>.<method>(…) calls the API as this user
  }
}
```

Hooks (`eberly/hooks.ts`):

| Hook | When | Arguments |
| --- | --- | --- |
| `h.globalBefore(fn)` | before every request | `{ request, ctx }` |
| `h.<group>.<method>.before(fn)` | before this endpoint, after global ones | `{ request, ctx }` |
| `h.<group>.<method>.after(fn)` | after this endpoint | `{ request, response, ctx }` |
| `h.globalAfter(fn)` | after every request, after endpoint ones | `{ request, response, ctx }` |
| `h.globalRetry(fn)` | after every request; return `true` to replay it | `{ request, response, ctx }` |

`request` has `method`, `path`, `headers`, `query`, `body`; `ctx` is the store
of the user who made the request.

## Limitations and roadmap

- Swagger 2.0 is not supported (convert it to OpenAPI 3 first).
- Method names come from `operationId` as is: default Nest or FastAPI ids
  (`PostsController_create`, `read_items_items_get`) give awkward names.
- Tests run sequentially; parallel runs need isolated data per test file.
- Examples cover TypeScript backends only; Python, Go and Rust examples are
  planned.

## License

[MIT](LICENSE)

Formerly published as [`ebely`](https://www.npmjs.com/package/ebely).
