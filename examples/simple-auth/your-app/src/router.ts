// Публичный API приложения (oRPC). Сюда смотрит ebely — отсюда же
// собирается swagger. Никаких сетевых mountов BetterAuth наружу нет:
// auth-эндпоинты — это oRPC-обёртки над server-side API BetterAuth.
//
// Уровни доступа реализованы через две middleware:
//   - requireUser  — нужен валидный bearer-токен.
//   - requireAdmin — нужен bearer-токен пользователя с role='admin'.
// Эти middleware подменяются заранее в base/authed/adminOnly,
// эндпоинты дальше просто описывают свою бизнес-логику.

import { ORPCError, os } from '@orpc/server'
import { z } from 'zod'

import { auth, pickUser } from './auth'
import { adminDb, posts } from './db'
import { performGoogleLogin } from './oauth-flow'

type AppContext = {
  /** Web-Fetch Headers, собранные из node IncomingMessage в server.ts. */
  headers: Headers
}

const base = os.$context<AppContext>()

const requireUser = base.middleware(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers })
  if (!session?.user) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Authentication required' })
  }
  return next({ context: { user: pickUser(session.user) } })
})

const requireAdmin = base.middleware(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers })
  if (!session?.user) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Authentication required' })
  }
  const user = pickUser(session.user)
  if (user.role !== 'admin') {
    throw new ORPCError('FORBIDDEN', { message: 'Admin role required' })
  }
  return next({ context: { user } })
})

const authed = base.use(requireUser)
const adminOnly = base.use(requireAdmin)

// ---------- Схемы --------------------------------------------------------

const UserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.string(),
  })
  .meta({ id: 'User' })

const SessionSchema = z
  .object({
    token: z.string(),
    user: UserSchema,
  })
  .meta({ id: 'Session' })

const PostSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    authorId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ id: 'Post' })

const SuccessSchema = z.object({ success: z.boolean() })

// ---------- Хелперы для маппинга ошибок BetterAuth ----------------------

function mapAuthError(err: unknown, fallback: 'UNAUTHORIZED' | 'BAD_REQUEST'): never {
  if (err instanceof ORPCError) throw err
  const status = (err as { status?: string | number } | null)?.status
  const message =
    (err as { message?: string } | null)?.message ??
    (err as { body?: { message?: string } } | null)?.body?.message ??
    'Auth error'
  if (status === 'UNPROCESSABLE_ENTITY' || status === 'BAD_REQUEST' || status === 400) {
    throw new ORPCError('BAD_REQUEST', { message })
  }
  if (status === 'UNAUTHORIZED' || status === 401) {
    throw new ORPCError('UNAUTHORIZED', { message })
  }
  if (status === 'CONFLICT' || status === 409) {
    throw new ORPCError('CONFLICT', { message })
  }
  throw new ORPCError(fallback, { message })
}

// ---------- Auth ---------------------------------------------------------

const signUp = base
  .route({
    method: 'POST',
    path: '/auth/sign-up',
    summary: 'Регистрация по email и паролю (BetterAuth)',
    tags: ['Auth'],
  })
  .input(z.object({ email: z.string(), password: z.string().min(6), name: z.string().min(1) }))
  .output(SessionSchema)
  .handler(async ({ input }) => {
    try {
      const result = await auth.api.signUpEmail({
        body: { email: input.email, password: input.password, name: input.name },
      })
      const token = (result as { token?: string | null }).token
      if (!token) {
        throw new ORPCError('BAD_REQUEST', { message: 'Sign up did not return a token' })
      }
      return { token, user: pickUser((result as { user: unknown }).user) }
    } catch (err) {
      mapAuthError(err, 'BAD_REQUEST')
    }
  })

const signIn = base
  .route({
    method: 'POST',
    path: '/auth/sign-in',
    summary: 'Логин по email и паролю (BetterAuth)',
    tags: ['Auth'],
  })
  .input(z.object({ email: z.string(), password: z.string() }))
  .output(SessionSchema)
  .handler(async ({ input }) => {
    try {
      const result = await auth.api.signInEmail({
        body: { email: input.email, password: input.password },
      })
      const token = (result as { token?: string | null }).token
      if (!token) {
        throw new ORPCError('UNAUTHORIZED', { message: 'Invalid credentials' })
      }
      return { token, user: pickUser((result as { user: unknown }).user) }
    } catch (err) {
      mapAuthError(err, 'UNAUTHORIZED')
    }
  })

const session = authed
  .route({
    method: 'GET',
    path: '/auth/session',
    summary: 'Текущий пользователь (требует bearer-токен)',
    tags: ['Auth'],
  })
  .output(UserSchema)
  .handler(({ context }) => context.user)

const signOut = authed
  .route({
    method: 'POST',
    path: '/auth/sign-out',
    summary: 'Выйти (отзывает session-токен в BetterAuth)',
    tags: ['Auth'],
  })
  .output(SuccessSchema)
  .handler(async ({ context }) => {
    await auth.api.signOut({ headers: context.headers })
    return { success: true }
  })

const googleLogin = base
  .route({
    method: 'POST',
    path: '/auth/oauth/google/login',
    summary: 'OAuth-логин через фейковый Google (server-side flow)',
    tags: ['Auth'],
  })
  .output(SessionSchema)
  .handler(async () => {
    try {
      const { token } = await performGoogleLogin()
      const me = await auth.api.getSession({
        headers: new Headers({ authorization: `Bearer ${token}` }),
      })
      if (!me?.user) {
        throw new ORPCError('UNAUTHORIZED', { message: 'OAuth login produced no session' })
      }
      return { token, user: pickUser(me.user) }
    } catch (err) {
      if (err instanceof ORPCError) throw err
      throw new ORPCError('BAD_REQUEST', {
        message: (err as { message?: string } | null)?.message ?? 'OAuth login failed',
      })
    }
  })

// ---------- Posts --------------------------------------------------------

const listPosts = authed
  .route({
    method: 'GET',
    path: '/posts',
    summary: 'List all posts (auth required)',
    tags: ['Posts'],
  })
  .output(z.array(PostSchema))
  .handler(() => posts.list())

const getPost = authed
  .route({
    method: 'GET',
    path: '/posts/{id}',
    summary: 'Get a single post (auth required)',
    tags: ['Posts'],
  })
  .input(z.object({ id: z.string() }))
  .output(PostSchema)
  .handler(({ input }) => {
    const post = posts.findById({ id: input.id })
    if (!post) throw new ORPCError('NOT_FOUND', { message: 'Post not found' })
    return post
  })

const createPost = authed
  .route({
    method: 'POST',
    path: '/posts',
    summary: 'Create a post (any authenticated user; authorId = current user)',
    tags: ['Posts'],
  })
  .input(z.object({ title: z.string().min(1), content: z.string().min(1) }))
  .output(PostSchema)
  .handler(({ input, context }) =>
    posts.create({ title: input.title, content: input.content, authorId: context.user.id }),
  )

const updatePost = authed
  .route({
    method: 'PATCH',
    path: '/posts/{id}',
    summary: 'Update a post (author OR admin)',
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
  .handler(({ input, context }) => {
    const existing = posts.findById({ id: input.id })
    if (!existing) throw new ORPCError('NOT_FOUND', { message: 'Post not found' })
    const isAuthor = existing.authorId === context.user.id
    const isAdmin = context.user.role === 'admin'
    if (!isAuthor && !isAdmin) {
      throw new ORPCError('FORBIDDEN', { message: 'You can only update your own posts' })
    }
    const updated = posts.update({ id: input.id, title: input.title, content: input.content })
    if (!updated) throw new ORPCError('NOT_FOUND', { message: 'Post not found' })
    return updated
  })

const deletePost = adminOnly
  .route({
    method: 'DELETE',
    path: '/posts/{id}',
    summary: 'Delete a post (admin only)',
    tags: ['Posts'],
  })
  .input(z.object({ id: z.string() }))
  .output(SuccessSchema)
  .handler(({ input }) => {
    const removed = posts.remove({ id: input.id })
    if (!removed) throw new ORPCError('NOT_FOUND', { message: 'Post not found' })
    return { success: true }
  })

// ---------- Admin (test helpers, без авторизации) -----------------------

const clearDatabase = base
  .route({
    method: 'POST',
    path: '/admin/clear-database',
    summary: 'Wipe ALL data (тест-хелпер, не для прода)',
    tags: ['Admin'],
  })
  .output(SuccessSchema)
  .handler(() => {
    adminDb.clearAll()
    return { success: true }
  })

const promote = base
  .route({
    method: 'POST',
    path: '/admin/promote',
    summary: 'Set role for a user by email (тест-хелпер, не для прода)',
    tags: ['Admin'],
  })
  .input(z.object({ email: z.string(), role: z.string() }))
  .output(SuccessSchema)
  .handler(({ input }) => {
    const ok = adminDb.setRole({ email: input.email, role: input.role })
    if (!ok) throw new ORPCError('NOT_FOUND', { message: 'User not found' })
    return { success: true }
  })

// ---------- Router -------------------------------------------------------

export const router = {
  auth: {
    signUp,
    signIn,
    session,
    signOut,
    googleLogin,
  },
  posts: {
    list: listPosts,
    get: getPost,
    create: createPost,
    update: updatePost,
    delete: deletePost,
  },
  admin: {
    clearDatabase,
    promote,
  },
}
