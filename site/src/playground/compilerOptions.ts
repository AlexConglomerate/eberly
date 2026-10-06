// TypeScript options shared by the playground (Monaco's TS worker) and
// scripts/check-playground.ts (tsc API), so a test that is green in the
// build is green in the browser too. Numeric enum values: Monaco and the
// `typescript` package each have their own enum objects, the numbers match.
// Same strictness as the examples (`strict`, `noUncheckedIndexedAccess`).
export const compilerOptions = {
  target: 9, // ES2022
  module: 99, // ESNext
  moduleResolution: 100, // Bundler
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  strict: true,
  noUncheckedIndexedAccess: true,
  verbatimModuleSyntax: true,
  skipLibCheck: true,
  noEmit: true,
  types: [] as string[],
}
