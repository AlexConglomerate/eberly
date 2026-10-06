import type { EberlyConfig } from 'eberly'
import { generateClient } from 'eberly'

import { hooks } from './hooks'
import { UserStore } from './userStore'
import { WorldStore } from './worldStore'

export const eberly = {
  userStore: UserStore, // переменные и сценарии одного пользователя (signUp)
  worldStore: WorldStore, // сценарии всего приложения (reset)

  url: 'http://localhost:3000', // Nest-бэкенд из ../your-app
  swagger: { pathToFile: 'swagger.json' }, // копия your-app/swagger/swagger.json
  generateClientTo: 'eberly/generated.ts',
  hooks, // Bearer-токен + lastPostId (см. ./hooks.ts)
  mode: 'test',
} satisfies EberlyConfig

export const generateEberlyClient = async () => {
  await generateClient(eberly)
}
