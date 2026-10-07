// Runs before `astro build`: generates the client from the playground's
// example spec and type-checks the example test, the same way the browser
// does. A broken example breaks the build (and the deploy). The test must
// also contain the landing's hero snippet (`docs:readme-hero`) as is: the
// "Edit in the playground" button under it promises the same code.
//
// Files go to node_modules/.cache/eberly-playground/ inside site/, so the
// generated `import … from "eberly"` resolves to the workspace package.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import { snippet } from '../src/lib/snippet'
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

// Indentation differs (the region sits inside `describe`), so lines are
// compared trimmed.
const readmeTest = await readFile(join(site, '../examples/nest/test-with-eberly/tests/readme.test.ts'), 'utf8')
const trimLines = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).join('\n')
const hero = snippet({ source: readmeTest, region: 'readme-hero' })
if (!trimLines(await read('example.test.ts')).includes(trimLines(hero))) {
  console.error(
    'check-playground: example.test.ts must contain the `docs:readme-hero` region of ' +
      'examples/nest/test-with-eberly/tests/readme.test.ts line for line:\n\n' +
      hero,
  )
  process.exit(1)
}

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

console.log(`check-playground: example spec → ${operations.length} endpoints, example.test.ts type-checks and matches the hero snippet.`)
