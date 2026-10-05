import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'

import { Auth, CurrentUser } from '../auth/auth.guard.js'
import { ErrorDto } from '../common/error.dto.js'
import { POST_ID_PARAM, POST_NOT_FOUND } from '../posts/posts.controller.js'
import { type CommentRecord, Store, type UserRecord } from '../store.js'
import { CommentDto, CreateCommentDto } from './comment.dto.js'

@ApiTags('comments')
@Controller('posts/:id/comments')
export class CommentsController {
  constructor(private readonly store: Store) {}

  @Post()
  @Auth()
  @ApiOperation({
    summary: 'Comment on a post',
    description:
      'Adds a comment to any post, drafts included. Pass `parentId` to reply to another comment of the same post.',
  })
  @ApiParam(POST_ID_PARAM)
  @ApiCreatedResponse({ type: CommentDto, description: 'The created comment. `replies` is empty.' })
  @ApiBadRequestResponse({ type: ErrorDto, description: 'Empty text or non-integer `parentId`.' })
  @ApiNotFoundResponse({
    type: ErrorDto,
    description: 'No post with this id, or `parentId` is not a comment of this post.',
  })
  create(
    @CurrentUser() user: UserRecord,
    @Param('id', ParseIntPipe) postId: number,
    @Body() body: CreateCommentDto,
  ): CommentDto {
    this.assertPostExists(postId)
    const parentId = body.parentId ?? null
    if (parentId !== null && this.store.comments.get(parentId)?.postId !== postId) {
      throw new NotFoundException('Parent comment not found')
    }

    const comment: CommentRecord = {
      id: this.store.nextId(),
      postId,
      parentId,
      text: body.text,
      authorId: user.id,
      createdAt: new Date().toISOString(),
    }
    this.store.comments.set(comment.id, comment)
    return { id: comment.id, text: comment.text, authorId: comment.authorId, replies: [] }
  }

  @Get()
  @ApiOperation({
    summary: 'Comment tree of a post',
    description: 'Returns top-level comments, oldest first. Replies are nested in `replies` at any depth.',
  })
  @ApiParam(POST_ID_PARAM)
  @ApiOkResponse({ type: [CommentDto] })
  @ApiNotFoundResponse(POST_NOT_FOUND)
  list(@Param('id', ParseIntPipe) postId: number): CommentDto[] {
    this.assertPostExists(postId)
    const comments = [...this.store.comments.values()].filter((c) => c.postId === postId)
    const toTree = (parentId: number | null): CommentDto[] =>
      comments
        .filter((c) => c.parentId === parentId)
        .map((c) => ({ id: c.id, text: c.text, authorId: c.authorId, replies: toTree(c.id) }))
    return toTree(null)
  }

  private assertPostExists(postId: number): void {
    if (!this.store.posts.has(postId)) throw new NotFoundException('Post not found')
  }
}
