import { generateClient } from 'ebely'
import { ebely } from './ebely'

await generateClient({
  swaggerSchema: ebely.swaggerSchema,
  generateClientTo: ebely.generateClientTo,
})