// Собирает шаблон для `npx ebely create` (`clone/tests`) из примера
// `examples/simple/test-with-ebely`. Шаблон руками не правится и не
// коммитится (`clone/` в .gitignore): любая правка примера попадает в него
// сама. Запускается в `prepublishOnly` и в начале `pnpm e2e`.

import { cp, rm } from 'node:fs/promises'
import { relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE = fileURLToPath(new URL('../examples/simple/test-with-ebely', import.meta.url))
const TARGET = fileURLToPath(new URL('../clone/tests', import.meta.url))

/** Пути относительно примера, которые в шаблон не берём. */
const SKIP = new Set(['tests/draw.ts']) // закомментированный эскиз API

function shouldCopy(src: string): boolean {
  const parts = relative(SOURCE, src).split(sep)
  return !parts.includes('node_modules') && !SKIP.has(parts.join('/'))
}

// Корневой package.json — CJS, а top-level await в CJS tsx не умеет.
async function main(): Promise<void> {
  await rm(TARGET, { recursive: true, force: true })
  await cp(SOURCE, TARGET, { recursive: true, filter: shouldCopy })
  console.log(`Template synced: ${relative(process.cwd(), SOURCE)} → ${relative(process.cwd(), TARGET)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
