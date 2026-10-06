---
name: eberly-write-tests
description: Write or change backend e2e tests with eberly (typed client generated from OpenAPI). Use whenever the user describes a test scenario in words ("Bob cannot delete Alice's post"), asks to cover an endpoint, or to fix a failing eberly test. Requires a project already set up with /eberly-setup.
---

# eberly-write-tests

Turn a scenario described in words into a passing vitest test that calls the
backend through the generated eberly client.

**Token budget rule:** the endpoint docs in `eberly/api/` contain everything
you need. Do **not** open `eberly/generated.ts` and do **not** read the
backend source code. If a doc is unclear, run the call and look at the real
response instead.

## Steps

1. **Fresh client.** If the backend's swagger changed (or the user says so),
   refresh it first: re-download the spec file (JSON or YAML) if
   `eberly/eberly.ts` uses `pathToFile` and the user gave a URL (with
   `{ url }` there is nothing to download), then `pnpm run client:generate`.
2. **Pick endpoints.** Read `eberly/api/INDEX.md` and choose the endpoints
   the scenario needs.
3. **Read only those docs:** `eberly/api/<group>.<method>.md`. Each one has a
   call example, the input shape, every declared status with its body type,
   and the referenced types.
4. **Know what already exists.** Read `eberly/userStore.ts`,
   `eberly/worldStore.ts`, `eberly/hooks.ts`: scenarios (`signUp`, …),
   variables (`lastPostId`, …) and what hooks save. Skim `tests/` for the
   file that fits the scenario and for its `beforeAll`.
5. **Write the test** (into an existing `tests/<group>.test.ts`, or a new one):
   - every person in the scenario is its own `world.createUser()`;
     an anonymous user is a `createUser()` that never signed in;
   - reuse store scenarios instead of repeating register/login steps;
   - `res.assert(status, partialBody)`: take statuses from the md files;
     any 4xx/5xx is allowed even if the swagger does not declare it;
   - take ids from store variables that hooks save, or from
     `res.assert(201).body.id`;
   - unique data per test (`randomUUID()` in emails, titles);
   - test names describe behavior: `'non-author gets 403 on delete'`.
6. **Refactor when it repeats.** Multi-step setup used in 2+ tests → a
   method on `UserStore` (or `WorldStore` for global setup). Need an id
   later → an after-hook in `hooks.ts` plus a variable in the store type.
7. **Run:** `pnpm typecheck && pnpm test`. Fix until green. A failure is
   either a wrong test (check the md again) or a backend bug: if the
   backend contradicts its own swagger, say so to the user instead of
   bending the test.

## Rules

- Never edit `eberly/generated.ts` or `eberly/api/`: they are regenerated.
- Tests run sequentially (`fileParallelism: false`); each file resets data
  in `beforeAll` if the world store has a reset scenario.
- Never point tests at production; `allowedHosts` in `eberly/eberly.ts` only
  lists test hosts.
- No `as any` for error statuses: `assert` already accepts them.

## Cheat sheet

```ts
import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, test } from 'vitest'
import { World } from '../eberly/generated'

describe('posts', () => {
  const world = new World()            // world.<scenario>() from WorldStore
  const alice = world.createUser()     // isolated user: own vars, own token
  const bob = world.createUser()

  beforeAll(async () => {
    await world.reset()
    await alice.signUp({ email: `alice-${randomUUID()}@example.com`, password: 'secret123' })
    await bob.signUp({ email: `bob-${randomUUID()}@example.com`, password: 'secret123' })
  })

  test('non-author gets 403 on delete', async () => {
    const created = await alice.posts.create({ body: { title: 'Hi', content: 'x' } })
    const id = created.assert(201, { title: 'Hi' }).body.id // body narrowed to the 201 type
    const res = await bob.posts.remove({ path: { id: String(id) } }) // path params are strings
    res.assert(403, { message: 'Only the author can do this' })
  })
})
```

- Call shape: `user.<group>.<method>({ path?, query?, body? })`.
- `assert(status, body?)`: status must match exactly; body is deep-partial
  (only given fields are compared; arrays compare by index from 0).
  Returns the response, so `.assert(200).body` is typed. Status from a
  variable needs `as const`: `for (const s of [401, 403] as const) res.assert(s)`.
- Raw access without asserting: `res.status`, `res.body`.
- Store vars: `alice.get({ key: 'lastPostId' })` / `alice.set({ key, value })`;
  inside store methods `this.get` / `this.set`, endpoints via `this.api.<group>.<method>`.
- File upload: where the md shows `FileInput`, pass a path, a file URL
  (`new URL('./fixtures/a.png', import.meta.url)`), `{ content, name }` or a `Blob`.
- Per-user extra headers: `world.createUser({ headers: { 'x-tenant': 't1' } })`.

Hooks (`eberly/hooks.ts`, `ctx` is the store of the user who made the request):

```ts
export const hooks: Hooks<UserStore> = (h) => {
  h.globalBefore(({ request, ctx }) => {               // every request
    const token = ctx.get({ key: 'accessToken' })
    if (token) request.headers.Authorization = `Bearer ${token}`
  })
  h.posts.create.after(({ response, ctx }) => {        // one endpoint
    if (response.status === 201) ctx.set({ key: 'lastPostId', value: response.body.id })
  })
  h.globalRetry(async ({ request, response, ctx }) => { // return true → request is replayed
    if (response.status !== 401 || request.path.startsWith('/auth/')) return false
    await ctx.refresh()
    return true                                          // capped by maxRetries (default 3)
  })
}
```

After-hooks see every status, but `response.body` is typed as the success
body: always check `response.status` first.
