import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ============================================
// JOB QUEUE QUERY DTO
// ============================================
export class JobQueueQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by job status (comma-separated for multiple)',
    example: 'DISPATCHED,ACCEPTED',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by start date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by SLA breach status',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  slaBreached?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by escalation status',
    example: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  escalated?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by service category code',
    example: 'ELECTRICAL',
  })
  @IsString()
  @IsOptional()
  serviceCategory?: string;

  @ApiPropertyOptional({
    description: 'Filter by urgency level',
    example: 'HIGH',
  })
  @IsString()
  @IsOptional()
  urgency?: string;

  @ApiPropertyOptional({
    description: 'Search by job number, contact name, or description',
    example: 'plumbing leak',
  })
  @IsString()
  @IsOptional()
  search?: string;

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
// MANUAL DISPATCH DTO
// ============================================
export class ManualDispatchDto {
  @ApiProperty({
    description: 'ID of the pro profile to assign the job to',
    example: 'clx1234567890',
  })
  @IsString()
  @MinLength(1)
  proProfileId: string;

  @ApiPropertyOptional({
    description: 'Optional note explaining the manual dispatch',
    example: 'Customer requested this specific pro',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}

// ============================================
// ESCALATION OVERRIDE DTO
// ============================================
export enum EscalationOverrideAction {
  RESOLVE = 'RESOLVE',
  REASSIGN = 'REASSIGN',
  CANCEL = 'CANCEL',
  ESCALATE_FURTHER = 'ESCALATE_FURTHER',
}

export class EscalationOverrideDto {
  @ApiProperty({
    description: 'New escalation step/action to apply',
    enum: EscalationOverrideAction,
    example: 'RESOLVE',
  })
  @IsEnum(EscalationOverrideAction)
  step: EscalationOverrideAction;

  @ApiPropertyOptional({
    description: 'Reason for the escalation override',
    example: 'Issue resolved via phone call with customer',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Pro profile ID for reassignment (required when step is REASSIGN)',
    example: 'clx1234567890',
  })
  @IsString()
  @IsOptional()
  proProfileId?: string;
}

// ============================================
// INTERNAL NOTE DTO
// ============================================
export class InternalNoteDto {
  @ApiProperty({
    description: 'Content of the internal note',
    example: 'Called customer to confirm scheduling details. Customer prefers afternoon appointments.',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1, { message: 'Note content is required' })
  @MaxLength(2000, { message: 'Note content cannot exceed 2000 characters' })
  note: string;
}

// ============================================
// RESPONSE DTOs
// ============================================
export class InternalNoteResponseDto {
  @ApiProperty({ description: 'Note ID' })
  id: string;

  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiProperty({ description: 'Note content' })
  content: string;

  @ApiProperty({ description: 'Author user ID' })
  authorId: string;

  @ApiProperty({ description: 'Author name' })
  authorName: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class JobQueueItemDto {
  @ApiProperty({ description: 'Job ID' })
  id: string;

  @ApiProperty({ description: 'Job reference number' })
  jobNumber: string;

  @ApiProperty({ description: 'Job status' })
  status: string;

  @ApiProperty({ description: 'Contact name' })
  contactName: string;

  @ApiProperty({ description: 'Service category' })
  serviceCategory: string;

  @ApiProperty({ description: 'Job urgency' })
  urgency: string;

  @ApiProperty({ description: 'Service city' })
  serviceCity: string;

  @ApiProperty({ description: 'Service province' })
  serviceProvince: string;

  @ApiProperty({ description: 'Whether the job is escalated' })
  escalated: boolean;

  @ApiProperty({ description: 'Whether SLA has been breached' })
  slaBreached: boolean;

  @ApiPropertyOptional({ description: 'SLA deadline' })
  slaDeadline?: Date;

  @ApiProperty({ description: 'Dispatch attempts count' })
  dispatchAttemptCount: number;

  @ApiPropertyOptional({ description: 'Assigned pro name' })
  assignedProName?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class DispatchAttemptDto {
  @ApiProperty({ description: 'Attempt ID' })
  id: string;

  @ApiProperty({ description: 'Pro profile ID' })
  proProfileId: string;

  @ApiProperty({ description: 'Pro name' })
  proName: string;

  @ApiProperty({ description: 'Attempt number' })
  attemptNumber: number;

  @ApiProperty({ description: 'Attempt status' })
  status: string;

  @ApiPropertyOptional({ description: 'Decline reason' })
  declineReason?: string | null;

  @ApiProperty({ description: 'SLA deadline for response' })
  slaDeadline: Date;

  @ApiProperty({ description: 'Dispatched timestamp' })
  dispatchedAt: Date;

  @ApiPropertyOptional({ description: 'Responded timestamp' })
  respondedAt?: Date | null;
}

export class JobDetailsResponseDto extends JobQueueItemDto {
  @ApiProperty({ description: 'Job description' })
  description: string;

  @ApiPropertyOptional({ description: 'Job title' })
  title?: string;

  @ApiProperty({ description: 'Contact email' })
  contactEmail?: string;

  @ApiProperty({ description: 'Contact phone' })
  contactPhone: string;

  @ApiPropertyOptional({ description: 'Business name' })
  businessName?: string;

  @ApiProperty({ description: 'Full service address' })
  serviceAddress: string;

  @ApiPropertyOptional({ description: 'Assigned pro ID' })
  assignedProId?: string;

  @ApiPropertyOptional({ description: 'Dispatched timestamp' })
  dispatchedAt?: Date;

  @ApiPropertyOptional({ description: 'Accepted timestamp' })
  acceptedAt?: Date;

  @ApiPropertyOptional({ description: 'Scheduled timestamp' })
  scheduledAt?: Date;

  @ApiProperty({ description: 'Dispatch history', type: [DispatchAttemptDto] })
  dispatchHistory: DispatchAttemptDto[];

  @ApiProperty({ description: 'Internal notes', type: [InternalNoteResponseDto] })
  internalNotes: InternalNoteResponseDto[];
}

export class PaginatedJobQueueResponseDto {
  @ApiProperty({ description: 'Array of job queue items', type: [JobQueueItemDto] })
  data: JobQueueItemDto[];

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

export class SlaBreachAlertDto {
  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiProperty({ description: 'Job reference number' })
  jobNumber: string;

  @ApiProperty({ description: 'Breach type (accept, schedule, update)' })
  breachType: string;

  @ApiProperty({ description: 'Breach duration in minutes' })
  breachDurationMinutes: number;

  @ApiProperty({ description: 'Contact name' })
  contactName: string;

  @ApiProperty({ description: 'Service category' })
  serviceCategory: string;

  @ApiProperty({ description: 'Current status' })
  status: string;

  @ApiProperty({ description: 'Dispatch attempts count' })
  dispatchAttemptCount: number;

  @ApiProperty({ description: 'Job created at' })
  createdAt: Date;
}

export class EscalatedJobDto extends JobQueueItemDto {
  @ApiProperty({ description: 'Escalation step/level' })
  escalationStep: number;

  @ApiPropertyOptional({ description: 'Escalation reason' })
  escalationReason?: string;

  @ApiProperty({ description: 'Escalated at timestamp' })
  escalatedAt: Date;

  @ApiProperty({ description: 'Last dispatch attempt details' })
  lastDispatchAttempt?: DispatchAttemptDto;
}

export class ManualDispatchResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Message' })
  message: string;

  @ApiProperty({ description: 'Dispatch attempt ID' })
  dispatchAttemptId: string;

  @ApiProperty({ description: 'Assigned pro name' })
  assignedProName: string;
}

export class EscalationOverrideResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Message' })
  message: string;

  @ApiProperty({ description: 'New job status' })
  newStatus: string;
}
