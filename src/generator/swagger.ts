// Слой «откуда взять swagger-схему».
//
// Тип источника + загрузка. Источник — РОВНО одно из двух: локальный
// файл (`pathToFile`) или HTTP-эндпоинт (`url`). Тип построен так, что
// указать оба поля одновременно нельзя.

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Json } from './types'

/**
 * Источник swagger/OpenAPI-схемы. Указывается ровно одно из полей:
 * либо `pathToFile` (локальный файл), либо `url` (HTTP-эндпоинт).
 */
export type SwaggerSource =
  | {
    /** Путь к файлу схемы (резолвится от process.cwd()). */
    pathToFile: `${string}.json`
    url?: never
  }
  | {
    /** URL, по которому отдаётся swagger.json. */
    url: `http${string}.json`
    pathToFile?: never
  }

/** Загружает swagger-схему из файла или по URL — в зависимости от источника. */
export async function loadSpec(args: { swagger: SwaggerSource }): Promise<Json> {
  const { swagger } = args

  if (swagger.pathToFile !== undefined) {
    const specPath = resolve(process.cwd(), swagger.pathToFile)
    return JSON.parse(await readFile(specPath, 'utf8'))
  }

  const response = await fetch(swagger.url)
  if (!response.ok) {
    throw new Error(
      `ebely: failed to fetch the swagger spec from ${swagger.url}: ${response.status} ${response.statusText}`,
    )
  }
  return (await response.json()) as Json
}
