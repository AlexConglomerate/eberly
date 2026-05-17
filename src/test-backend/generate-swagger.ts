import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { generateOpenAPISpec } from './openapi'

/** Пишет swagger-схему в файл swagger.json рядом с этим скриптом. */
async function main() {
  const spec = await generateOpenAPISpec()
  const outPath = fileURLToPath(new URL('./swagger.json', import.meta.url))
  await writeFile(outPath, JSON.stringify(spec, null, 2) + '\n', 'utf8')
  console.log(`Swagger schema written to ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
