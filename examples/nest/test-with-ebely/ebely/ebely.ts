import type { EbelyConfig } from 'ebely'
import { generateClient } from 'ebely'

import { hooks } from './hooks'
import { UserStore } from './userStore'
import { WorldStore } from './worldStore'

export const ebely = {
  userStore: UserStore, // переменные и сценарии одного пользователя (signUp)
  worldStore: WorldStore, // сценарии всего приложения (reset)

  url: 'http://localhost:3000', // Nest-бэкенд из ../your-app
  swagger: { pathToFile: 'swagger.json' }, // копия your-app/swagger/swagger.json
  generateClientTo: 'ebely/generated.ts',
  hooks, // Bearer-токен + lastPostId (см. ./hooks.ts)
  mode: 'test',
} satisfies EbelyConfig

export const generateEbelyClient = async () => {
  await generateClient(ebely)
}
