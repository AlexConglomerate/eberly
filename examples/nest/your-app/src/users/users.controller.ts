import { extname } from 'node:path'

import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'

import { Auth, CurrentUser } from '../auth/auth.guard.js'
import { ErrorDto } from '../common/error.dto.js'
import type { UserRecord } from '../store.js'
import { toUserDto, UserDto } from './user.dto.js'

@ApiTags('users')
@Controller('users')
export class UsersController {
  @Post('me/avatar')
  @Auth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload an avatar',
    description:
      'Sets the avatar of the current user. Any file is accepted; `avatarUrl` becomes `/avatars/<userId><ext>`, where the extension comes from the uploaded file name. Uploading again replaces the avatar.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary', description: 'The image file.' } },
    },
  })
  @ApiCreatedResponse({ type: UserDto, description: 'The user with the new `avatarUrl`.' })
  @ApiBadRequestResponse({ type: ErrorDto, description: 'No `file` field in the form.' })
  uploadAvatar(
    @CurrentUser() user: UserRecord,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): UserDto {
    if (!file) throw new BadRequestException('file is required')
    // Сам файл не храним — пример только про контракт.
    user.avatarUrl = `/avatars/${user.id}${extname(file.originalname)}`
    return toUserDto(user)
  }
}
