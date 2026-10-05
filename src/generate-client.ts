// Публичная точка входа генератора. Это «оркестратор»: он ничего не
// делает сам, а только связывает шаги конвейера —
//
//   swagger.ts   → загрузить схему        (loadSpec)
//   version.ts   → проверить версию        (assertSupportedVersion)
//   names.ts     → имена типов для схем    (buildSchemaNames)
//   operations.ts→ разобрать paths         (collectOperations)
//   render.ts    → отрендерить файл        (renderClient)
//
// и пишет результат на диск. Сама логика разбора живёт в src/generator/*.

import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { EbelyConfig } from './config'
import { buildSchemaNames } from './generator/names'
import { collectOperations } from './generator/operations'
import { renderClient } from './generator/render'
import { loadSpec } from './generator/swagger'
import type { Json } from './generator/types'
import { assertSupportedVersion } from './generator/version'

// Реэкспорт, чтобы публичный API (index.ts) и config.ts видели тип
// источника схемы как часть generate-client, не зная про устройство папки.
export type { SwaggerSource } from './generator/swagger'

/**
 * Читает swagger-схему и пишет типизированный клиент `World` в файл.
 * Это публичная точка входа библиотеки: пользователь вызывает её из
 * своего проекта, передавая собственный ebely-конфиг.
 */
export async function generateClient(
  args: EbelyConfig,
): Promise<{ outPath: string; operations: number }> {
  const {
    swagger,
    generateClientTo,
    mode = 'test',
    userStoreImport = 'ebely',
    configImport = './ebely',
  } = args

  const outPath = resolve(process.cwd(), generateClientTo)

  const spec: Json = await loadSpec({ swagger })
  assertSupportedVersion({ spec })
  const names = buildSchemaNames({ spec })
  const operations = collectOperations({ spec, names })
  const source = renderClient({
    spec,
    names,
    operations,
    mode,
    userStoreImport,
    configImport,
  })

  await writeFile(outPath, source, 'utf8')
  console.log(`
✅ Typed client written to:
${outPath}

Endpoints: ${operations.length}
`)
  return { outPath, operations: operations.length }
}
