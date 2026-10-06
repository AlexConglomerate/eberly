// `pnpm stackblitz` — стартовая команда StackBlitz (`.stackblitzrc`), но
// работает и локально (порт :3000 должен быть свободен).
//
// Собирает библиотеку, поднимает Nest-пример с `TEST_MODE=1`, берёт
// свагер у живого бэкенда (правка DTO + перезапуск команды → новый
// клиент), генерирует клиент и запускает vitest в watch-режиме: правка
// теста перезапускает его. Ctrl+C гасит и vitest, и бэкенд.
//
// Без process group (`detached`), как в `e2e.ts`: в WebContainers их нет.
// Поэтому бэкенд — сразу `node dist/main.js`, без `pnpm start` посредине,
// и убивать нужно один процесс.

import { type ChildProcess, spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const APP_DIR = join(ROOT, 'examples', 'nest', 'your-app')
const TEST_DIR = join(ROOT, 'examples', 'nest', 'test-with-eberly')
const PORT = 3000
const BACKEND_URL = `http://localhost:${PORT}`
const READY_TIMEOUT_MS = 60_000

let backend: ChildProcess | undefined

function step({ title }: { title: string }): void {
  console.log(`\n▶ ${title}`)
}

/** Запустить команду с общим терминалом. Не 0 → reject. */
function run({ cmd, args, cwd, env = {} }: {
  cmd: string
  args: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`\`${cmd} ${args.join(' ')}\` exited with ${signal ?? code}`))
    })
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Ждать ответа бэкенда. Он упал или таймаут → ошибка. */
async function waitForBackend({ child }: { child: ChildProcess }): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`the backend exited with ${child.signalCode ?? child.exitCode} before it was ready`)
    }
    try {
      await fetch(BACKEND_URL, { signal: AbortSignal.timeout(1_000) })
      return
    } catch {
      await delay(300)
    }
  }
  throw new Error(`the backend did not respond on ${BACKEND_URL} within ${READY_TIMEOUT_MS / 1000}s`)
}

/**
 * Свагер — у живого бэкенда, в том же формате, что пишет `pnpm swagger`
 * (без правок DTO файл не меняется).
 */
async function saveSwagger(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/swagger.json`)
  if (!response.ok) throw new Error(`GET /swagger.json responded with ${response.status}`)
  const document: unknown = await response.json()
  await writeFile(join(TEST_DIR, 'swagger.json'), `${JSON.stringify(document, null, 2)}\n`)
}

function stopBackend(): void {
  backend?.kill('SIGTERM')
  backend = undefined
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopBackend()
    process.exit(130)
  })
}

// Корневой package.json — CJS, а top-level await в CJS tsx не умеет.
async function main(): Promise<void> {
  step({ title: 'Building the eberly library' })
  await run({ cmd: 'pnpm', args: ['run', 'build'], cwd: ROOT })

  step({ title: 'Building the Nest backend (examples/nest/your-app)' })
  await run({ cmd: 'pnpm', args: ['run', 'build'], cwd: APP_DIR })

  step({ title: `Starting the backend on ${BACKEND_URL} with TEST_MODE=1` })
  backend = spawn('node', ['dist/main.js'], {
    cwd: APP_DIR,
    env: { ...process.env, PORT: String(PORT), TEST_MODE: '1' },
    stdio: 'inherit',
  })
  await waitForBackend({ child: backend })

  step({ title: 'Generating the client from the live swagger.json' })
  await saveSwagger()
  await run({ cmd: 'pnpm', args: ['run', 'client:generate'], cwd: TEST_DIR })

  step({ title: 'Running the tests in watch mode: edit a test and it reruns' })
  await run({ cmd: 'pnpm', args: ['exec', 'vitest'], cwd: TEST_DIR })
}

main()
  .catch((error) => {
    console.error(`\n✗ ${(error as Error).message}`)
    process.exitCode = 1
  })
  .finally(stopBackend)
