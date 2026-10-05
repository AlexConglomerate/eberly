import {
  applyDecorators,
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger'

import { ErrorDto } from '../common/error.dto.js'
import { Store, type UserRecord } from '../store.js'

/** Минимум от express-запроса, который нужен guard'у. */
interface AuthedRequest {
  headers: { authorization?: string }
  user?: UserRecord
}

/** Простейший bearer: токен из `POST /auth/login` → пользователь из `Store`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly store: Store) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>()
    const [scheme, token] = (request.headers.authorization ?? '').split(' ')
    const userId = scheme === 'Bearer' && token ? this.store.tokens.get(token) : undefined
    const user = userId === undefined ? undefined : this.store.users.get(userId)
    if (!user) throw new UnauthorizedException()
    request.user = user
    return true
  }
}

/** Guard + `security: bearer` + задекларированный 401 в свагере. */
export function Auth() {
  return applyDecorators(
    UseGuards(AuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ type: ErrorDto, description: 'Missing or invalid bearer token.' }),
  )
}

/** Текущий пользователь (кладёт `AuthGuard`). Только вместе с `@Auth()`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserRecord =>
    context.switchToHttp().getRequest<AuthedRequest>().user!,
)
