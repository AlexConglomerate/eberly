// Запуск: pnpm run client:generate
// Берёт пути из локального evely-конфига и зовёт генератор библиотеки.
import { generateClient } from 'ebely'

import { evely } from '../src/evely'

const { outPath, operations } = await generateClient({
  swaggerSchema: evely.forGen.swaggerSchema,
  generateClientTo: evely.forGen.generateClientTo,
})

console.log(`Typed client written to ${outPath} (${operations} operations)`)
