// Чистый конвейер генератора: объект схемы → исходник клиента + папка api/.
// Без IO и без `node:`-импортов — его вызывают и `generateClient` (который
// потом пишет файлы), и плейграунд на сайте (в браузере).
//
//   version.ts    → проверить версию       (assertSupportedVersion)
//   names.ts      → имена типов для схем   (buildSchemaNames)
//   operations.ts → разобрать paths        (collectOperations)
//   render.ts     → отрендерить файл       (renderClient)
//   docs.ts       → папка api/ для агента  (renderEndpointDocs)

import type { ClientMode } from '../config'
import { renderEndpointDocs } from './docs'
import { buildSchemaNames } from './names'
import { collectOperations, type Operation } from './operations'
import { renderClient } from './render'
import type { Json } from './types'
import { assertSupportedVersion } from './version'

export type BuiltClient = {
  /** Текст `generated.ts`. */
  source: string
  /** Разобранные эндпоинты. */
  operations: Operation[]
  /** Файлы папки `api/`: `INDEX.md` и по файлу на эндпоинт. */
  docs: { fileName: string; content: string }[]
}

/** Строит клиент из уже разобранной схемы. Неподдерживаемая версия — ошибка. */
export function buildClient(args: {
  spec: Json
  mode: ClientMode
  userStoreImport: string
  configImport: string
}): BuiltClient {
  const { spec, mode, userStoreImport, configImport } = args

  assertSupportedVersion({ spec })
  const names = buildSchemaNames({ spec })
  const operations = collectOperations({ spec, names })
  const source = renderClient({ spec, names, operations, mode, userStoreImport, configImport })
  const docs = renderEndpointDocs({ spec, operations, names, mode })

  return { source, operations, docs }
}
