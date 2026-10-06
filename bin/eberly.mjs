#!/usr/bin/env node
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(__dirname, '..')
const skillsSrc = join(pkgRoot, 'skills')
const templateSrc = join(pkgRoot, 'clone', 'tests')

async function listSkills() {
  const entries = await readdir(skillsSrc, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

/** Копирует скиллы пакета в `<base>/<имя>`; возвращает имена. */
async function copySkills({ base }) {
  if (!existsSync(skillsSrc)) {
    console.error(`eberly: skills directory not found at ${skillsSrc}`)
    process.exit(1)
  }

  await mkdir(base, { recursive: true })
  const names = await listSkills()
  for (const name of names) {
    await cp(join(skillsSrc, name), join(base, name), { recursive: true })
  }
  return names
}

async function installSkills({ toUser }) {
  const base = toUser
    ? join(process.env.HOME ?? process.cwd(), '.claude', 'skills')
    : join(process.cwd(), '.claude', 'skills')

  const names = await copySkills({ base })
  for (const name of names) console.log(`  ✓ ${name} → ${join(base, name)}`)

  console.log(
    `\nDone. Skills installed: ${names.length}.` +
      `\nOpen Claude Code in this project and run /eberly-setup for the initial setup.` +
      `\nSkills are copied: run this command again after updating eberly.`,
  )
}

const STANDALONE_TSCONFIG = `{
  "compilerOptions": {
    "target": "es2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["es2022", "dom", "dom.iterable"],
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "allowJs": true,
    "noEmit": true
  },
  "include": ["eberly", "tests"]
}
`

async function ownVersion() {
  const pkg = JSON.parse(await readFile(join(pkgRoot, 'package.json'), 'utf8'))
  return pkg.version
}

/** Имя npm-пакета из имени папки: lowercase, без недопустимых символов. */
function toPackageName(name) {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
  return cleaned || 'eberly-tests'
}

async function createProject({ dir }) {
  const target = resolve(process.cwd(), dir ?? '.')

  if (!existsSync(templateSrc)) {
    console.error(`eberly: template not found at ${templateSrc}`)
    process.exit(1)
  }

  // Существующая непустая папка — отказ, чтобы не затереть чужие файлы.
  if (existsSync(target)) {
    const entries = await readdir(target)
    if (entries.length > 0) {
      console.error(
        `eberly: directory "${target}" is not empty.\n` +
          `Pass a new or empty directory, or clear this one.`,
      )
      process.exit(1)
    }
  } else {
    await mkdir(target, { recursive: true })
  }

  // Копируем шаблон целиком, кроме node_modules.
  // Важно: фильтруем по пути ОТНОСИТЕЛЬНО шаблона, а не по абсолютному —
  // иначе при установке через npx/npm весь путь пакета лежит внутри
  // node_modules, фильтр отбрасывает корень шаблона и не копируется ничего.
  await cp(templateSrc, target, {
    recursive: true,
    filter: (src) =>
      !relative(templateSrc, src).split(sep).includes('node_modules'),
  })

  // package.json: имя по папке + реальная версия eberly вместо workspace:*.
  const version = await ownVersion()
  const pkgPath = join(target, 'package.json')
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
  pkg.name = toPackageName(basename(target))
  pkg.dependencies = { ...pkg.dependencies, eberly: `^${version}` }
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  // Самодостаточный tsconfig (в шаблоне он расширяет конфиг монорепо).
  await writeFile(join(target, 'tsconfig.json'), STANDALONE_TSCONFIG)

  // Базовый .gitignore.
  await writeFile(join(target, '.gitignore'), 'node_modules\n')

  // Скиллы для Claude Code — сразу в проект, отдельный `npx eberly skills` не нужен.
  await copySkills({ base: join(target, '.claude', 'skills') })

  const shown = dir && dir !== '.' ? dir : '.'
  console.log(
    `\nDone. eberly template created in "${target}".\n\n` +
      `Next, with Claude Code:\n` +
      (shown === '.' ? '' : `  cd ${shown}\n`) +
      `  claude                       # open Claude Code here\n` +
      `  /eberly-setup                 # answer a few questions → green smoke tests\n` +
      `  /eberly-write-tests <scenario> # e.g. "Bob cannot delete Alice's post"\n\n` +
      `Or by hand:\n` +
      `  pnpm install\n` +
      `  # edit eberly/eberly.ts (url, swagger path) for your backend\n` +
      `  pnpm run client:generate     # generate the typed client\n` +
      `  pnpm typecheck && pnpm test\n\n` +
      `Docs: https://eberly.dev/getting-started/\n`,
  )
}

function help() {
  console.log(`eberly — CLI

Usage:
  npx eberly create [dir]    Copy the test project template (with Claude Code skills
                            in .claude/skills) into a directory
                            (no argument or "." means the current directory)
  npx eberly skills          Install or update skills in the project's .claude/skills
                            (for existing projects; run again after updating eberly)
  npx eberly skills --user   Install skills globally into ~/.claude/skills
  npx eberly help            Show this help

Skills:
  /eberly-setup        initial setup of the library in a project
  /eberly-write-tests  writing tests with eberly`)
}

const [cmd, ...rest] = process.argv.slice(2)

switch (cmd) {
  case 'create':
    await createProject({ dir: rest.find((a) => !a.startsWith('-')) })
    break
  case 'skills':
    await installSkills({ toUser: rest.includes('--user') })
    break
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    help()
    break
  default:
    console.error(`eberly: unknown command "${cmd}"\n`)
    help()
    process.exit(1)
}
