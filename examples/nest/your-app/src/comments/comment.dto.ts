import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment text, non-empty.', example: 'Nice post!' })
  @IsString()
  @IsNotEmpty()
  text: string

  @ApiPropertyOptional({
    description: 'Id of the comment to reply to. It must belong to the same post. Omit for a top-level comment.',
  })
  @IsOptional()
  @IsInt()
  parentId?: number
}

export class CommentDto {
  @ApiProperty({ description: 'Comment id.', example: 1 })
  id: number

  @ApiProperty({ description: 'Comment text.' })
  text: string

  @ApiProperty({ description: 'Id of the user who wrote the comment.' })
  authorId: number

  // Рекурсия: CommentDto ссылается сам на себя.
  @ApiProperty({ type: () => [CommentDto], description: 'Replies to this comment, oldest first.' })
  replies: CommentDto[]
}
