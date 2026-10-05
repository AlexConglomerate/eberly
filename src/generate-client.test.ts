// Юнит-тест записи папки `api/`: очистка по маркеру на временной папке.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeEndpointDocs } from './generate-client'
import { DOCS_MARKER } from './generator/docs'

test('writeEndpointDocs: удаляет только файлы с маркером, чужие не трогает', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ebely-docs-'))
  try {
    await writeFile(join(dir, 'posts.old.md'), `${DOCS_MARKER}\n# old\n`)
    await writeFile(join(dir, 'notes.md'), '# my notes\n')
    await writeFile(join(dir, 'client.ts'), `// ${DOCS_MARKER}\n`)

    await writeEndpointDocs({ dir, files: [{ fileName: 'INDEX.md', content: `${DOCS_MARKER}\n# API index\n` }] })

    assert.deepEqual((await readdir(dir)).sort(), ['INDEX.md', 'client.ts', 'notes.md'])
    assert.equal(await readFile(join(dir, 'notes.md'), 'utf8'), '# my notes\n')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('writeEndpointDocs: создаёт папку, если её нет', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ebely-docs-'))
  try {
    const dir = join(root, 'api')
    await writeEndpointDocs({ dir, files: [{ fileName: 'INDEX.md', content: 'x' }] })
    assert.deepEqual(await readdir(dir), ['INDEX.md'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
