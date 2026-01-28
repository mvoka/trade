import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsDateString,
  IsIn,
  Min,
  MaxLength,
} from 'class-validator';

// ============================================
// ENUMS
// ============================================

export enum BillingIntervalDto {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
  ONE_TIME = 'ONE_TIME',
}

export enum SubscriptionStatusDto {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  PAST_DUE = 'PAST_DUE',
  TRIAL = 'TRIAL',
}

export enum DayOfWeekDto {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

// ============================================
// SERVICE PLAN DTOs
// ============================================

/**
 * Create service plan request
 */
export class CreateServicePlanDto {
  @ApiProperty({ description: 'Plan name' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Plan description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Billing interval', enum: BillingIntervalDto })
  @IsEnum(BillingIntervalDto)
  billingInterval: BillingIntervalDto;

  @ApiProperty({ description: 'Price per interval in cents', minimum: 0 })
  @IsNumber()
  @Min(0)
  pricePerIntervalCents: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'CAD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Service template (job creation config)' })
  serviceTemplate: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Visits per billing interval', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  visitsPerInterval?: number;

  @ApiPropertyOptional({ description: 'Estimated duration in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  estimatedDurationMins?: number;

  @ApiPropertyOptional({ description: 'Service category ID' })
  @IsOptional()
  @IsString()
  serviceCategoryId?: string;

  @ApiPropertyOptional({ description: 'Make plan publicly visible', default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

/**
 * Update service plan request
 */
export class UpdateServicePlanDto {
  @ApiPropertyOptional({ description: 'Plan name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Plan description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Price per interval in cents' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerIntervalCents?: number;

  @ApiPropertyOptional({ description: 'Service template' })
  @IsOptional()
  serviceTemplate?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Visits per billing interval' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  visitsPerInterval?: number;

  @ApiPropertyOptional({ description: 'Estimated duration in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  estimatedDurationMins?: number;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Public visibility' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

/**
 * Service plan response
 */
export class ServicePlanResponseDto {
  @ApiProperty({ description: 'Plan ID' })
  id: string;

  @ApiProperty({ description: 'Plan name' })
  name: string;

  @ApiPropertyOptional({ description: 'Plan description' })
  description?: string;

  @ApiProperty({ description: 'Billing interval' })
  billingInterval: string;

  @ApiProperty({ description: 'Price per interval in cents' })
  pricePerIntervalCents: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Service template' })
  serviceTemplate: Record<string, unknown>;

  @ApiProperty({ description: 'Visits per interval' })
  visitsPerInterval: number;

  @ApiPropertyOptional({ description: 'Estimated duration in minutes' })
  estimatedDurationMins?: number;

  @ApiPropertyOptional({ description: 'Service category ID' })
  serviceCategoryId?: string;

  @ApiPropertyOptional({ description: 'Pro profile ID (if pro-specific plan)' })
  proProfileId?: string;

  @ApiProperty({ description: 'Active status' })
  isActive: boolean;

  @ApiProperty({ description: 'Public visibility' })
  isPublic: boolean;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

/**
 * Service plans list response
 */
export class ServicePlansListResponseDto {
  @ApiProperty({ description: 'List of service plans', type: [ServicePlanResponseDto] })
  plans: ServicePlanResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;
}

// ============================================
// SUBSCRIPTION DTOs
// ============================================

/**
 * Create subscription request
 */
export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Service plan ID' })
  @IsString()
  servicePlanId: string;

  @ApiPropertyOptional({ description: 'Preferred day of week for service', enum: DayOfWeekDto })
  @IsOptional()
  @IsEnum(DayOfWeekDto)
  preferredDayOfWeek?: DayOfWeekDto;

  @ApiPropertyOptional({ description: 'Preferred time slot (HH:mm format)' })
  @IsOptional()
  @IsString()
  preferredTimeSlot?: string;

  @ApiPropertyOptional({ description: 'Start date (defaults to now)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

/**
 * Subscription response
 */
export class SubscriptionResponseDto {
  @ApiProperty({ description: 'Subscription ID' })
  id: string;

  @ApiProperty({ description: 'Consumer profile ID' })
  consumerProfileId: string;

  @ApiProperty({ description: 'Service plan ID' })
  servicePlanId: string;

  @ApiProperty({ description: 'Service plan details' })
  servicePlan: ServicePlanResponseDto;

  @ApiProperty({ description: 'Status' })
  status: string;

  @ApiProperty({ description: 'Start date' })
  startDate: Date;

  @ApiPropertyOptional({ description: 'End date' })
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Paused timestamp' })
  pausedAt?: Date;

  @ApiPropertyOptional({ description: 'Cancelled timestamp' })
  cancelledAt?: Date;

  @ApiPropertyOptional({ description: 'Cancel reason' })
  cancelReason?: string;

  @ApiPropertyOptional({ description: 'Stripe subscription ID' })
  stripeSubscriptionId?: string;

  @ApiPropertyOptional({ description: 'Next billing date' })
  nextBillingDate?: Date;

  @ApiPropertyOptional({ description: 'Last billing date' })
  lastBillingDate?: Date;

  @ApiPropertyOptional({ description: 'Preferred day of week' })
  preferredDayOfWeek?: string;

  @ApiPropertyOptional({ description: 'Preferred time slot' })
  preferredTimeSlot?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

/**
 * Pause subscription request
 */
export class PauseSubscriptionDto {
  @ApiPropertyOptional({ description: 'Reason for pausing' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * Cancel subscription request
 */
export class CancelSubscriptionDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Cancel immediately (vs end of period)', default: false })
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;
}

/**
 * Stripe checkout session response
 */
export class CheckoutSessionResponseDto {
  @ApiProperty({ description: 'Stripe checkout session ID' })
  sessionId: string;

  @ApiProperty({ description: 'Checkout URL' })
  checkoutUrl: string;
}

// ============================================
// SERVICE OCCURRENCE DTOs
// ============================================

/**
 * Service occurrence response
 */
export class ServiceOccurrenceResponseDto {
  @ApiProperty({ description: 'Occurrence ID' })
  id: string;

  @ApiProperty({ description: 'Subscription ID' })
  subscriptionId: string;

  @ApiProperty({ description: 'Scheduled date' })
  scheduledDate: Date;

  @ApiPropertyOptional({ description: 'Scheduled time slot' })
  scheduledTimeSlot?: string;

  @ApiProperty({ description: 'Occurrence number in sequence' })
  occurrenceNumber: number;

  @ApiProperty({ description: 'Status' })
  status: string;

  @ApiPropertyOptional({ description: 'Job ID (when created)' })
  jobId?: string;

  @ApiPropertyOptional({ description: 'Job created timestamp' })
  jobCreatedAt?: Date;

  @ApiPropertyOptional({ description: 'Completed timestamp' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Skip reason' })
  skipReason?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  notes?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
}

/**
 * Occurrences list response
 */
export class OccurrencesListResponseDto {
  @ApiProperty({ description: 'List of occurrences', type: [ServiceOccurrenceResponseDto] })
  occurrences: ServiceOccurrenceResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Page size' })
  pageSize: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;
}

/**
 * Skip occurrence request
 */
export class SkipOccurrenceDto {
  @ApiProperty({ description: 'Reason for skipping' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

/**
 * Reschedule occurrence request
 */
export class RescheduleOccurrenceDto {
  @ApiProperty({ description: 'New scheduled date' })
  @IsDateString()
  newDate: string;

  @ApiPropertyOptional({ description: 'New time slot (HH:mm format)' })
  @IsOptional()
  @IsString()
  newTimeSlot?: string;
}

// ============================================
// QUERY DTOs
// ============================================

/**
 * Service plans query params
 */
export class ServicePlansQueryDto {
  @ApiPropertyOptional({ description: 'Filter by service category ID' })
  @IsOptional()
  @IsString()
  serviceCategoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by billing interval' })
  @IsOptional()
  @IsString()
  billingInterval?: string;

  @ApiPropertyOptional({ description: 'Include inactive plans', default: false })
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}

/**
 * Occurrences query params
 */
export class OccurrencesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter from date' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter to date' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @IsNumber()
  pageSize?: number;
}
