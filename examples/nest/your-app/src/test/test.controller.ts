import { Controller, HttpCode, Post } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { Store } from '../store.js'

/**
 * «Тестовый режим» бэкенда: подключается в `AppModule` только при
 * `TEST_MODE=1`, в обычном запуске этих эндпоинтов нет.
 */
@ApiTags('test')
@Controller('test')
export class TestController {
  constructor(private readonly store: Store) {}

  @Post('reset')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset all data',
    description:
      'Deletes all users, tokens, posts and comments, and restarts ids from 1. Exists only when the server runs with `TEST_MODE=1`.',
  })
  @ApiOkResponse({
    schema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } },
  })
  reset(): { ok: boolean } {
    this.store.reset()
    return { ok: true }
  }
}
