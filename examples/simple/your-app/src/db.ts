/**
 * "Database" — это просто переменная в памяти.
 * Никакой реальной БД здесь нет: данные живут только пока запущен процесс.
 */

export interface Post {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

/** Вся "база данных" — этот массив. */
const posts: Post[] = [
  {
    id: '1',
    title: 'First post',
    content: 'This data lives only in memory.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

let nextId = 2

export const db = {
  list(): Post[] {
    return posts
  },

  findById({ id }: { id: string }): Post | undefined {
    return posts.find((post) => post.id === id)
  },

  create({ title, content }: { title: string; content: string }): Post {
    const now = new Date().toISOString()
    const post: Post = {
      id: String(nextId++),
      title,
      content,
      createdAt: now,
      updatedAt: now,
    }
    posts.push(post)
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
    const post = posts.find((item) => item.id === id)
    if (!post) return undefined

    if (title !== undefined) post.title = title
    if (content !== undefined) post.content = content
    post.updatedAt = new Date().toISOString()
    return post
  },

  remove({ id }: { id: string }): boolean {
    const index = posts.findIndex((post) => post.id === id)
    if (index === -1) return false
    posts.splice(index, 1)
    return true
  },

  /** Полная очистка «базы»: опустошает массив и сбрасывает счётчик id. */
  clear(): void {
    posts.length = 0
    nextId = 1
  },
}
