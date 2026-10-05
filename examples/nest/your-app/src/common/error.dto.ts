import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/** Стандартное тело ошибки Nest (`HttpException`). */
export class ErrorDto {
  @ApiProperty({ description: 'HTTP status code.', example: 404 })
  statusCode: number

  @ApiProperty({
    description:
      'Error message. Validation errors (400) return a list: one message per failed constraint.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[]

  @ApiPropertyOptional({ description: 'HTTP status text, e.g. "Not Found".', example: 'Not Found' })
  error?: string
}
