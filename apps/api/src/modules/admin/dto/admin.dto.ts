import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsDateString,
  IsObject,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ============================================
// DECLINE REASON DTOs
// ============================================

export class CreateDeclineReasonDto {
  @ApiProperty({
    description: 'Unique code for the decline reason',
    example: 'TOO_FAR',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code: string;

  @ApiProperty({
    description: 'Human-readable label for the decline reason',
    example: 'Location too far away',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label: string;

  @ApiPropertyOptional({
    description: 'Additional description for the decline reason',
    example: 'The job location is outside the contractor service area',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Sort order for display purposes',
    example: 1,
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether the decline reason is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateDeclineReasonDto {
  @ApiPropertyOptional({
    description: 'Human-readable label for the decline reason',
    example: 'Location too far away',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({
    description: 'Additional description for the decline reason',
    example: 'The job location is outside the contractor service area',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Sort order for display purposes',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether the decline reason is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class DeclineReasonResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  id: string;

  @ApiProperty({ description: 'Unique code' })
  code: string;

  @ApiProperty({ description: 'Human-readable label' })
  label: string;

  @ApiPropertyOptional({ description: 'Description' })
  description: string | null;

  @ApiProperty({ description: 'Sort order' })
  sortOrder: number;

  @ApiProperty({ description: 'Whether active' })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

// ============================================
// JOB TEMPLATE DTOs
// ============================================

export class CreateJobTemplateDto {
  @ApiProperty({
    description: 'Name of the job template',
    example: 'Standard Electrical Inspection',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the job template',
    example: 'Standard inspection for residential electrical systems',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Service category code this template applies to',
    example: 'ELECTRICAL',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  categoryCode?: string;

  @ApiProperty({
    description: 'Template content with fields and structure',
    example: {
      title: 'Electrical Inspection',
      defaultDescription: 'Standard electrical inspection service',
      checklist: ['Check panel', 'Test outlets', 'Inspect wiring'],
      requiredFields: ['contactName', 'contactPhone', 'serviceAddress'],
    },
  })
  @IsObject()
  templateContent: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Estimated duration in minutes',
    example: 60,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(480) // 8 hours max
  @IsOptional()
  estimatedDuration?: number;

  @ApiPropertyOptional({
    description: 'Whether the template is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateJobTemplateDto {
  @ApiPropertyOptional({
    description: 'Name of the job template',
    example: 'Standard Electrical Inspection',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the job template',
    example: 'Standard inspection for residential electrical systems',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Service category code this template applies to',
    example: 'ELECTRICAL',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  categoryCode?: string;

  @ApiPropertyOptional({
    description: 'Template content with fields and structure',
    example: {
      title: 'Electrical Inspection',
      defaultDescription: 'Standard electrical inspection service',
      checklist: ['Check panel', 'Test outlets', 'Inspect wiring'],
      requiredFields: ['contactName', 'contactPhone', 'serviceAddress'],
    },
  })
  @IsObject()
  @IsOptional()
  templateContent?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Estimated duration in minutes',
    example: 60,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(480)
  @IsOptional()
  estimatedDuration?: number;

  @ApiPropertyOptional({
    description: 'Whether the template is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class JobTemplateResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  id: string;

  @ApiProperty({ description: 'Template name' })
  name: string;

  @ApiPropertyOptional({ description: 'Description' })
  description: string | null;

  @ApiPropertyOptional({ description: 'Category code' })
  categoryCode: string | null;

  @ApiProperty({ description: 'Template content' })
  templateContent: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Estimated duration in minutes' })
  estimatedDuration: number | null;

  @ApiProperty({ description: 'Whether active' })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

// ============================================
// DISPATCH LOG QUERY DTO
// ============================================

export class DispatchLogQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by job ID',
    example: 'clx1234567890',
  })
  @IsString()
  @IsOptional()
  jobId?: string;

  @ApiPropertyOptional({
    description: 'Filter by pro profile ID',
    example: 'clx9876543210',
  })
  @IsString()
  @IsOptional()
  proProfileId?: string;

  @ApiPropertyOptional({
    description: 'Filter by dispatch attempt status',
    example: 'DECLINED',
    enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'TIMEOUT', 'CANCELLED'],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by decline reason ID',
    example: 'clx1111111111',
  })
  @IsString()
  @IsOptional()
  declineReasonId?: string;

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
    example: 'dispatchedAt',
    default: 'dispatchedAt',
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'dispatchedAt';

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

export class DispatchLogResponseDto {
  @ApiProperty({ description: 'Dispatch attempt ID' })
  id: string;

  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiProperty({ description: 'Pro profile ID' })
  proProfileId: string;

  @ApiProperty({ description: 'Attempt number' })
  attemptNumber: number;

  @ApiProperty({ description: 'Dispatch status' })
  status: string;

  @ApiPropertyOptional({ description: 'Decline reason ID' })
  declineReasonId: string | null;

  @ApiPropertyOptional({ description: 'Decline notes' })
  declineNotes: string | null;

  @ApiProperty({ description: 'When dispatched' })
  dispatchedAt: Date;

  @ApiPropertyOptional({ description: 'When responded' })
  respondedAt: Date | null;

  @ApiProperty({ description: 'SLA deadline' })
  slaDeadline: Date;

  @ApiPropertyOptional({ description: 'Ranking score' })
  ranking: number | null;

  @ApiPropertyOptional({ description: 'Distance in km' })
  distance: number | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Job details' })
  job?: {
    id: string;
    jobNumber: string;
    title: string | null;
    status: string;
  };

  @ApiPropertyOptional({ description: 'Pro profile details' })
  proProfile?: {
    id: string;
    businessName: string | null;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    };
  };

  @ApiPropertyOptional({ description: 'Decline reason details' })
  declineReason?: {
    id: string;
    code: string;
    label: string;
  } | null;
}

export class PaginatedDispatchLogResponseDto {
  @ApiProperty({
    description: 'Array of dispatch logs',
    type: [DispatchLogResponseDto],
  })
  data: DispatchLogResponseDto[];

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

// ============================================
// SLA BREACH QUERY DTO
// ============================================

export class SlaBreachQueryDto {
  @ApiProperty({
    description: 'Start date for the report (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  dateFrom: string;

  @ApiProperty({
    description: 'End date for the report (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
  })
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional({
    description: 'Filter by service category ID',
    example: 'clx1234567890',
  })
  @IsString()
  @IsOptional()
  serviceCategoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by region ID',
    example: 'clx9876543210',
  })
  @IsString()
  @IsOptional()
  regionId?: string;
}

export class SlaBreachItemDto {
  @ApiProperty({ description: 'Dispatch attempt ID' })
  id: string;

  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiProperty({ description: 'Job number' })
  jobNumber: string;

  @ApiProperty({ description: 'Pro profile ID' })
  proProfileId: string;

  @ApiPropertyOptional({ description: 'Pro business name' })
  proBusinessName: string | null;

  @ApiProperty({ description: 'When dispatched' })
  dispatchedAt: Date;

  @ApiProperty({ description: 'SLA deadline' })
  slaDeadline: Date;

  @ApiPropertyOptional({ description: 'When responded' })
  respondedAt: Date | null;

  @ApiProperty({ description: 'Breach duration in minutes' })
  breachMinutes: number;

  @ApiProperty({ description: 'Final status' })
  status: string;
}

export class SlaBreachReportDto {
  @ApiProperty({ description: 'Report date range start' })
  dateFrom: Date;

  @ApiProperty({ description: 'Report date range end' })
  dateTo: Date;

  @ApiProperty({ description: 'Total dispatch attempts in period' })
  totalDispatchAttempts: number;

  @ApiProperty({ description: 'Total SLA breaches' })
  totalBreaches: number;

  @ApiProperty({ description: 'Breach rate percentage' })
  breachRate: number;

  @ApiProperty({ description: 'Average breach duration in minutes' })
  avgBreachMinutes: number;

  @ApiProperty({
    description: 'List of SLA breach items',
    type: [SlaBreachItemDto],
  })
  breaches: SlaBreachItemDto[];
}

// ============================================
// DASHBOARD STATS DTO
// ============================================

export class DashboardStatsDto {
  @ApiProperty({
    description: 'Job statistics',
    example: {
      total: 1500,
      draft: 50,
      dispatched: 100,
      accepted: 200,
      scheduled: 150,
      inProgress: 75,
      completed: 900,
      cancelled: 25,
    },
  })
  jobs: {
    total: number;
    draft: number;
    dispatched: number;
    accepted: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };

  @ApiProperty({
    description: 'Pro statistics',
    example: {
      total: 250,
      verified: 200,
      pending: 40,
      denied: 10,
      active: 180,
    },
  })
  pros: {
    total: number;
    verified: number;
    pending: number;
    denied: number;
    active: number;
  };

  @ApiProperty({
    description: 'Booking statistics',
    example: {
      total: 800,
      pendingConfirmation: 50,
      confirmed: 600,
      completed: 100,
      cancelled: 30,
      noShow: 20,
    },
  })
  bookings: {
    total: number;
    pendingConfirmation: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };

  @ApiProperty({
    description: 'Dispatch statistics',
    example: {
      totalAttempts: 2000,
      acceptedRate: 75.5,
      declinedRate: 15.2,
      timeoutRate: 9.3,
      avgResponseMinutes: 3.5,
    },
  })
  dispatch: {
    totalAttempts: number;
    acceptedRate: number;
    declinedRate: number;
    timeoutRate: number;
    avgResponseMinutes: number;
  };

  @ApiProperty({
    description: 'User statistics',
    example: {
      totalUsers: 5000,
      smbUsers: 4500,
      proUsers: 250,
      admins: 10,
      operators: 240,
    },
  })
  users: {
    totalUsers: number;
    smbUsers: number;
    proUsers: number;
    admins: number;
    operators: number;
  };

  @ApiProperty({ description: 'Stats generation timestamp' })
  generatedAt: Date;
}
