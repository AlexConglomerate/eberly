import { randomBytes } from 'node:crypto'

import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { ErrorDto } from '../common/error.dto.js'
import { Store, type UserRecord } from '../store.js'
import { toUserDto, UserDto } from '../users/user.dto.js'
import { LoginDto, RegisterDto, TokenDto } from './auth.dto.js'
import { Auth, CurrentUser } from './auth.guard.js'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly store: Store) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a user. Email must be unique. Does not log in: call `POST /auth/login` to get a token.',
  })
  @ApiCreatedResponse({ type: UserDto, description: 'The created user. `avatarUrl` is `null`.' })
  @ApiBadRequestResponse({ type: ErrorDto, description: 'Invalid email or password shorter than 6 characters.' })
  @ApiConflictResponse({ type: ErrorDto, description: 'A user with this email already exists.' })
  register(@Body() body: RegisterDto): UserDto {
    const taken = [...this.store.users.values()].some((user) => user.email === body.email)
    if (taken) throw new ConflictException('Email is already registered')

    const user: UserRecord = {
      id: this.store.nextId(),
      email: body.email,
      password: body.password,
      avatarUrl: null,
    }
    this.store.users.set(user.id, user)
    return toUserDto(user)
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Log in',
    description: 'Exchanges email and password for an access token and returns the user. Every login issues a new token; old tokens stay valid.',
  })
  @ApiOkResponse({ type: TokenDto })
  @ApiUnauthorizedResponse({ type: ErrorDto, description: 'Wrong email or password.' })
  login(@Body() body: LoginDto): TokenDto {
    const user = [...this.store.users.values()].find((u) => u.email === body.email)
    if (!user || user.password !== body.password) {
      throw new UnauthorizedException('Invalid email or password')
    }
    const accessToken = randomBytes(24).toString('hex')
    this.store.tokens.set(accessToken, user.id)
    return { accessToken, user: toUserDto(user) }
  }

  @Get('me')
  @Auth()
  @ApiOperation({ summary: 'Current user', description: 'Returns the user the bearer token belongs to.' })
  @ApiOkResponse({ type: UserDto })
  me(@CurrentUser() user: UserRecord): UserDto {
    return toUserDto(user)
  }

  @Get('whoami')
  @Auth()
  @ApiOperation({
    summary: 'Current user (deprecated)',
    description: 'Same as `GET /auth/me`. Kept for old clients, use `GET /auth/me` instead.',
    deprecated: true,
  })
  @ApiOkResponse({ type: UserDto })
  whoami(@CurrentUser() user: UserRecord): UserDto {
    return toUserDto(user)
  }
}
