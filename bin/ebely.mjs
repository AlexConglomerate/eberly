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

async function installSkills({ toUser }) {
  const base = toUser
    ? join(process.env.HOME ?? process.cwd(), '.claude', 'skills')
    : join(process.cwd(), '.claude', 'skills')

  if (!existsSync(skillsSrc)) {
    console.error(`ebely: skills directory not found at ${skillsSrc}`)
    process.exit(1)
  }

  await mkdir(base, { recursive: true })
  const names = await listSkills()

  for (const name of names) {
    const dest = join(base, name)
    await cp(join(skillsSrc, name), dest, { recursive: true })
    console.log(`  ✓ ${name} → ${dest}`)
  }

  console.log(
    `\nГотово. Установлено скиллов: ${names.length}.` +
      `\nОткрой Claude Code в этом проекте и вызови /ebely-setup для первичной настройки.`,
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
  "include": ["ebely", "tests"]
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
  return cleaned || 'ebely-tests'
}

async function createProject({ dir }) {
  const target = resolve(process.cwd(), dir ?? '.')

  if (!existsSync(templateSrc)) {
    console.error(`ebely: шаблон не найден по пути ${templateSrc}`)
    process.exit(1)
  }

  // Существующая непустая папка — отказ, чтобы не затереть чужие файлы.
  if (existsSync(target)) {
    const entries = await readdir(target)
    if (entries.length > 0) {
      console.error(
        `ebely: папка «${target}» не пуста.\n` +
          `Укажи несуществующую или пустую папку, либо очисти эту.`,
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

  // package.json: имя по папке + реальная версия ebely вместо workspace:*.
  const version = await ownVersion()
  const pkgPath = join(target, 'package.json')
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
  pkg.name = toPackageName(basename(target))
  pkg.dependencies = { ...pkg.dependencies, ebely: `^${version}` }
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  // Самодостаточный tsconfig (в шаблоне он расширяет конфиг монорепо).
  await writeFile(join(target, 'tsconfig.json'), STANDALONE_TSCONFIG)

  // Базовый .gitignore.
  await writeFile(join(target, '.gitignore'), 'node_modules\n')

  const shown = dir && dir !== '.' ? dir : '.'
  console.log(
    `\nГотово. Шаблон ebely создан в «${target}».\n\n` +
      `Дальше:\n` +
      (shown === '.' ? '' : `  cd ${shown}\n`) +
      `  pnpm install                 # установить зависимости\n` +
      `  # отредактируй ebely/ebely.ts (url, путь к swagger) под свой бэкенд\n` +
      `  pnpm run client:generate     # сгенерировать типизированный клиент\n` +
      `  pnpm test                    # запустить пример тестов\n`,
  )
}

function help() {
  console.log(`ebely — CLI

Использование:
  npx ebely create [dir]    Склонировать шаблон тест-проекта в папку
                            (без аргумента или «.» — в текущую папку)
  npx ebely skills          Установить скиллы в .claude/skills проекта (рекомендуется)
  npx ebely skills --user   Установить скиллы глобально в ~/.claude/skills
  npx ebely help            Показать эту справку

Скиллы:
  /ebely-setup        первичная настройка библиотеки в проекте
  /ebely-write-tests  написание тестов через ebely`)
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
    console.error(`ebely: неизвестная команда «${cmd}»\n`)
    help()
    process.exit(1)
}
