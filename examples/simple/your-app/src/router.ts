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

export const router = {
  posts: {
    list: listPosts,
    get: getPost,
    create: createPost,
    update: updatePost,
    delete: deletePost,
  },
}
