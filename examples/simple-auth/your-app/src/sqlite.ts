import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dataDir = fileURLToPath(new URL('../.data/', import.meta.url))
mkdirSync(dataDir, { recursive: true })

const dbPath = process.env.SQLITE_PATH ?? `${dataDir}app.sqlite`

/**
 * Один общий better-sqlite3 connection: им пользуется и BetterAuth
 * (через свой встроенный Kysely-адаптер), и таблица `post` ниже.
 */
export const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
