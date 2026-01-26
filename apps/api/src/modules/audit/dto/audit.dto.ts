import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Actor types for audit logs
export enum ActorType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  AGENT = 'AGENT',
}

// ============================================
// CREATE AUDIT LOG DTO
// ============================================
export class CreateAuditLogDto {
  @ApiProperty({
    description: 'The action being logged (from AUDIT_ACTIONS constants)',
    example: 'USER_LOGGED_IN',
  })
  @IsString()
  action: string;

  @ApiPropertyOptional({
    description: 'ID of the actor performing the action',
    example: 'clx1234567890',
  })
  @IsString()
  @IsOptional()
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Type of actor (USER, SYSTEM, or AGENT)',
    enum: ActorType,
    example: ActorType.USER,
  })
  @IsEnum(ActorType)
  @IsOptional()
  actorType?: ActorType;

  @ApiPropertyOptional({
    description: 'Type of entity being affected',
    example: 'Job',
  })
  @IsString()
  @IsOptional()
  targetType?: string;

  @ApiPropertyOptional({
    description: 'ID of the entity being affected',
    example: 'clx9876543210',
  })
  @IsString()
  @IsOptional()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Additional details about the action (JSON, PII will be masked)',
    example: { method: 'POST', path: '/api/jobs' },
  })
  @IsObject()
  @IsOptional()
  details?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'IP address of the request origin',
    example: '192.168.1.1',
  })
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'User agent string from the request',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  })
  @IsString()
  @IsOptional()
  userAgent?: string;
}

// ============================================
// AUDIT LOG QUERY DTO
// ============================================
export class AuditLogQueryDto {
  // Filters
  @ApiPropertyOptional({
    description: 'Filter by action type',
    example: 'USER_LOGGED_IN',
  })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter by actor ID',
    example: 'clx1234567890',
  })
  @IsString()
  @IsOptional()
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by target entity type',
    example: 'Job',
  })
  @IsString()
  @IsOptional()
  targetType?: string;

  @ApiPropertyOptional({
    description: 'Filter by target entity ID',
    example: 'clx9876543210',
  })
  @IsString()
  @IsOptional()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Filter logs from this date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter logs until this date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  // Pagination
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ============================================
// AUDIT LOG RESPONSE DTO
// ============================================
export class AuditLogResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the audit log entry',
    example: 'clx1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'The action that was logged',
    example: 'USER_LOGGED_IN',
  })
  action: string;

  @ApiPropertyOptional({
    description: 'ID of the actor who performed the action',
    example: 'clx1234567890',
  })
  actorId: string | null;

  @ApiPropertyOptional({
    description: 'Type of actor (USER, SYSTEM, or AGENT)',
    example: 'USER',
  })
  actorType: string | null;

  @ApiPropertyOptional({
    description: 'Type of entity that was affected',
    example: 'Job',
  })
  targetType: string | null;

  @ApiPropertyOptional({
    description: 'ID of the entity that was affected',
    example: 'clx9876543210',
  })
  targetId: string | null;

  @ApiPropertyOptional({
    description: 'Additional details about the action (PII masked)',
    example: { method: 'POST', path: '/api/jobs' },
  })
  details: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'IP address of the request origin',
    example: '192.168.1.1',
  })
  ipAddress: string | null;

  @ApiPropertyOptional({
    description: 'User agent string from the request',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  })
  userAgent: string | null;

  @ApiProperty({
    description: 'Timestamp when the action occurred',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Actor user details (if available)',
    example: { id: 'clx1234567890', email: 'u***@***', firstName: 'John' },
  })
  actor?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

// ============================================
// PAGINATED AUDIT LOG RESPONSE DTO
// ============================================
export class PaginatedAuditLogResponseDto {
  @ApiProperty({
    description: 'Array of audit log entries',
    type: [AuditLogResponseDto],
  })
  data: AuditLogResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: { page: 1, pageSize: 20, total: 100, totalPages: 5 },
  })
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
