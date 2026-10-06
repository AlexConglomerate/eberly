// Публичная точка входа генератора. Это «оркестратор»: он ничего не
// делает сам, а только связывает шаги —
//
//   swagger.ts   → загрузить схему                       (loadSpec)
//   pipeline.ts  → схема → исходник клиента + папка api/  (buildClient)
//
// и пишет результат на диск. Сама логика разбора живёт в src/generator/*.

import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import type { EberlyConfig } from './config'
import { DOCS_MARKER } from './generator/docs'
import { buildClient } from './generator/pipeline'
import { loadSpec } from './generator/swagger'
import type { Json } from './generator/types'

// Реэкспорт, чтобы публичный API (index.ts) и config.ts видели тип
// источника схемы как часть generate-client, не зная про устройство папки.
export type { SwaggerSource } from './generator/swagger'

/**
 * Читает swagger-схему и пишет типизированный клиент `World` в файл.
 * Это публичная точка входа библиотеки: пользователь вызывает её из
 * своего проекта, передавая собственный eberly-конфиг.
 */
export async function generateClient(
  args: EberlyConfig,
): Promise<{ outPath: string; operations: number; docsDir: string }> {
  const {
    swagger,
    generateClientTo,
    mode = 'test',
    userStoreImport = 'eberly',
    configImport = './eberly',
  } = args

  const outPath = resolve(process.cwd(), generateClientTo)

  const spec: Json = await loadSpec({ swagger })
  const { source, operations, docs } = buildClient({ spec, mode, userStoreImport, configImport })

  await writeFile(outPath, source, 'utf8')

  const docsDir = join(dirname(outPath), 'api')
  await writeEndpointDocs({ dir: docsDir, files: docs })

  console.log(`
✅ Typed client written to:
${outPath}

Endpoints: ${operations.length}
Endpoint docs: ${relative(process.cwd(), docsDir)} (${docs.length} files)
`)
  return { outPath, operations: operations.length, docsDir }
}

/**
 * Пишет папку `api/`. Сначала удаляет устаревшие файлы — но ТОЛЬКО `.md`,
 * первая строка которых — `DOCS_MARKER`: при `generateClientTo:
 * 'src/generated.ts'` папка `src/api/` может оказаться кодом пользователя,
 * поэтому никакого `rm -rf`.
 */
export async function writeEndpointDocs(args: {
  dir: string
  files: { fileName: string; content: string }[]
}): Promise<void> {
  const { dir, files } = args
  await mkdir(dir, { recursive: true })

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const path = join(dir, entry.name)
    const firstLine = (await readFile(path, 'utf8')).split('\n', 1)[0]?.trimEnd()
    if (firstLine === DOCS_MARKER) await unlink(path)
  }

  for (const { fileName, content } of files) {
    await writeFile(join(dir, fileName), content, 'utf8')
  }
}
