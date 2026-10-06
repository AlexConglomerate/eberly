// Слой доступа к данным.
//
// Делает три вещи:
//   1. `initDatabase()` — запускает миграции BetterAuth (создаёт таблицы
//      user/session/account/verification) и создаёт нашу собственную
//      таблицу `post`. Вызывается один раз при старте сервера.
//   2. `posts.*` — CRUD по постам (отдельная таблица, не из BetterAuth).
//   3. `adminDb.*` — тест-helpers: `clearAll()` (вайпает всё, чтобы тесты
//      могли стартовать с чистой базы) и `setRole()` (поднимает роль
//      пользователя; нужно тестам, чтобы создать админа).
//
// Поля postов хранятся как ISO-строки времён. Реальной валидации тут
// нет — она уже сделана zod-схемами в `./router.ts`.

import { randomUUID } from 'node:crypto'

import { getMigrations } from 'better-auth/db/migration'

import { authOptions } from './auth'
import { sqlite } from './sqlite'

export interface Post {
  id: string
  title: string
  content: string
  authorId: string
  createdAt: string
  updatedAt: string
}

let migrationsApplied = false

export async function initDatabase(): Promise<void> {
  if (!migrationsApplied) {
    const { runMigrations } = await getMigrations(authOptions as Parameters<typeof getMigrations>[0])
    await runMigrations()
    migrationsApplied = true
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS post (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      authorId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `)
}

export const posts = {
  list(): Post[] {
    return sqlite
      .prepare('SELECT id, title, content, authorId, createdAt, updatedAt FROM post ORDER BY createdAt')
      .all() as Post[]
  },

  findById({ id }: { id: string }): Post | undefined {
    return sqlite
      .prepare('SELECT id, title, content, authorId, createdAt, updatedAt FROM post WHERE id = ?')
      .get(id) as Post | undefined
  },

  create({
    title,
    content,
    authorId,
  }: {
    title: string
    content: string
    authorId: string
  }): Post {
    const now = new Date().toISOString()
    const post: Post = {
      id: randomUUID(),
      title,
      content,
      authorId,
      createdAt: now,
      updatedAt: now,
    }
    sqlite
      .prepare(
        'INSERT INTO post (id, title, content, authorId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(post.id, post.title, post.content, post.authorId, post.createdAt, post.updatedAt)
    return post
  },

  update({
    id,
    title,
    content,
  }: {
    id: string
    title?: string
    content?: string
  }): Post | undefined {
    const existing = this.findById({ id })
    if (!existing) return undefined
    const next: Post = {
      ...existing,
      title: title ?? existing.title,
      content: content ?? existing.content,
      updatedAt: new Date().toISOString(),
    }
    sqlite
      .prepare('UPDATE post SET title = ?, content = ?, updatedAt = ? WHERE id = ?')
      .run(next.title, next.content, next.updatedAt, next.id)
    return next
  },

  remove({ id }: { id: string }): boolean {
    const info = sqlite.prepare('DELETE FROM post WHERE id = ?').run(id)
    return info.changes > 0
  },
}

export const adminDb = {
  /**
   * Полная очистка: и наши `post`, и таблицы BetterAuth. Нужно тестам,
   * чтобы каждый прогон стартовал с пустой базой.
   */
  clearAll(): void {
    sqlite.exec(`
      DELETE FROM post;
      DELETE FROM session;
      DELETE FROM account;
      DELETE FROM verification;
      DELETE FROM "user";
    `)
  },

  /** Поднять/опустить роль пользователя по email (только для тестов). */
  setRole({ email, role }: { email: string; role: string }): boolean {
    const info = sqlite
      .prepare('UPDATE "user" SET role = ? WHERE email = ?')
      .run(role, email)
    return info.changes > 0
  },

  /**
   * Отозвать ВСЕ сессии пользователя по email — его bearer-токен сразу
   * «протухает» (`getSession` по нему вернёт null → защищённые эндпоинты
   * ответят 401). Тест-helper, чтобы на стороне eberly показать сценарий
   * «401 → refresh» в globalAfter-хуке. Чистим session-строки напрямую
   * (как `setRole`/`clearAll` — это тест-обвязка, не прод-логика авторизации).
   */
  revokeSessions({ email }: { email: string }): boolean {
    const user = sqlite
      .prepare('SELECT id FROM "user" WHERE email = ?')
      .get(email) as { id: string } | undefined
    if (!user) return false
    sqlite.prepare('DELETE FROM session WHERE userId = ?').run(user.id)
    return true
  },
}
