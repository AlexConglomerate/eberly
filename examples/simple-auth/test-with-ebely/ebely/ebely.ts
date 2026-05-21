import type { EbelyConfig } from 'ebely'
import { generateClient } from 'ebely'

import { hooks } from './hooks'
import { UserStore } from './userStore'
import { WorldStore } from './worldStore'

export const ebely = {
  userStore: UserStore,
  worldStore: WorldStore,

  url: 'http://localhost:3000',
  swagger: { pathToFile: 'swagger.json' },
  generateClientTo: 'ebely/generated.ts',
  hooks,
  mode: 'test',
} satisfies EbelyConfig

export const generateEbelyClient = async () => {
  await generateClient(ebely)
}
