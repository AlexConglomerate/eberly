// Слой «откуда взять swagger-схему».
//
// Тип источника + загрузка. Источник — РОВНО одно из двух: локальный
// файл (`pathToFile`) или HTTP-эндпоинт (`url`). Тип построен так, что
// указать оба поля одновременно нельзя. Разбор текста (JSON или YAML) —
// в parse.ts.

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseSpecText } from './parse'
import type { Json } from './types'

/**
 * Источник swagger/OpenAPI-схемы (JSON или YAML). Указывается ровно одно
 * из полей: либо `pathToFile` (локальный файл), либо `url` (HTTP-эндпоинт).
 */
export type SwaggerSource =
  | {
    /** Путь к файлу схемы (резолвится от process.cwd()): `.json`, `.yaml` или `.yml`. */
    pathToFile: `${string}.json` | `${string}.yaml` | `${string}.yml`
    url?: never
  }
  | {
    /** URL, по которому отдаётся схема, например `http://localhost:3000/docs-json`. */
    url: `http${string}`
    pathToFile?: never
  }

/** Загружает swagger-схему из файла или по URL — в зависимости от источника. */
export async function loadSpec(args: { swagger: SwaggerSource }): Promise<Json> {
  const { swagger } = args

  if (swagger.pathToFile !== undefined) {
    const specPath = resolve(process.cwd(), swagger.pathToFile)
    return parseSpecText({ text: await readFile(specPath, 'utf8'), source: specPath })
  }

  const response = await fetch(swagger.url)
  if (!response.ok) {
    throw new Error(
      `eberly: failed to fetch the swagger spec from ${swagger.url}: ${response.status} ${response.statusText}`,
    )
  }
  return parseSpecText({ text: await response.text(), source: swagger.url })
}
