// Just enough of vitest for the playground test to type-check: the
// playground has no test runner, only the TypeScript checker.
declare module 'vitest' {
  export function describe(name: string, fn: () => void): void
  export function test(name: string, fn: () => Promise<void> | void): void
  export const expect: {
    any(constructor: unknown): any
  }
}
