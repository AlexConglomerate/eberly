// Запуск: pnpm run client:generate
// Берёт пути из локального ebely-конфига и зовёт генератор библиотеки.
import { generateClient } from 'ebely'

import { ebely } from '../src/ebely'

const { outPath, operations } = await generateClient({
  swaggerSchema: ebely.forGen.swaggerSchema,
  generateClientTo: ebely.forGen.generateClientTo,
})

console.log(`Typed client written to ${outPath} (${operations} operations)`)
