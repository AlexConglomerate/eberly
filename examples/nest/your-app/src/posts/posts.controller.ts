import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'

import { Auth, CurrentUser } from '../auth/auth.guard.js'
import { ErrorDto } from '../common/error.dto.js'
import { type PostRecord, Store, type UserRecord } from '../store.js'
import { CreatePostDto, PostDto, toPostDto } from './post.dto.js'

export const POST_ID_PARAM = { name: 'postId', type: Number, description: 'Post id.' } as const
export const POST_NOT_FOUND = { type: ErrorDto, description: 'No post with this id.' } as const

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly store: Store) {}

  @Get()
  @ApiOperation({
    summary: 'List published posts',
    description:
      'Returns published posts in creation order. Drafts (`publishedAt: null`) are never listed, even to their author.',
  })
  @ApiQuery({
    name: 'authorId',
    required: false,
    type: Number,
    description: 'Only return posts of this author.',
  })
  @ApiOkResponse({ type: [PostDto] })
  list(@Query('authorId', new ParseIntPipe({ optional: true })) authorId?: number): PostDto[] {
    return [...this.store.posts.values()]
      .filter((post) => post.publishedAt !== null)
      .filter((post) => authorId === undefined || post.authorId === authorId)
      .map(toPostDto)
  }

  @Post()
  @Auth()
  @ApiOperation({
    summary: 'Create a post',
    description: 'Creates a draft (`publishedAt: null`) owned by the current user. Publish it with `POST /posts/{postId}/publish`.',
  })
  @ApiCreatedResponse({ type: PostDto })
  @ApiBadRequestResponse({ type: ErrorDto, description: 'Empty title or content.' })
  create(@CurrentUser() user: UserRecord, @Body() body: CreatePostDto): PostDto {
    const post: PostRecord = {
      id: this.store.nextId(),
      title: body.title,
      content: body.content,
      authorId: user.id,
      publishedAt: null,
      createdAt: new Date().toISOString(),
    }
    this.store.posts.set(post.id, post)
    return toPostDto(post)
  }

  @Get(':postId')
  @ApiOperation({
    summary: 'Get a post by id',
    description: 'Returns any post, drafts included. No authorization needed.',
  })
  @ApiParam(POST_ID_PARAM)
  @ApiOkResponse({ type: PostDto })
  @ApiNotFoundResponse(POST_NOT_FOUND)
  get(@Param('postId', ParseIntPipe) postId: number): PostDto {
    return toPostDto(this.findPost(postId))
  }

  @Post(':postId/publish')
  @HttpCode(200)
  @Auth()
  @ApiOperation({
    summary: 'Publish a post',
    description:
      'Sets `publishedAt` to the current time. Only the author may publish, otherwise 403. Publishing an already published post keeps the original `publishedAt`.',
  })
  @ApiParam(POST_ID_PARAM)
  @ApiOkResponse({ type: PostDto })
  @ApiForbiddenResponse({ type: ErrorDto, description: 'The current user is not the author.' })
  @ApiNotFoundResponse(POST_NOT_FOUND)
  publish(@CurrentUser() user: UserRecord, @Param('postId', ParseIntPipe) postId: number): PostDto {
    const post = this.findOwnPost({ id: postId, user })
    post.publishedAt ??= new Date().toISOString()
    return toPostDto(post)
  }

  @Delete(':postId')
  @HttpCode(204)
  @Auth()
  @ApiOperation({
    summary: 'Delete a post',
    description: 'Deletes the post and all its comments. Only the author may delete, otherwise 403.',
  })
  @ApiParam(POST_ID_PARAM)
  @ApiNoContentResponse({ description: 'Deleted. Empty body.' })
  @ApiForbiddenResponse({ type: ErrorDto, description: 'The current user is not the author.' })
  @ApiNotFoundResponse(POST_NOT_FOUND)
  remove(@CurrentUser() user: UserRecord, @Param('postId', ParseIntPipe) postId: number): void {
    const post = this.findOwnPost({ id: postId, user })
    this.store.posts.delete(post.id)
    for (const comment of this.store.comments.values()) {
      if (comment.postId === post.id) this.store.comments.delete(comment.id)
    }
  }

  private findPost(id: number): PostRecord {
    const post = this.store.posts.get(id)
    if (!post) throw new NotFoundException('Post not found')
    return post
  }

  private findOwnPost({ id, user }: { id: number; user: UserRecord }): PostRecord {
    const post = this.findPost(id)
    if (post.authorId !== user.id) throw new ForbiddenException('Only the author can do this')
    return post
  }
}
