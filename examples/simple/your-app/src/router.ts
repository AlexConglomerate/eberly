import { ORPCError, os } from '@orpc/server'
import { z } from 'zod'
import { db } from './db'

const PostSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ id: 'Post' })

const listPosts = os
  .route({
    method: 'GET',
    path: '/posts',
    summary: 'List all posts',
    tags: ['Posts'],
  })
  .output(z.array(PostSchema))
  .handler(() => db.list())

const getPost = os
  .route({
    method: 'GET',
    path: '/posts/{id}',
    summary: 'Get a single post by id',
    tags: ['Posts'],
  })
  .input(z.object({ id: z.string() }))
  .output(PostSchema)
  .handler(({ input }) => {
    const post = db.findById({ id: input.id })
    if (!post) {
      throw new ORPCError('NOT_FOUND', { message: 'Post not found' })
    }
    return post
  })

const createPost = os
  .route({
    method: 'POST',
    path: '/posts',
    summary: 'Create a post',
    tags: ['Posts'],
  })
  .input(
    z.object({
      title: z.string().min(1),
      content: z.string().min(1),
    }),
  )
  .output(PostSchema)
  .handler(({ input }) => db.create({ title: input.title, content: input.content }))

const updatePost = os
  .route({
    method: 'PATCH',
    path: '/posts/{id}',
    summary: 'Update a post',
    tags: ['Posts'],
  })
  .input(
    z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      content: z.string().min(1).optional(),
    }),
  )
  .output(PostSchema)
  .handler(({ input }) => {
    const post = db.update({
      id: input.id,
      title: input.title,
      content: input.content,
    })
    if (!post) {
      throw new ORPCError('NOT_FOUND', { message: 'Post not found' })
    }
    return post
  })

const deletePost = os
  .route({
    method: 'DELETE',
    path: '/posts/{id}',
    summary: 'Delete a post',
    tags: ['Posts'],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(({ input }) => {
    const removed = db.remove({ id: input.id })
    if (!removed) {
      throw new ORPCError('NOT_FOUND', { message: 'Post not found' })
    }
    return { success: true }
  })

// --- Эндпоинты-«заглушки» для демонстрации сценариев (actions) ---------
// Реальной авторизации тут НЕТ: эндпоинты просто логируют и возвращают
// то же, что приняли. Нужны только чтобы показать `user.fullRegister`,
// который под капотом дёргает register → confirm одним методом.

const register = os
  .route({
    method: 'POST',
    path: '/auth/register',
    summary: 'Register (stub: echoes input)',
    tags: ['Auth'],
  })
  .input(z.object({ email: z.string(), password: z.string() }))
  .output(z.object({ email: z.string(), password: z.string() }))
  .handler(({ input }) => {
    console.log('[auth.register]', input)
    return input
  })

const confirm = os
  .route({
    method: 'POST',
    path: '/auth/confirm',
    summary: 'Confirm registration code (stub: echoes input)',
    tags: ['Auth'],
  })
  .input(z.object({ code: z.string() }))
  .output(z.object({ code: z.string() }))
  .handler(({ input }) => {
    console.log('[auth.confirm]', input)
    return input
  })

// --- Два эндпоинта, отличающиеся ТОЛЬКО методом (один путь) -----------
// Намеренно задаём обоим один и тот же operationId `auth.getSession` —
// это в точности воспроизводит кейс better-auth (GET и POST на
// `/get-session` с общим operationId). Генератор eberly разводит такую
// коллизию префиксом метода: `getSession` → `getGetSession` (GET) и
// `postGetSession` (POST). Реальной авторизации тут НЕТ — стабы.

const getSession = os
  .route({
    method: 'GET',
    path: '/auth/session',
    operationId: 'auth.getSession',
    summary: 'Read current session (stub)',
    tags: ['Auth'],
  })
  .output(z.object({ user: z.string(), method: z.string() }))
  .handler(() => {
    console.log('[auth.getSession GET]')
    return { user: 'anonymous', method: 'GET' }
  })

const refreshSession = os
  .route({
    method: 'POST',
    path: '/auth/session',
    operationId: 'auth.getSession',
    summary: 'Refresh current session (stub)',
    tags: ['Auth'],
  })
  .input(z.object({ token: z.string() }))
  .output(z.object({ user: z.string(), method: z.string() }))
  .handler(({ input }) => {
    console.log('[auth.getSession POST]', input)
    return { user: 'anonymous', method: 'POST' }
  })

const clearDatabase = os
  .route({
    method: 'POST',
    path: '/admin/clear-database',
    summary: 'Wipe all in-memory data',
    tags: ['Admin'],
  })
  .output(z.object({ success: z.boolean() }))
  .handler(() => {
    console.log('[admin.clearDatabase] wiping database')
    db.clear()
    return { success: true }
  })

export const router = {
  posts: {
    list: listPosts,
    get: getPost,
    create: createPost,
    update: updatePost,
    delete: deletePost,
  },
  auth: {
    register,
    confirm,
    getSession,
    refreshSession,
  },
  admin: {
    clearDatabase,
  },
}
