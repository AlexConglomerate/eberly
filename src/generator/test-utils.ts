// Хелпер для юнит-тестов генератора: мини-спека в пару строк. Имя файла
// намеренно не подпадает под glob `*.test.ts`.

import type { Json } from './types'

export function makeSpec(args: { openapi?: string; schemas?: Json; paths?: Json } = {}): Json {
  const { openapi = '3.1.0', schemas = {}, paths = {} } = args
  return {
    openapi,
    info: { title: 'T', version: '1' },
    paths,
    components: { schemas },
  }
}
