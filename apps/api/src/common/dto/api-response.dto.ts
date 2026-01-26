import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  details?: Record<string, unknown>;
}

export class ApiResponseDto<T = unknown> {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  data?: T;

  @ApiPropertyOptional({ type: ApiErrorDto })
  error?: ApiErrorDto;

  @ApiPropertyOptional()
  meta?: Record<string, unknown>;
}

export class SuccessResponseDto {
  @ApiProperty({ default: true })
  success: boolean = true;

  @ApiPropertyOptional()
  message?: string;
}
