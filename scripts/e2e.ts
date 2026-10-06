// `pnpm e2e` — проверка библиотеки на живых бэкендах из `examples/`.
//
// Собирает библиотеку и шаблон, затем для каждого примера по очереди
// (все бэкенды слушают :3000): свагер → поднять бэкенд → клиент →
// `tsc --noEmit` → vitest. В конце — смоук `npx eberly create` и таблица
// итогов. Код выхода 1 при любом провале.
//
//   pnpm e2e                 все примеры
//   pnpm e2e --only nest     один пример

import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PORT = 3000
const BACKEND_URL = `http://localhost:${PORT}/`
const READY_TIMEOUT_MS = 60_000 // Nest сначала собирается tsc
const STOP_TIMEOUT_MS = 5_000

const EXAMPLES = ['simple', 'simple-auth', 'nest'] as const
type Example = (typeof EXAMPLES)[number]

type Result = { name: string; failedStep?: string }

type Backend = {
  child: ChildProcess
  /** Вывод бэкенда: показываем, только если пример упал. */
  log: string[]
  exited: Promise<void>
}

// Цвета детям, если сами пишем в терминал (через pipe они бы их выключили).
const CHILD_ENV: NodeJS.ProcessEnv = process.stdout.isTTY ? { FORCE_COLOR: '1' } : {}

let currentBackend: Backend | undefined
let interrupted = false

// ── процессы ─────────────────────────────────────────────────────────────

function forEachLine({ stream, onLine }: { stream: NodeJS.ReadableStream | null; onLine: (line: string) => void }) {
  if (stream) createInterface({ input: stream }).on('line', onLine)
}

/** Запустить команду, печатая её вывод с префиксом. Не 0 → reject. */
function run({ cmd, args, cwd, env = {}, prefix }: {
  cmd: string
  args: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  prefix: string
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...CHILD_ENV, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const print = (line: string) => console.log(`${prefix} ${line}`)
    forEachLine({ stream: child.stdout, onLine: print })
    forEachLine({ stream: child.stderr, onLine: print })
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`\`${cmd} ${args.join(' ')}\` exited with ${signal ?? code}`))
    })
  })
}

/**
 * Поднять бэкенд примера отдельной группой процессов (`detached`): `pnpm`
 * → `tsx`/`node` — несколько процессов, убивать надо всю группу. Ещё
 * группа не получает Ctrl+C терминала — его обрабатываем сами.
 */
function startBackend({ cwd }: { cwd: string }): Backend {
  const child = spawn('pnpm', ['run', 'start'], {
    cwd,
    env: { ...process.env, PORT: String(PORT), TEST_MODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  const log: string[] = []
  forEachLine({ stream: child.stdout, onLine: (line) => log.push(line) })
  forEachLine({ stream: child.stderr, onLine: (line) => log.push(line) })
  const exited = new Promise<void>((resolve) => child.on('close', () => resolve()))
  child.on('error', (error) => log.push(`spawn error: ${error.message}`))
  return { child, log, exited }
}

function killGroup({ backend, signal }: { backend: Backend; signal: NodeJS.Signals }): void {
  if (backend.child.pid === undefined) return
  try {
    process.kill(-backend.child.pid, signal)
  } catch {
    // ESRCH: группа уже завершилась.
  }
}

/** SIGTERM группе, через {@link STOP_TIMEOUT_MS} — SIGKILL. */
async function stopBackend({ backend }: { backend: Backend }): Promise<void> {
  killGroup({ backend, signal: 'SIGTERM' })
  const timedOut = await Promise.race([
    backend.exited.then(() => false),
    delay(STOP_TIMEOUT_MS).then(() => true),
  ])
  // Лидер мог выйти раньше детей — добиваем группу в любом случае.
  killGroup({ backend, signal: 'SIGKILL' })
  if (timedOut) await backend.exited
}

// ── порт и готовность ────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function canConnect({ host }: { host: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port: PORT })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  })
}

/** Порт занят, если на него можно подключиться по IPv4 или IPv6. */
async function isPortBusy(): Promise<boolean> {
  const [v4, v6] = await Promise.all([canConnect({ host: '127.0.0.1' }), canConnect({ host: '::1' })])
  return v4 || v6
}

async function waitForPortFree({ timeoutMs }: { timeoutMs: number }): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (await isPortBusy()) {
    if (Date.now() > deadline) return false
    await delay(200)
  }
  return true
}

/** Ждать любого HTTP-ответа. Бэкенд упал или таймаут → ошибка. */
async function waitForHttp({ backend }: { backend: Backend }): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (backend.child.exitCode !== null || backend.child.signalCode !== null) {
      throw new Error(`backend exited with ${backend.child.signalCode ?? backend.child.exitCode} before it was ready`)
    }
    try {
      await fetch(BACKEND_URL, { signal: AbortSignal.timeout(1_000) })
      return
    } catch {
      await delay(300)
    }
  }
  throw new Error(`backend did not respond on ${BACKEND_URL} within ${READY_TIMEOUT_MS / 1000}s`)
}

// ── пример целиком ───────────────────────────────────────────────────────

async function runExample({ name }: { name: Example }): Promise<Result> {
  const appDir = join(ROOT, 'examples', name, 'your-app')
  const testDir = join(ROOT, 'examples', name, 'test-with-eberly')
  const prefix = `[${name}]`
  let step = 'swagger'
  let backend: Backend | undefined

  console.log(`\n${prefix} ── ${name} ──`)
  try {
    await run({ cmd: 'pnpm', args: ['run', 'swagger'], cwd: appDir, prefix })
    await copyFile(join(appDir, 'swagger', 'swagger.json'), join(testDir, 'swagger.json'))

    step = 'start'
    backend = startBackend({ cwd: appDir })
    currentBackend = backend
    await waitForHttp({ backend })
    console.log(`${prefix} backend is up on ${BACKEND_URL}`)

    for (const script of ['client:generate', 'typecheck', 'test']) {
      if (interrupted) throw new Error('interrupted')
      step = script
      await run({ cmd: 'pnpm', args: ['run', script], cwd: testDir, prefix })
    }
    return { name }
  } catch (error) {
    console.error(`${prefix} ✗ ${step}: ${(error as Error).message}`)
    if (backend && backend.log.length > 0) {
      console.error(`${prefix} backend log:`)
      for (const line of backend.log) console.error(`${prefix}:app ${line}`)
    }
    return { name, failedStep: step }
  } finally {
    if (backend) {
      await stopBackend({ backend })
      currentBackend = undefined
      if (!(await waitForPortFree({ timeoutMs: STOP_TIMEOUT_MS }))) {
        console.error(`${prefix} warning: :${PORT} is still busy after stopping the backend`)
      }
    }
  }
}

/** `npx eberly create` в пустую временную папку: файлы и скиллы на месте, версия своя. */
async function smokeTemplate(): Promise<Result> {
  const name = 'template'
  const dir = await mkdtemp(join(tmpdir(), 'eberly-create-'))
  try {
    await run({ cmd: 'node', args: ['bin/eberly.mjs', 'create', dir], cwd: ROOT, prefix: `[${name}]` })

    const missing = [
      'eberly/eberly.ts',
      'vitest.config.ts',
      'tsconfig.json',
      '.claude/skills/eberly-setup/SKILL.md',
      '.claude/skills/eberly-write-tests/SKILL.md',
    ].filter((file) => !existsSync(join(dir, file)))
    if (missing.length > 0) throw new Error(`missing in the created project: ${missing.join(', ')}`)

    const { version } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    if (pkg.dependencies?.eberly !== `^${version}`) {
      throw new Error(`package.json has eberly "${pkg.dependencies?.eberly}", expected "^${version}"`)
    }
    return { name }
  } catch (error) {
    console.error(`[${name}] ✗ ${(error as Error).message}`)
    return { name, failedStep: 'create' }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// ── точка входа ──────────────────────────────────────────────────────────

function parseOnly(): Example[] {
  const index = process.argv.indexOf('--only')
  if (index === -1) return [...EXAMPLES]
  const name = process.argv[index + 1]
  if (!EXAMPLES.includes(name as Example)) {
    console.error(`Unknown example "${name}". Use one of: ${EXAMPLES.join(', ')}`)
    process.exit(1)
  }
  return [name as Example]
}

function printSummary({ results }: { results: Result[] }): void {
  console.log('\nE2E summary:')
  for (const { name, failedStep } of results) {
    console.log(failedStep ? `  ✗ ${name.padEnd(12)} failed at ${failedStep}` : `  ✓ ${name}`)
  }
}

// Ctrl+C: дети из нашей группы получат SIGINT от терминала сами, а
// бэкенд в отдельной группе — нет, поэтому гасим его явно.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    if (interrupted) process.exit(130) // второй Ctrl+C — выйти сразу
    interrupted = true
    console.error(`\nReceived ${signal}, stopping the backend…`)
    if (currentBackend) await stopBackend({ backend: currentBackend })
    process.exit(130)
  })
}

// Корневой package.json — CJS, а top-level await в CJS tsx не умеет.
async function main(): Promise<void> {
  const examples = parseOnly()

  try {
    await run({ cmd: 'pnpm', args: ['build'], cwd: ROOT, prefix: '[build]' })
    await run({ cmd: 'pnpm', args: ['exec', 'tsx', 'scripts/sync-template.ts'], cwd: ROOT, prefix: '[template]' })
  } catch (error) {
    console.error(`✗ ${(error as Error).message}`)
    process.exit(1)
  }

  if (await isPortBusy()) {
    console.error(`Port ${PORT} is busy: stop your dev server on :${PORT} and run again.`)
    process.exit(1)
  }

  const results: Result[] = []
  for (const name of examples) {
    if (interrupted) break
    results.push(await runExample({ name }))
  }
  results.push(await smokeTemplate())

  printSummary({ results })
  process.exit(results.some((result) => result.failedStep) ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
