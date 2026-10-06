// The playground's eberly config: the generated client imports it as
// `./eberly`. Hidden in the UI, type-checked by scripts/check-playground.ts.
import { BaseStore, type EberlyConfig } from 'eberly'

import type { WorldApi } from './generated'

export class UserStore extends BaseStore<Record<string, never>, WorldApi> {}

export const eberly = {
  url: 'http://localhost:3000',
  swagger: { pathToFile: 'openapi.yaml' },
  generateClientTo: 'eberly/generated.ts',
  userStore: UserStore,
  mode: 'test',
} satisfies EberlyConfig
