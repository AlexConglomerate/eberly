import { generateClient } from 'ebely'

await generateClient({
  swagger: { pathToFile: 'swagger.json', },
  generateClientTo: 'ebely/generated.ts',
})