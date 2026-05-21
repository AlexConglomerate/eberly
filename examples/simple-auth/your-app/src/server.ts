import { createServer } from 'node:http'
import type { IncomingMessage } from 'node:http'

import { OpenAPIHandler } from '@orpc/openapi/node'

import { generateOpenAPISpec } from '../swagger/openapi'
import { PORT } from './config'
import { initDatabase } from './db'
import { handleFakeGoogle } from './fake-google'
import { router } from './router'

function toFetchHeaders(req: IncomingMessage): Headers {
  const h = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) {
      for (const item of v) h.append(k, item)
    } else if (v !== undefined) {
      h.set(k, String(v))
    }
  }
  return h
}

const handler = new OpenAPIHandler(router)

const docsPage = (specUrl: string) => `<!doctype html>
<html>
  <head>
    <title>Auth Backend — API docs</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="${specUrl}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`

async function main() {
  await initDatabase()

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

    // Фейковый Google IdP — поднимаем на ТОМ ЖЕ HTTP-сервере, чтобы
    // BetterAuth мог сходить к нему по обычному fetch (token, userinfo).
    if (url.pathname.startsWith('/fake-google/')) {
      const matched = await handleFakeGoogle({ req, res, url })
      if (matched) return
    }

    if (url.pathname === '/swagger.json') {
      const spec = await generateOpenAPISpec()
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(spec, null, 2))
      return
    }

    if (url.pathname === '/docs') {
      res.setHeader('content-type', 'text/html')
      res.end(docsPage('/swagger.json'))
      return
    }

    const context = { headers: toFetchHeaders(req) }
    const { matched } = await handler.handle(req, res, { prefix: '/api', context })
    if (matched) return

    res.statusCode = 404
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'Not found' }))
  })

  server.listen(PORT, () => {
    console.log(`Auth backend listening on http://localhost:${PORT}`)
    console.log(`  API:     http://localhost:${PORT}/api/posts`)
    console.log(`  Swagger: http://localhost:${PORT}/swagger.json`)
    console.log(`  Docs:    http://localhost:${PORT}/docs`)
    console.log(`  Fake IdP: http://localhost:${PORT}/fake-google/authorize`)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
