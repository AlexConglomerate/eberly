---
name: eberly-setup
description: One-time setup of eberly (backend e2e tests through a typed client generated from OpenAPI) for the user's backend - config, client generation, auth scenario, hooks and green smoke tests. Use when the user starts testing a backend with eberly, runs /eberly-setup, or the project still contains the eberly template example.
---

# eberly-setup

Goal: from an empty folder (or a fresh `npx eberly create` template) to green
smoke tests against the user's backend, plus a short report of what the
backend lacks for testing.

Read `eberly/api/*.md` instead of `eberly/generated.ts` (never open it whole)
and do not read the backend source unless the user asks. The API cheat sheet
(assert, stores, hooks) is in `../eberly-write-tests/SKILL.md`.

## 1. Ask the user

These cannot be derived from the swagger. Ask in one message, suggest
defaults, and skip what the user already told you:

1. **Swagger source:** URL of the running backend (`/swagger.json`,
   `/openapi.json`, Nest: `/docs-json`, FastAPI: `/openapi.json`) or a
   JSON/YAML file.
2. **Backend URL** (default `http://localhost:3000`). If it is not
   localhost / 127.0.0.1, ask explicitly: "Is this a test environment and
   **not production**?" Only on a clear yes add its host to `allowedHosts`.
3. **Auth:** which endpoints register and log in, where the token is in the
   response, which header carries it (default `Authorization: Bearer`).
4. **Test mode:** is there an endpoint that resets data? How do tests get
   a code from an email/SMS (test endpoint, fixed code in test mode)?
   If something is missing, note what to add to the backend and continue
   with what exists.

## 2. Project

- `eberly/eberly.ts` exists → it is an eberly project, continue.
- Otherwise run `npx eberly create <dir>` (recommend a separate folder or
  repository next to the backend, e.g. `api-tests`) and work inside it.

A fresh template contains an **example for another backend** (posts, oRPC):
`swagger.json`, `eberly/userStore.ts`, `eberly/worldStore.ts`,
`eberly/hooks.ts`, `eberly/handlers.ts`, `tests/test1.test.ts`. Before
generating, clear it out, otherwise `client:generate` fails on the imports:

1. `eberly/hooks.ts` → an empty registrar (step 5 fills it):
   `import type { Hooks } from './generated'`,
   `import type { UserStore } from './userStore'`,
   `export const hooks: Hooks<UserStore> = () => {}`;
2. delete `eberly/handlers.ts` and `tests/test1.test.ts`;
3. stores are rewritten in step 5, `swagger.json` in step 3.

## 3. Config: `eberly/eberly.ts`

- `url`: the backend URL.
- `swagger`: prefer a committed file, `{ pathToFile: 'swagger.json' }`
  (`.json`, `.yaml` or `.yml`). Download it with
  `curl -fsSL <swagger-url> -o swagger.json` (re-run when the backend
  changes). `{ url }` takes any http(s) URL, with or without `.json`
  (e.g. Nest's `/docs-json`). JSON or YAML is detected from the content.
- `allowedHosts: ['staging.example.com']` only for a confirmed non-prod host.
- Backend on oRPC with arrays of files: `files: { encoding: 'bracket-index' }`.
- Keep `userStore`, `worldStore`, `hooks`, `generateClientTo`, `mode: 'test'`.
  Translate or drop the template's non-English comments.

## 4. Generate

```sh
pnpm install
pnpm run client:generate
```

Generation fails on Swagger 2.0: ask the user for an OpenAPI 3.x document
(most frameworks can emit it). Then read `eberly/api/INDEX.md`, and only
the `<group>.<method>.md` files of the auth, reset and smoke endpoints.

## 5. Stores and hooks

`eberly/userStore.ts`: variables of one user and the auth scenario.

```ts
import { BaseStore } from 'eberly'
import type { WorldApi } from './generated'

export type UserVars = { email: string; password: string; accessToken: string }

export class UserStore extends BaseStore<UserVars, WorldApi> {
  /** Register and log in, keep the token for all later requests. */
  public async signUp(args: { email: string; password: string }): Promise<void> {
    ;(await this.api.auth.register({ body: args })).assert(201)
    const login = await this.api.auth.login({ body: args })
    const { accessToken } = login.assert(200).body
    this.set({ key: 'email', value: args.email })
    this.set({ key: 'password', value: args.password })
    this.set({ key: 'accessToken', value: accessToken })
  }
}
```

Adapt names, statuses and the token path to the md files. Email/SMS
confirmation goes inside `signUp` too, so tests stay one line.

`eberly/worldStore.ts`: `reset()` calling the reset endpoint, if there is
one (`export type WorldVars = Record<string, never>` when no variables).
Without a reset endpoint keep the class empty and rely on unique data.

`eberly/hooks.ts`: `globalBefore` that sends the token from `ctx` (see the
cheat sheet), and an after-hook per create endpoint that saves the new id
(`lastPostId`, …) into a store variable, checking `response.status` first.

## 6. Smoke tests

One file per group, `tests/<group>.test.ts`. For each group: one happy
path and one negative test (401 without a token, or 404 for a missing id).

```ts
describe('posts', () => {
  const world = new World()
  const alice = world.createUser()
  beforeAll(async () => {
    await world.reset()
    await alice.signUp({ email: `alice-${randomUUID()}@example.com`, password: 'secret123' })
  })
  test('author creates a post', async () => { /* … assert(201, { title }) */ })
  test('anonymous user gets 401', async () => {
    ;(await world.createUser().posts.create({ body: { title: 'x', content: 'y' } })).assert(401)
  })
})
```

Skip endpoints that need data you cannot create; list them in the report.

## 7. Run until green

The backend must be running (ask the user to start it, in test mode if it
has one). Then `pnpm typecheck && pnpm test`. If a test fails because the
backend contradicts its own swagger, keep the test honest and report it.

## 8. Report

Short and concrete:
- what is covered (groups, scenarios, hooks);
- what the backend lacks for testing: reset endpoint, a way to read
  email/SMS codes, undeclared statuses (401/403 missing in the swagger),
  missing descriptions or response schemas;
- next step: `/eberly-write-tests <scenario in words>`.

## Rules

- Never edit `eberly/generated.ts` or `eberly/api/`.
- Tests run sequentially (`fileParallelism: false` in `vitest.config.ts`).
- Unique data in every test (`randomUUID()`).
- Never point tests at production. Only loopback and hosts the user
  confirmed as non-prod go into `allowedHosts`.
