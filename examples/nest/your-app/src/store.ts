import { Injectable } from '@nestjs/common'

// «База данных» в памяти. Пароли хранятся как есть — это пример, не прод.

export interface UserRecord {
  id: number
  email: string
  password: string
  avatarUrl: string | null
}

export interface PostRecord {
  id: number
  title: string
  content: string
  authorId: number
  publishedAt: string | null
  createdAt: string
}

export interface CommentRecord {
  id: number
  postId: number
  parentId: number | null
  text: string
  authorId: number
  createdAt: string
}

@Injectable()
export class Store {
  readonly users = new Map<number, UserRecord>()
  /** accessToken → userId */
  readonly tokens = new Map<string, number>()
  readonly posts = new Map<number, PostRecord>()
  readonly comments = new Map<number, CommentRecord>()

  private lastId = 0

  /** Общий счётчик id для всех сущностей. */
  nextId(): number {
    return ++this.lastId
  }

  /** Полная очистка — для `POST /test/reset`. */
  reset(): void {
    this.users.clear()
    this.tokens.clear()
    this.posts.clear()
    this.comments.clear()
    this.lastId = 0
  }
}
