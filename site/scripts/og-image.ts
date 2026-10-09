// Draws the link preview (`og:image`) into `public/og.png`: 1200×630, the
// name, the tagline and the landing's hero snippet (`docs:readme-hero`).
// Run by hand (`pnpm --filter @eberly-site/site run og:image`), the PNG is
// committed: the text is rendered with the local system fonts, so the result
// depends on the machine and must not change from build to build.

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { snippet } from '../src/lib/snippet'

const site = join(dirname(fileURLToPath(import.meta.url)), '..')
const readmeTest = await readFile(
  join(site, '../examples/nest/test-with-eberly/tests/readme.test.ts'),
  'utf8',
)
const code = snippet({ source: readmeTest, region: 'readme-hero' })

const WIDTH = 1200
const HEIGHT = 630

// The accent colors from `src/styles/custom.css` (dark theme).
const ACCENT = 'hsl(160, 84%, 36%)'
const ACCENT_HIGH = 'hsl(160, 70%, 80%)'
const ACCENT_LOW = 'hsl(160, 60%, 14%)'

const SANS = "'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const MONO = "'SF Mono', Menlo, Consolas, monospace"

const COLORS = {
  plain: '#e6edf3',
  comment: '#7d8590',
  string: '#a5d6ff',
  keyword: '#ff7b72',
  number: '#79c0ff',
  call: '#d2a8ff',
}

type Token = { text: string; color: string }

const TOKEN =
  /(\/\/.*$)|('[^']*')|\b(const|await|new)\b|\b(\d+)\b|([A-Za-z_$][\w$]*)(?=\()|([\s\S])/g

/** Very small TS highlighter: enough for one known snippet. */
function highlight({ line }: { line: string }): Token[] {
  const tokens: Token[] = []
  for (const [text, comment, string, keyword, number, call] of line.matchAll(TOKEN)) {
    const color = comment
      ? COLORS.comment
      : string
        ? COLORS.string
        : keyword
          ? COLORS.keyword
          : number
            ? COLORS.number
            : call
              ? COLORS.call
              : COLORS.plain
    const last = tokens.at(-1)
    if (last && last.color === color) last.text += text
    else tokens.push({ text, color })
  }
  return tokens
}

function escapeXml({ text }: { text: string }): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const CODE_X = 520
const CODE_Y = 96
const CODE_SIZE = 17
const CODE_LINE = 30
const lines = code.split('\n')
const cardHeight = lines.length * CODE_LINE + 64

const codeText = lines
  .map((line, i) => {
    const spans = highlight({ line })
      .map((token) => `<tspan fill="${token.color}">${escapeXml({ text: token.text })}</tspan>`)
      .join('')
    return `<text x="${CODE_X + 32}" y="${CODE_Y + 44 + i * CODE_LINE}" xml:space="preserve">${spans}</text>`
  })
  .join('\n')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(160 80) scale(760 560)">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#17181c"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>

  <g font-family="${SANS}">
    <rect x="64" y="96" width="72" height="72" rx="16" fill="hsl(160, 84%, 30%)"/>
    <text x="100" y="149" font-size="50" font-weight="700" fill="#fff" text-anchor="middle">e</text>
    <text x="156" y="152" font-size="64" font-weight="700" fill="#fff">eberly</text>

    <text font-size="34" font-weight="600" fill="#fff">
      <tspan x="64" y="250">Typed end-to-end</tspan>
      <tspan x="64" y="294">API tests for any</tspan>
      <tspan x="64" y="338">backend with an</tspan>
      <tspan x="64" y="382">OpenAPI 3 spec.</tspan>
    </text>
    <text x="64" y="432" font-size="22" fill="${ACCENT_HIGH}">Written by you or your AI agent.</text>

    <rect x="64" y="490" width="236" height="48" rx="10" fill="${ACCENT_LOW}" stroke="${ACCENT}"/>
    <text x="84" y="521" font-family="${MONO}" font-size="19" fill="#e6edf3">npm i -D eberly</text>
    <text x="64" y="580" font-size="22" font-weight="600" fill="#9ca3af">eberly.dev</text>
  </g>

  <rect x="${CODE_X}" y="${CODE_Y}" width="${WIDTH - CODE_X - 64}" height="${cardHeight}" rx="14"
    fill="#0d1117" stroke="#30363d"/>
  <g font-family="${MONO}" font-size="${CODE_SIZE}">
${codeText}
  </g>
</svg>`

const out = join(site, 'public/og.png')
await sharp(Buffer.from(svg)).png().toFile(out)
console.log(`Wrote ${out}`)
