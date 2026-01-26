import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AttachmentType, JobStatus } from '@trades/shared';

// ============================================
// ENUMS for DTOs
// ============================================

export enum JobUrgency {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  EMERGENCY = 'EMERGENCY',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

// ============================================
// CREATE JOB DTO
// ============================================

export class CreateJobDto {
  @ApiProperty({ description: 'Service category ID' })
  @IsString()
  serviceCategoryId: string;

  @ApiProperty({ description: 'Contact name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  contactName: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ description: 'Contact phone number' })
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  contactPhone: string;

  @ApiPropertyOptional({ description: 'Business name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @ApiProperty({ description: 'Service address line 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  serviceAddressLine1: string;

  @ApiPropertyOptional({ description: 'Service address line 2' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  serviceAddressLine2?: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  serviceCity: string;

  @ApiProperty({ description: 'Province/State' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  serviceProvince: string;

  @ApiProperty({ description: 'Postal code' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  servicePostalCode: string;

  @ApiPropertyOptional({ description: 'Country (default: CA)' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  serviceCountry?: string = 'CA';

  @ApiPropertyOptional({ description: 'Service location latitude' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  serviceLat?: number;

  @ApiPropertyOptional({ description: 'Service location longitude' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  serviceLng?: number;

  @ApiPropertyOptional({ description: 'Job title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ description: 'Job description' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ description: 'Preferred start date/time' })
  @IsOptional()
  @IsDateString()
  preferredDateStart?: string;

  @ApiPropertyOptional({ description: 'Preferred end date/time' })
  @IsOptional()
  @IsDateString()
  preferredDateEnd?: string;

  @ApiPropertyOptional({
    description: 'Job urgency level',
    enum: JobUrgency,
    default: JobUrgency.NORMAL,
  })
  @IsOptional()
  @IsEnum(JobUrgency)
  urgency?: JobUrgency = JobUrgency.NORMAL;

  @ApiPropertyOptional({ description: 'Estimated duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  estimatedDuration?: number;

  @ApiPropertyOptional({ description: 'Internal notes (visible to operators)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;

  @ApiPropertyOptional({ description: 'Before photos storage keys', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  beforePhotoKeys?: string[];
}

// ============================================
// UPDATE JOB DTO
// ============================================

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @ApiPropertyOptional({ description: 'Pipeline stage ID' })
  @IsOptional()
  @IsString()
  pipelineStageId?: string;

  @ApiPropertyOptional({ description: 'Assigned pro profile ID' })
  @IsOptional()
  @IsString()
  assignedProId?: string;
}

// ============================================
// CHANGE STATUS DTO
// ============================================

export class ChangeStatusDto {
  @ApiProperty({
    description: 'New job status',
    enum: ['DRAFT', 'DISPATCHED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  })
  @IsString()
  newStatus: JobStatus;

  @ApiPropertyOptional({ description: 'Reason for status change (required for cancellation)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Additional notes about the status change' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ============================================
// CREATE ATTACHMENT DTO
// ============================================

export class CreateAttachmentDto {
  @ApiProperty({
    description: 'Attachment type',
    enum: ['BEFORE_PHOTO', 'AFTER_PHOTO', 'DOCUMENT', 'OTHER'],
  })
  @IsEnum(AttachmentType)
  type: AttachmentType;

  @ApiProperty({ description: 'File name' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ description: 'File URL/key from storage' })
  @IsString()
  @MinLength(1)
  fileUrl: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @ApiPropertyOptional({ description: 'MIME type' })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

// ============================================
// JOB QUERY DTO (Filters & Pagination)
// ============================================

export class JobQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: 'Sort by field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['DRAFT', 'DISPATCHED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  })
  @IsOptional()
  @IsString()
  status?: JobStatus;

  @ApiPropertyOptional({ description: 'Filter by multiple statuses', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  statuses?: JobStatus[];

  @ApiPropertyOptional({ description: 'Filter by service category ID' })
  @IsOptional()
  @IsString()
  serviceCategoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by urgency', enum: JobUrgency })
  @IsOptional()
  @IsEnum(JobUrgency)
  urgency?: JobUrgency;

  @ApiPropertyOptional({ description: 'Filter by date range start' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by date range end' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search in contact name, business name, or description' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned pro profile ID' })
  @IsOptional()
  @IsString()
  assignedProId?: string;

  @ApiPropertyOptional({ description: 'Filter by pipeline stage ID' })
  @IsOptional()
  @IsString()
  pipelineStageId?: string;

  @ApiPropertyOptional({ description: 'Include only unassigned jobs' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unassignedOnly?: boolean;
}

// ============================================
// COMPLETE JOB DTO
// ============================================

export class CompleteJobDto {
  @ApiProperty({ description: 'After photos storage keys', type: [String] })
  @IsArray()
  @IsString({ each: true })
  afterPhotoKeys: string[];

  @ApiPropertyOptional({ description: 'Completion notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  completionNotes?: string;

  @ApiPropertyOptional({ description: 'Actual duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  actualDuration?: number;
}

// ============================================
// PRESIGNED URL REQUEST DTO
// ============================================

export class PresignedUrlRequestDto {
  @ApiProperty({ description: 'File name' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ description: 'Content type / MIME type' })
  @IsString()
  contentType: string;

  @ApiProperty({
    description: 'Attachment type',
    enum: ['BEFORE_PHOTO', 'AFTER_PHOTO', 'DOCUMENT', 'OTHER'],
  })
  @IsEnum(AttachmentType)
  type: AttachmentType;
}

// ============================================
// RESPONSE DTOs
// ============================================

export class JobAttachmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty({ enum: ['BEFORE_PHOTO', 'AFTER_PHOTO', 'DOCUMENT', 'OTHER'] })
  type: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  fileUrl: string;

  @ApiPropertyOptional()
  fileSize?: number;

  @ApiPropertyOptional()
  mimeType?: string;

  @ApiProperty()
  uploadedAt: Date;
}

export class JobResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobNumber: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  contactName: string;

  @ApiPropertyOptional()
  contactEmail?: string;

  @ApiProperty()
  contactPhone: string;

  @ApiPropertyOptional()
  businessName?: string;

  @ApiProperty()
  serviceAddressLine1: string;

  @ApiPropertyOptional()
  serviceAddressLine2?: string;

  @ApiProperty()
  serviceCity: string;

  @ApiProperty()
  serviceProvince: string;

  @ApiProperty()
  servicePostalCode: string;

  @ApiProperty()
  serviceCountry: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  urgency: string;

  @ApiPropertyOptional()
  preferredDateStart?: Date;

  @ApiPropertyOptional()
  preferredDateEnd?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => [JobAttachmentResponseDto] })
  attachments?: JobAttachmentResponseDto[];
}

export class JobListResponseDto {
  @ApiProperty({ type: [JobResponseDto] })
  jobs: JobResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}
