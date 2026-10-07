// Runs after `astro build`: the playground must ship Monaco's stylesheet.
// Without it the editor still works in `astro dev` (Vite injects the CSS
// from JS), but in production it breaks quietly: a stray textarea on top,
// hovers without a background, the cursor stuck at the start of the file.

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist/_astro')
const files = await readdir(assets)

const read = (name: string) => readFile(join(assets, name), 'utf8')

const cssFiles: string[] = []
for (const name of files.filter((file) => file.endsWith('.css'))) {
  if ((await read(name)).includes('.monaco-editor .inputarea')) cssFiles.push(name)
}

let linked = false
for (const name of files.filter((file) => file.endsWith('.js'))) {
  const source = await read(name)
  if (cssFiles.some((css) => source.includes(css))) linked = true
}

if (cssFiles.length === 0 || !linked) {
  console.error(
    cssFiles.length === 0
      ? 'site/dist/_astro has no Monaco stylesheet: the playground editor would render broken.'
      : `Monaco stylesheet ${cssFiles.join(', ')} is built, but no script loads it.`,
  )
  process.exit(1)
}
console.log(`Playground: Monaco stylesheet ${cssFiles.join(', ')} is built and linked.`)
