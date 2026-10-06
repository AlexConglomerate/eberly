import type { EberlyConfig } from 'eberly'
import { generateClient } from 'eberly'

import { hooks } from './hooks'
import { UserStore } from './userStore'
import { WorldStore } from './worldStore'

// #region docs:config
export const eberly = {
  userStore: UserStore, // variables and scenarios of one user (signUp)
  worldStore: WorldStore, // app-level scenarios (reset)

  url: 'http://localhost:3000', // the Nest backend from ../your-app
  swagger: { pathToFile: 'swagger.json' }, // a copy of your-app/swagger/swagger.json
  generateClientTo: 'eberly/generated.ts',
  hooks, // Bearer token + lastPostId (see ./hooks.ts)
  mode: 'test',
} satisfies EberlyConfig
// #endregion

export const generateEberlyClient = async () => {
  await generateClient(eberly)
}
