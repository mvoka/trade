import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEmail,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';

// ============================================
// REQUEST DTOs
// ============================================

/**
 * Consumer/Homeowner registration request
 */
export class RegisterHomeownerDto {
  @ApiProperty({ description: 'Email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Property type',
    enum: ['HOUSE', 'CONDO', 'TOWNHOUSE', 'APARTMENT', 'COMMERCIAL', 'OTHER'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['HOUSE', 'CONDO', 'TOWNHOUSE', 'APARTMENT', 'COMMERCIAL', 'OTHER'])
  propertyType?: string;

  @ApiPropertyOptional({ description: 'Property address line 1' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  propertyAddressLine1?: string;

  @ApiPropertyOptional({ description: 'Property address line 2' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  propertyAddressLine2?: string;

  @ApiPropertyOptional({ description: 'Property city' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  propertyCity?: string;

  @ApiPropertyOptional({ description: 'Property province/state' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  propertyProvince?: string;

  @ApiPropertyOptional({ description: 'Property postal code' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  propertyPostalCode?: string;

  @ApiPropertyOptional({ description: 'Opt-in for marketing communications', default: false })
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}

/**
 * Update consumer profile request
 */
export class UpdateConsumerProfileDto {
  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Property type',
    enum: ['HOUSE', 'CONDO', 'TOWNHOUSE', 'APARTMENT', 'COMMERCIAL', 'OTHER'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['HOUSE', 'CONDO', 'TOWNHOUSE', 'APARTMENT', 'COMMERCIAL', 'OTHER'])
  propertyType?: string;

  @ApiPropertyOptional({ description: 'Property address line 1' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  propertyAddressLine1?: string;

  @ApiPropertyOptional({ description: 'Property address line 2' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  propertyAddressLine2?: string;

  @ApiPropertyOptional({ description: 'Property city' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  propertyCity?: string;

  @ApiPropertyOptional({ description: 'Property province/state' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  propertyProvince?: string;

  @ApiPropertyOptional({ description: 'Property postal code' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  propertyPostalCode?: string;

  @ApiPropertyOptional({ description: 'Property latitude' })
  @IsOptional()
  @IsNumber()
  propertyLat?: number;

  @ApiPropertyOptional({ description: 'Property longitude' })
  @IsOptional()
  @IsNumber()
  propertyLng?: number;

  @ApiPropertyOptional({ description: 'Opt-in for marketing communications' })
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}

// ============================================
// RESPONSE DTOs
// ============================================

/**
 * Consumer profile response
 */
export class ConsumerProfileResponseDto {
  @ApiProperty({ description: 'Consumer profile ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiPropertyOptional({ description: 'Property type' })
  propertyType?: string;

  @ApiPropertyOptional({ description: 'Property address line 1' })
  propertyAddressLine1?: string;

  @ApiPropertyOptional({ description: 'Property address line 2' })
  propertyAddressLine2?: string;

  @ApiPropertyOptional({ description: 'Property city' })
  propertyCity?: string;

  @ApiPropertyOptional({ description: 'Property province/state' })
  propertyProvince?: string;

  @ApiPropertyOptional({ description: 'Property postal code' })
  propertyPostalCode?: string;

  @ApiPropertyOptional({ description: 'Property country' })
  propertyCountry?: string;

  @ApiPropertyOptional({ description: 'Property latitude' })
  propertyLat?: number;

  @ApiPropertyOptional({ description: 'Property longitude' })
  propertyLng?: number;

  @ApiProperty({ description: 'Marketing opt-in status' })
  marketingOptIn: boolean;

  @ApiPropertyOptional({ description: 'Marketing opt-in timestamp' })
  marketingOptInAt?: Date;

  @ApiProperty({ description: 'Active status' })
  isActive: boolean;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

/**
 * Homeowner user response (user + consumer profile)
 */
export class HomeownerResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiPropertyOptional({ description: 'First name' })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  phone?: string;

  @ApiProperty({ description: 'User role' })
  role: string;

  @ApiProperty({ description: 'User type' })
  userType: string;

  @ApiProperty({ description: 'Email verified status' })
  emailVerified: boolean;

  @ApiProperty({ description: 'Active status' })
  isActive: boolean;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Consumer profile' })
  consumerProfile?: ConsumerProfileResponseDto;
}

/**
 * Registration response with tokens
 */
export class HomeownerRegistrationResponseDto {
  @ApiProperty({ description: 'Homeowner profile' })
  user: HomeownerResponseDto;

  @ApiProperty({ description: 'Access token' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token' })
  refreshToken: string;
}

/**
 * Subscription summary for homeowner
 */
export class SubscriptionSummaryDto {
  @ApiProperty({ description: 'Subscription ID' })
  id: string;

  @ApiProperty({ description: 'Service plan name' })
  planName: string;

  @ApiProperty({ description: 'Status' })
  status: string;

  @ApiProperty({ description: 'Start date' })
  startDate: Date;

  @ApiPropertyOptional({ description: 'Next billing date' })
  nextBillingDate?: Date;

  @ApiProperty({ description: 'Price per interval in cents' })
  pricePerIntervalCents: number;

  @ApiProperty({ description: 'Billing interval' })
  billingInterval: string;
}

/**
 * Homeowner subscriptions list response
 */
export class HomeownerSubscriptionsResponseDto {
  @ApiProperty({ description: 'List of subscriptions', type: [SubscriptionSummaryDto] })
  subscriptions: SubscriptionSummaryDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;
}

/**
 * Homeowner jobs list response
 */
export class HomeownerJobsResponseDto {
  @ApiProperty({ description: 'List of jobs' })
  jobs: Array<{
    id: string;
    jobNumber: string;
    title?: string;
    status: string;
    serviceCategory: string;
    scheduledAt?: Date;
    completedAt?: Date;
    createdAt: Date;
  }>;

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
 * Query params for homeowner jobs
 */
export class HomeownerJobsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @IsNumber()
  pageSize?: number;
}
