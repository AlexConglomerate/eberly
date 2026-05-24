#!/usr/bin/env node
import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(__dirname, '..')
const skillsSrc = join(pkgRoot, 'skills')

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

function help() {
  console.log(`ebely — CLI

Использование:
  npx ebely skills          Установить скиллы в .claude/skills проекта (рекомендуется)
  npx ebely skills --user   Установить скиллы глобально в ~/.claude/skills
  npx ebely help            Показать эту справку

Скиллы:
  /ebely-setup        первичная настройка библиотеки в проекте
  /ebely-write-tests  написание тестов через ebely`)
}

const [cmd, ...rest] = process.argv.slice(2)

switch (cmd) {
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
