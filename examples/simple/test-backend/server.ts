import { createServer } from 'node:http'

import { OpenAPIHandler } from '@orpc/openapi/node'

import { generateOpenAPISpec } from './openapi'
import { router } from './router'

const PORT = Number(process.env.PORT ?? 3000)

const handler = new OpenAPIHandler(router)

const docsPage = (specUrl: string) => `<!doctype html>
<html>
  <head>
    <title>Test Backend — API docs</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="${specUrl}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

  // Swagger / OpenAPI схема в виде JSON.
  if (url.pathname === '/swagger.json') {
    const spec = await generateOpenAPISpec()
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(spec, null, 2))
    return
  }

  // Документация (Scalar UI).
  if (url.pathname === '/docs') {
    res.setHeader('content-type', 'text/html')
    res.end(docsPage('/swagger.json'))
    return
  }

  // Все эндпоинты живут под префиксом /api.
  const { matched } = await handler.handle(req, res, { prefix: '/api' })
  if (matched) return

  res.statusCode = 404
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`Test backend listening on http://localhost:${PORT}`)
  console.log(`  API:     http://localhost:${PORT}/api/posts`)
  console.log(`  Swagger: http://localhost:${PORT}/swagger.json`)
  console.log(`  Docs:    http://localhost:${PORT}/docs`)
})
