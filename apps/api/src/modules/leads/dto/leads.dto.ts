import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsDateString,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { LeadSource, LeadStatus } from '@trades/shared';

// ============================================
// REQUEST DTOs
// ============================================

export class WebLeadDto {
  @ApiProperty({
    description: 'Contact name',
    example: 'John Smith',
  })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  contactName: string;

  @ApiPropertyOptional({
    description: 'Contact email address',
    example: 'john.smith@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  contactEmail?: string;

  @ApiProperty({
    description: 'Contact phone number',
    example: '+1-416-555-0123',
  })
  @IsString()
  @MinLength(10, { message: 'Phone number must be at least 10 characters' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  contactPhone: string;

  @ApiPropertyOptional({
    description: 'Business name (if applicable)',
    example: 'Smith & Co.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Business name must not exceed 200 characters' })
  businessName?: string;

  @ApiProperty({
    description: 'Service address line 1',
    example: '123 Main Street',
  })
  @IsString()
  @MinLength(5, { message: 'Address must be at least 5 characters' })
  @MaxLength(200, { message: 'Address must not exceed 200 characters' })
  serviceAddressLine1: string;

  @ApiPropertyOptional({
    description: 'Service address line 2 (unit, suite, etc.)',
    example: 'Unit 4B',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Address line 2 must not exceed 100 characters' })
  serviceAddressLine2?: string;

  @ApiProperty({
    description: 'City',
    example: 'Toronto',
  })
  @IsString()
  @MinLength(2, { message: 'City must be at least 2 characters' })
  @MaxLength(100, { message: 'City must not exceed 100 characters' })
  serviceCity: string;

  @ApiProperty({
    description: 'Province code',
    example: 'ON',
  })
  @IsString()
  @MinLength(2, { message: 'Province must be at least 2 characters' })
  @MaxLength(50, { message: 'Province must not exceed 50 characters' })
  serviceProvince: string;

  @ApiProperty({
    description: 'Postal code',
    example: 'M5V 2T6',
  })
  @IsString()
  @Matches(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, {
    message: 'Please provide a valid Canadian postal code',
  })
  servicePostalCode: string;

  @ApiPropertyOptional({
    description: 'Country code',
    example: 'CA',
    default: 'CA',
  })
  @IsString()
  @IsOptional()
  serviceCountry?: string;

  @ApiProperty({
    description: 'Service category code',
    example: 'PLUMBING',
  })
  @IsString()
  @MinLength(1, { message: 'Service category is required' })
  @MaxLength(50, { message: 'Service category must not exceed 50 characters' })
  serviceCategory: string;

  @ApiProperty({
    description: 'Description of the service needed',
    example: 'Leaking faucet in the kitchen that needs immediate repair',
  })
  @IsString()
  @MinLength(10, { message: 'Description must be at least 10 characters' })
  @MaxLength(2000, { message: 'Description must not exceed 2000 characters' })
  description: string;

  @ApiPropertyOptional({
    description: 'Preferred start date for service',
    example: '2025-02-01T09:00:00Z',
  })
  @IsDateString({}, { message: 'Please provide a valid date' })
  @IsOptional()
  preferredDateStart?: string;

  @ApiPropertyOptional({
    description: 'Preferred end date for service',
    example: '2025-02-07T17:00:00Z',
  })
  @IsDateString({}, { message: 'Please provide a valid date' })
  @IsOptional()
  preferredDateEnd?: string;

  @ApiPropertyOptional({
    description: 'Urgency level',
    enum: ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'],
    default: 'NORMAL',
  })
  @IsEnum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'], {
    message: 'Urgency must be one of: LOW, NORMAL, HIGH, EMERGENCY',
  })
  @IsOptional()
  urgency?: 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';
}

export class WebhookLeadDto {
  @ApiProperty({
    description: 'Source identifier for the webhook',
    example: 'partner_abc',
  })
  @IsString()
  @MinLength(1, { message: 'Source is required' })
  @MaxLength(100, { message: 'Source must not exceed 100 characters' })
  source: string;

  @ApiProperty({
    description: 'Raw payload data from the webhook source',
    example: {
      name: 'John Smith',
      phone: '416-555-0123',
      service: 'plumbing',
      message: 'Need help with a leaking pipe',
    },
  })
  @IsObject({ message: 'Payload must be an object' })
  payload: Record<string, unknown>;
}

export class EmailLeadDto {
  @ApiProperty({
    description: 'Raw email payload from the email parsing service',
    example: {
      from: 'customer@example.com',
      subject: 'Service Request',
      body: 'I need help with plumbing',
      receivedAt: '2025-01-20T10:30:00Z',
    },
  })
  @IsObject({ message: 'Payload must be an object' })
  payload: Record<string, unknown>;
}

export class LeadQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by lead status',
    enum: LeadStatus,
  })
  @IsEnum(LeadStatus, { message: 'Invalid lead status' })
  @IsOptional()
  status?: LeadStatus;

  @ApiPropertyOptional({
    description: 'Filter by lead source',
    enum: LeadSource,
  })
  @IsEnum(LeadSource, { message: 'Invalid lead source' })
  @IsOptional()
  source?: LeadSource;

  @ApiPropertyOptional({
    description: 'Filter by service category',
    example: 'PLUMBING',
  })
  @IsString()
  @IsOptional()
  serviceCategory?: string;

  @ApiPropertyOptional({
    description: 'Search by contact email',
    example: 'john@example.com',
  })
  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional({
    description: 'Search by contact phone',
    example: '+1-416-555-0123',
  })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional({
    description: 'Filter from date (ISO string)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (ISO string)',
    example: '2025-01-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size',
    example: 20,
    default: 20,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

export class ConvertLeadDto {
  @ApiPropertyOptional({
    description: 'Service category ID to use for the job (overrides lead category)',
    example: 'clxyz123456',
  })
  @IsString()
  @IsOptional()
  serviceCategoryId?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the job',
    example: 'Customer prefers afternoon appointments',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  internalNotes?: string;

  @ApiPropertyOptional({
    description: 'Override job title',
    example: 'Kitchen Faucet Repair',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;
}

// ============================================
// RESPONSE DTOs
// ============================================

export class LeadRawResponseDto {
  @ApiProperty({ description: 'Lead raw ID' })
  id: string;

  @ApiProperty({ description: 'Lead source', enum: LeadSource })
  source: LeadSource;

  @ApiProperty({ description: 'Raw payload data' })
  rawPayload: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Client IP address' })
  ipAddress?: string | null;

  @ApiPropertyOptional({ description: 'Client user agent' })
  userAgent?: string | null;

  @ApiProperty({ description: 'Received timestamp' })
  receivedAt: Date;

  @ApiPropertyOptional({ description: 'Processed timestamp' })
  processedAt?: Date | null;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
}

export class LeadNormalizedResponseDto {
  @ApiProperty({ description: 'Lead normalized ID' })
  id: string;

  @ApiPropertyOptional({ description: 'Associated raw lead ID' })
  leadRawId?: string | null;

  @ApiProperty({ description: 'Lead status', enum: LeadStatus })
  status: LeadStatus;

  @ApiPropertyOptional({ description: 'Contact name' })
  contactName?: string | null;

  @ApiPropertyOptional({ description: 'Contact email' })
  contactEmail?: string | null;

  @ApiPropertyOptional({ description: 'Contact phone' })
  contactPhone?: string | null;

  @ApiPropertyOptional({ description: 'Business name' })
  businessName?: string | null;

  @ApiPropertyOptional({ description: 'Service address' })
  serviceAddress?: string | null;

  @ApiPropertyOptional({ description: 'Service latitude' })
  serviceLat?: number | null;

  @ApiPropertyOptional({ description: 'Service longitude' })
  serviceLng?: number | null;

  @ApiPropertyOptional({ description: 'Service category' })
  serviceCategory?: string | null;

  @ApiPropertyOptional({ description: 'Service description' })
  description?: string | null;

  @ApiPropertyOptional({ description: 'Preferred start date' })
  preferredDateStart?: Date | null;

  @ApiPropertyOptional({ description: 'Preferred end date' })
  preferredDateEnd?: Date | null;

  @ApiPropertyOptional({ description: 'Urgency level' })
  urgency?: string | null;

  @ApiPropertyOptional({ description: 'Fingerprint for deduplication' })
  fingerprint?: string | null;

  @ApiPropertyOptional({ description: 'ID of duplicate lead if this is a duplicate' })
  duplicateOfId?: string | null;

  @ApiPropertyOptional({ description: 'Converted job ID' })
  convertedToJobId?: string | null;

  @ApiPropertyOptional({ description: 'Conversion timestamp' })
  convertedAt?: Date | null;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Associated raw lead data', type: LeadRawResponseDto })
  leadRaw?: LeadRawResponseDto | null;
}

export class LeadSubmitResponseDto {
  @ApiProperty({ description: 'Lead ID' })
  id: string;

  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiPropertyOptional({ description: 'Normalized lead ID if processed immediately' })
  normalizedLeadId?: string;
}

export class LeadConvertResponseDto {
  @ApiProperty({ description: 'Normalized lead ID' })
  leadId: string;

  @ApiProperty({ description: 'Created job ID' })
  jobId: string;

  @ApiProperty({ description: 'Job number' })
  jobNumber: string;

  @ApiProperty({ description: 'Success message' })
  message: string;
}

export class PaginatedLeadsResponseDto {
  @ApiProperty({
    description: 'List of leads',
    type: [LeadNormalizedResponseDto],
  })
  data: LeadNormalizedResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
  })
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
