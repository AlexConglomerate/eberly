import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MinLength } from 'class-validator'

import { UserDto } from '../users/user.dto.js'

export class RegisterDto {
  @ApiProperty({ description: 'Unique email. Used as the login.', example: 'alice@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ description: 'Password, at least 6 characters.', minLength: 6, example: 'secret123' })
  @IsString()
  @MinLength(6)
  password: string
}

export class LoginDto {
  @ApiProperty({ description: 'Email the user registered with.', example: 'alice@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ description: 'User password.', example: 'secret123' })
  @IsString()
  password: string
}

export class TokenDto {
  @ApiProperty({ description: 'Send it as `Authorization: Bearer <accessToken>`.' })
  accessToken: string

  // Вложенный DTO с описанием: Nest пишет его как `allOf: [{ $ref }]`.
  @ApiProperty({ type: () => UserDto, description: 'The logged-in user.' })
  user: UserDto
}
