import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

import type { PostRecord } from '../store.js'

export class CreatePostDto {
  @ApiProperty({ description: 'Post title, non-empty.', example: 'Hello' })
  @IsString()
  @IsNotEmpty()
  title: string

  @ApiProperty({ description: 'Post body, non-empty.', example: 'First post' })
  @IsString()
  @IsNotEmpty()
  content: string
}

export class PostDto {
  @ApiProperty({ description: 'Post id.', example: 1 })
  id: number

  @ApiProperty({ description: 'Post title.' })
  title: string

  @ApiProperty({ description: 'Post body.' })
  content: string

  @ApiProperty({ description: 'Id of the user who created the post.' })
  authorId: number

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the post was published. `null` while the post is a draft.',
  })
  publishedAt: string | null

  @ApiProperty({ format: 'date-time', description: 'When the post was created.' })
  createdAt: string
}

export function toPostDto(post: PostRecord): PostDto {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    authorId: post.authorId,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
  }
}
