import { generateClient } from 'ebely'
import { ebely } from './ebely'

await generateClient({
  swaggerSchema: ebely.forGen.swaggerSchema,
  generateClientTo: ebely.forGen.generateClientTo,
})