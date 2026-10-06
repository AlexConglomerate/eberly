# eberly

**Typed end-to-end API tests for any backend with an OpenAPI 3 spec.**

[![npm](https://img.shields.io/npm/v/eberly)](https://www.npmjs.com/package/eberly)
[![license](https://img.shields.io/npm/l/eberly)](LICENSE)

**[Docs](https://eberly.dev)** ·
**[Playground](https://eberly.dev/playground/)** ·
**[Open in StackBlitz](https://stackblitz.com/github/AlexConglomerate/eberly?file=examples/nest/test-with-eberly/tests/readme.test.ts)**

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
const res = await bob.posts.remove({ path: { postId: post.assert(201).body.id } })
res.assert(403, { message: 'Only the author can do this' })
```

`signUp` is a scenario you write once in your
[`userStore.ts`](examples/nest/test-with-eberly/eberly/userStore.ts). A hook
([`hooks.ts`](examples/nest/test-with-eberly/eberly/hooks.ts)) adds the Bearer
token to every request of that user. `posts.create`, `posts.remove`, the body
and the statuses `201` / `403` are all checked by TypeScript.

## Why eberly

- **Typed client from your spec.** Request bodies, path params, response
  bodies and statuses come from the spec. The backend renames a field, and the
  test turns red before it even runs
  ([contract changes](https://eberly.dev/guides/contract-changes/)).
  Data declared before the call is typed too:
  `satisfies BodyOf<typeof alice.posts.create>`
  ([endpoint types](https://eberly.dev/reference/api/#endpoint-types)).
- **Many users, each with their own state.** `world.createUser()` gives a user
  with their own token and variables
  ([getting started](https://eberly.dev/getting-started/)).
- **Hooks keep tokens and ids for you.** A `before` hook adds the token, an
  `after` hook saves the id of the created entity
  ([save ids with hooks](https://eberly.dev/guides/save-ids-with-hooks/)).
- **Status with autocomplete, partial body check.** `res.assert(201, { title })`
  checks only the fields you pass, at any depth
  ([recursive comments](https://eberly.dev/guides/recursive-comments/)).
- **Shapes instead of values.** `res.assert(201, { id: z.number(), createdAt: z.iso.datetime() })`:
  any Standard Schema (Zod, Valibot, ArkType) or `expect.any(…)` in place of a value
  ([schemas and matchers](https://eberly.dev/guides/schemas-and-matchers/)).
- **Transparent token refresh.** A `globalRetry` hook refreshes the token on
  `401`, and eberly replays the request
  ([auth and token refresh](https://eberly.dev/guides/auth-and-token-refresh/)).
- **File upload by path.** `{ body: { file: './avatar.png' } }`, and eberly
  builds the multipart form
  ([file upload](https://eberly.dev/guides/file-upload/)).
- **Endpoint docs for AI agents.** One short Markdown file per endpoint in
  `eberly/api/`, plus Claude Code skills
  ([AI agents](https://eberly.dev/guides/ai-agents/)).

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

## Learn more

- [What your backend needs](https://eberly.dev/backend-requirements/): OpenAPI
  3.0/3.1, tags, a test mode; NestJS and oRPC recipes.
- [Gotchas](https://eberly.dev/gotchas/): sequential tests, `allowedHosts`,
  type checks in CI.
- [Config reference](https://eberly.dev/reference/config/) and
  [API cheat sheet](https://eberly.dev/reference/api/).
- [Limitations and roadmap](https://eberly.dev/roadmap/).
- [Examples](examples): real backends (oRPC, NestJS) with tests that pass in `pnpm e2e`.

## License

[MIT](LICENSE)

Formerly published as [`ebely`](https://www.npmjs.com/package/ebely).
