// Тест ТИПОВ `BaseStore` (не рантайм): проверяет `tsc` (`pnpm lint`).

import { BaseStore } from './base-store'

type Vars = { lastPostId: number }
class UserStore extends BaseStore<Vars> {}
declare const user: UserStore

// `get` — без `undefined`, `getSafe` — с ним.
const id: number = user.get({ key: 'lastPostId' })
// @ts-expect-error — getSafe может вернуть undefined
const maybe: number = user.getSafe({ key: 'lastPostId' })

// Любой стор подходит под голый `BaseStore` (ограничение `World` / `Hooks`).
function accept<S extends BaseStore>(store: S): S {
  return store
}
accept(user)

void id
void maybe
