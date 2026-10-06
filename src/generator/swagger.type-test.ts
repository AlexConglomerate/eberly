// Тест ТИПОВ `SwaggerSource` (не рантайм): его проверяет `tsc` (`pnpm lint`).
// Если ожидаемая ошибка пропадёт, `tsc` скажет «Unused '@ts-expect-error'».

import type { SwaggerSource } from './swagger'

const sources: SwaggerSource[] = [
  { pathToFile: 'swagger.json' },
  { pathToFile: 'openapi.yaml' },
  { pathToFile: 'specs/openapi.yml' },
  { url: 'http://localhost:3000/swagger.json' },
  { url: 'http://localhost:3000/docs-json' },
  { url: 'https://api.example.com/v3/api-docs' },
  // @ts-expect-error — расширение не .json / .yaml / .yml (опечатка)
  { pathToFile: 'swagger.txt' },
  // @ts-expect-error — не http(s)-URL
  { url: 'ftp://example.com/swagger.json' },
  // @ts-expect-error — оба источника сразу
  { pathToFile: 'swagger.json', url: 'http://localhost:3000/docs-json' },
]
void sources
