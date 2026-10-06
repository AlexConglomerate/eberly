// Юнит-тесты загрузки схемы: разбор текста (JSON/YAML) и `loadSpec` из
// файла и по URL (fetch подменяется — сети нет).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseSpecText } from './parse'
import { loadSpec } from './swagger'

const SPEC = { openapi: '3.1.0', info: { title: 'Demo', version: '1' }, paths: {} }

const YAML_SPEC = `openapi: 3.1.0
info:
  title: Demo
  version: "1"
paths: {}
`

test('parseSpecText: JSON-текст', async () => {
  assert.deepEqual(await parseSpecText({ text: JSON.stringify(SPEC), source: 'spec.json' }), SPEC)
})

test('parseSpecText: YAML-текст', async () => {
  assert.deepEqual(await parseSpecText({ text: YAML_SPEC, source: 'spec.yaml' }), SPEC)
})

test('parseSpecText: JSON с ведущими пробелами и переводом строки', async () => {
  const text = `\n  \n\t${JSON.stringify(SPEC, null, 2)}\n`
  assert.deepEqual(await parseSpecText({ text, source: 'spec.json' }), SPEC)
})

test('parseSpecText: битый JSON → ошибка с источником', async () => {
  await assert.rejects(
    parseSpecText({ text: '{ "openapi": ', source: 'http://localhost:3000/docs-json' }),
    /^Error: eberly: failed to parse the OpenAPI spec from http:\/\/localhost:3000\/docs-json as JSON or YAML: /,
  )
})

test('parseSpecText: битый YAML → ошибка с источником', async () => {
  await assert.rejects(
    parseSpecText({ text: 'openapi: 3.1.0\n  info: [oops', source: 'spec.yaml' }),
    /failed to parse the OpenAPI spec from spec\.yaml as JSON or YAML: /,
  )
})

test('parseSpecText: YAML-скаляр → та же ошибка', async () => {
  await assert.rejects(
    parseSpecText({ text: 'just a string', source: 'spec.yaml' }),
    /failed to parse the OpenAPI spec from spec\.yaml as JSON or YAML: expected an object, got string/,
  )
})

test('parseSpecText: пустой текст → та же ошибка', async () => {
  await assert.rejects(
    parseSpecText({ text: '  \n', source: 'spec.yml' }),
    /from spec\.yml as JSON or YAML: expected an object, got empty document/,
  )
})

test('parseSpecText: массив → та же ошибка', async () => {
  await assert.rejects(
    parseSpecText({ text: '- a\n- b\n', source: 'spec.yaml' }),
    /expected an object, got array/,
  )
})

test('loadSpec: YAML-файл', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'eberly-spec-'))
  try {
    const file = join(dir, 'openapi.yaml')
    await writeFile(file, YAML_SPEC, 'utf8')
    assert.deepEqual(await loadSpec({ swagger: { pathToFile: file as `${string}.yaml` } }), SPEC)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadSpec: URL без .json, ответ — YAML', async (t) => {
  const urls: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(url)
    return new Response(YAML_SPEC, { headers: { 'content-type': 'text/plain' } })
  })
  assert.deepEqual(await loadSpec({ swagger: { url: 'http://localhost:3000/docs-json' } }), SPEC)
  assert.deepEqual(urls, ['http://localhost:3000/docs-json'])
})

test('loadSpec: URL без .json, ответ не 2xx → ошибка загрузки', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('nope', { status: 404, statusText: 'Not Found' }))
  await assert.rejects(
    loadSpec({ swagger: { url: 'http://localhost:3000/openapi' } }),
    /failed to fetch the swagger spec from http:\/\/localhost:3000\/openapi: 404 Not Found/,
  )
})
