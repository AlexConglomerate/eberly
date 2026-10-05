import { ApiProperty } from '@nestjs/swagger'

import type { UserRecord } from '../store.js'

export class UserDto {
  @ApiProperty({ description: 'User id.', example: 1 })
  id: number

  @ApiProperty({ description: 'Email the user registered with.', example: 'alice@example.com' })
  email: string

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Avatar URL. `null` until the user uploads an avatar.',
    example: '/avatars/1.png',
  })
  avatarUrl: string | null
}

export function toUserDto(user: UserRecord): UserDto {
  return { id: user.id, email: user.email, avatarUrl: user.avatarUrl }
}
