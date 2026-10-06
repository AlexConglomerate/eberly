// Code for the docs comes only from green tests: a file is imported with
// `?raw`, and `snippet` cuts out one region of it:
//
//   // #region docs:<region>
//   …
//   // #endregion
//
// A missing region throws, so the site build fails instead of showing an
// empty block. Nested `#region` / `#endregion` lines are skipped.

const START = /^\s*\/\/ #region\b/
const END = /^\s*\/\/ #endregion\b/

export function snippet({ source, region }: { source: string; region: string }): string {
  const lines = source.split(/\r?\n/)
  const marker = `// #region docs:${region}`
  const starts = lines.flatMap((line, i) => (line.trim() === marker ? [i] : []))

  if (starts.length === 0) throw new Error(`snippet: region "docs:${region}" not found`)
  if (starts.length > 1) throw new Error(`snippet: region "docs:${region}" is defined ${starts.length} times`)

  const body: string[] = []
  let depth = 1
  for (const line of lines.slice(starts[0]! + 1)) {
    if (START.test(line)) {
      depth++
      continue
    }
    if (END.test(line)) {
      depth--
      if (depth > 0) continue
      const code = dedent({ lines: body })
      if (code === '') throw new Error(`snippet: region "docs:${region}" is empty`)
      return code
    }
    body.push(line)
  }
  throw new Error(`snippet: region "docs:${region}" has no // #endregion`)
}

function dedent({ lines }: { lines: string[] }): string {
  while (lines.length > 0 && lines[0]!.trim() === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop()

  const indents = lines.filter((line) => line.trim() !== '').map((line) => line.match(/^\s*/)![0].length)
  if (indents.length === 0) return ''
  const indent = Math.min(...indents)
  return lines.map((line) => line.slice(indent)).join('\n')
}
