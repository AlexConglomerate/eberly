import type { EberlyConfig } from 'eberly'
import { generateClient } from 'eberly'

import { hooks } from './hooks'
import { UserStore } from './userStore'
import { WorldStore } from './worldStore'

export const eberly = {
  userStore: UserStore,
  worldStore: WorldStore,

  url: 'http://localhost:3000',
  swagger: { pathToFile: 'swagger.json' },
  generateClientTo: 'eberly/generated.ts',
  hooks,
  mode: 'test',
} satisfies EberlyConfig

export const generateEberlyClient = async () => {
  await generateClient(eberly)
}
