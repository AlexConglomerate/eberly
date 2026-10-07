// Monaco for the playground: editor + TypeScript worker from the npm package
// (no CDN), and the virtual project the test is type-checked in:
//
//   file:///node_modules/eberly/index.d.ts  ← dist/index.d.ts (extra lib)
//   file:///node_modules/zod/**/*.d.ts      ← zod's own types (extra libs)
//   file:///vitest.d.ts                     ← a tiny `vitest` shim (extra lib)
//   file:///eberly/eberly.ts                ← the config (hidden model)
//   file:///eberly/generated.ts             ← buildClient(...).source
//   file:///tests/example.test.ts           ← the test the user edits
//   file:///openapi.yaml                    ← the spec the user edits
//
// Loaded lazily by Playground.tsx: the landing page does not wait for it.

import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker'

import eberlyDts from '../../../dist/index.d.ts?raw'
import { compilerOptions } from './compilerOptions'
import eberlyConfig from './example/eberly.ts?raw'
import exampleTest from './example/example.test.ts?raw'
import exampleSpec from './example/example.yaml?raw'
import vitestDts from './example/vitest.d.ts?raw'

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'typescript' || label === 'javascript') return new TsWorker()
    if (label === 'json') return new JsonWorker()
    return new EditorWorker()
  },
}
loader.config({ monaco })

const ts = monaco.typescript.typescriptDefaults
ts.setCompilerOptions(compilerOptions as monaco.typescript.CompilerOptions)
// Check models that are not open in an editor too (eberly.ts, generated.ts).
ts.setEagerModelSync(true)
ts.addExtraLib(eberlyDts, 'file:///node_modules/eberly/index.d.ts')
ts.addExtraLib(vitestDts, 'file:///vitest.d.ts')

// The real zod types, so any schema type-checks, not only the one in the
// example. Only what `import { z } from 'zod'` reaches (v4 classic).
const zodDts = import.meta.glob<string>(
  ['/node_modules/zod/index.d.ts', '/node_modules/zod/v4/{classic,core,locales}/*.d.ts'],
  { query: '?raw', import: 'default', eager: true },
)
for (const [path, source] of Object.entries(zodDts)) ts.addExtraLib(source, `file://${path}`)

export const example = { spec: exampleSpec, test: exampleTest }

export const paths = {
  spec: 'file:///openapi.yaml',
  test: 'file:///tests/example.test.ts',
  generated: 'file:///eberly/generated.ts',
} as const

function model(args: { path: string; value: string; language: string }): monaco.editor.ITextModel {
  const uri = monaco.Uri.parse(args.path)
  return monaco.editor.getModel(uri) ?? monaco.editor.createModel(args.value, args.language, uri)
}

export const models = {
  spec: model({ path: paths.spec, value: exampleSpec, language: 'yaml' }),
  test: model({ path: paths.test, value: exampleTest, language: 'typescript' }),
  generated: model({ path: paths.generated, value: '', language: 'typescript' }),
  config: model({ path: 'file:///eberly/eberly.ts', value: eberlyConfig, language: 'typescript' }),
}

let revision = 0

/**
 * Puts a new client into generated.ts and re-checks the test. Monaco only
 * re-checks a model when its own text changes; an extra-lib change makes it
 * re-check every model (without restarting the worker, unlike compiler options).
 */
export function setGeneratedSource({ source }: { source: string }): void {
  models.generated.setValue(source)
  ts.addExtraLib(`// revision ${++revision}`, 'file:///playground-revision.d.ts')
}

/**
 * Type errors in the test file, asked from the TS worker directly: marker
 * events do not fire when a file goes from "not checked" to "no errors".
 */
export async function countTestErrors(): Promise<number> {
  const getWorker = await monaco.typescript.getTypeScriptWorker()
  const worker = await getWorker(models.test.uri)
  const file = models.test.uri.toString()
  const diagnostics = [
    ...(await worker.getSyntacticDiagnostics(file)),
    ...(await worker.getSemanticDiagnostics(file)),
  ]
  return diagnostics.filter((d) => d.category === 1 /* Error */).length
}

export { monaco }
