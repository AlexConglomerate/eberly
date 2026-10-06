// Runs before `astro build`: generates the client from the playground's
// example spec and type-checks the example test, the same way the browser
// does. A broken example breaks the build (and the deploy).
//
// Files go to node_modules/.cache/eberly-playground/ inside site/, so the
// generated `import … from "eberly"` resolves to the workspace package.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import { compilerOptions } from '../src/playground/compilerOptions'

// The library root is a CommonJS package: tsx loads `src/` as CJS, and from
// this ESM script its named exports arrive under `default`.
async function load<T>(args: { module: Promise<T> }): Promise<T> {
  const loaded = (await args.module) as T & { default?: T }
  return loaded.default ?? loaded
}
const { buildClient } = await load({ module: import('../../src/generator/pipeline') })
const { parseSpecText } = await load({ module: import('../../src/generator/parse') })

const site = join(dirname(fileURLToPath(import.meta.url)), '..')
const example = join(site, 'src/playground/example')
const out = join(site, 'node_modules/.cache/eberly-playground')

const read = (name: string) => readFile(join(example, name), 'utf8')

const spec = await parseSpecText({ text: await read('example.yaml'), source: 'example.yaml' })
const { source, operations } = buildClient({ spec, mode: 'test', userStoreImport: 'eberly', configImport: './eberly' })

const files: Record<string, string> = {
  'eberly/generated.ts': source,
  'eberly/eberly.ts': await read('eberly.ts'),
  'tests/example.test.ts': await read('example.test.ts'),
  'vitest.d.ts': await read('vitest.d.ts'),
}

await rm(out, { recursive: true, force: true })
for (const [name, text] of Object.entries(files)) {
  await mkdir(dirname(join(out, name)), { recursive: true })
  await writeFile(join(out, name), text, 'utf8')
}

const program = ts.createProgram({
  rootNames: Object.keys(files).map((name) => join(out, name)),
  options: compilerOptions as unknown as ts.CompilerOptions,
})
const diagnostics = ts.getPreEmitDiagnostics(program)

if (diagnostics.length > 0) {
  const host: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => out,
    getNewLine: () => '\n',
  }
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host))
  console.error(`check-playground: the playground example does not type-check (${diagnostics.length} errors).`)
  process.exit(1)
}

console.log(`check-playground: example spec → ${operations.length} endpoints, example.test.ts type-checks.`)
