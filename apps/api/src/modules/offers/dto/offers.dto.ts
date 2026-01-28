import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsNumber,
  IsEmail,
  IsUUID,
  IsArray,
  Length,
  Matches,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Offers DTOs for Phase 3 Offer Campaigns
 *
 * Feature Flag: OFFER_CAMPAIGNS_ENABLED
 */

export enum OfferType {
  DISCOUNT_PERCENT = 'DISCOUNT_PERCENT',
  DISCOUNT_FIXED = 'DISCOUNT_FIXED',
  FREE_ADDON = 'FREE_ADDON',
  FREE_CONSULTATION = 'FREE_CONSULTATION',
  SEASONAL = 'SEASONAL',
}

export enum OfferStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
}

// ============================================
// REQUEST DTOS
// ============================================

export class CreateOfferCampaignDto {
  @ApiProperty({ description: 'URL slug for the offer (lowercase, alphanumeric, hyphens)' })
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens only' })
  slug: string;

  @ApiProperty({ description: 'Headline for the offer' })
  @IsString()
  @Length(5, 200)
  headline: string;

  @ApiPropertyOptional({ description: 'Subheadline/description' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  subheadline?: string;

  @ApiProperty({ description: 'Offer type', enum: OfferType })
  @IsEnum(OfferType)
  offerType: OfferType;

  @ApiPropertyOptional({ description: 'Discount value (percent or fixed amount in cents)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiPropertyOptional({ description: 'Service category this offer applies to' })
  @IsOptional()
  @IsUUID()
  serviceCategoryId?: string;

  @ApiPropertyOptional({ description: 'Region ID this offer is valid for' })
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional({ description: 'Hero image URL' })
  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @ApiPropertyOptional({ description: 'Terms and conditions text' })
  @IsOptional()
  @IsString()
  termsText?: string;

  @ApiPropertyOptional({ description: 'Expiration date for the offer' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({ description: 'Requires marketing consent opt-in', default: true })
  @IsBoolean()
  requiresMarketingConsent: boolean;

  @ApiPropertyOptional({ description: 'Custom fields to collect on form' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customFields?: string[];
}

export class UpdateOfferCampaignDto {
  @ApiPropertyOptional({ description: 'URL slug' })
  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens only' })
  slug?: string;

  @ApiPropertyOptional({ description: 'Headline' })
  @IsOptional()
  @IsString()
  @Length(5, 200)
  headline?: string;

  @ApiPropertyOptional({ description: 'Subheadline' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  subheadline?: string;

  @ApiPropertyOptional({ description: 'Status', enum: OfferStatus })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @ApiPropertyOptional({ description: 'Discount value' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiPropertyOptional({ description: 'Hero image URL' })
  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @ApiPropertyOptional({ description: 'Terms text' })
  @IsOptional()
  @IsString()
  termsText?: string;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class SubmitLeadDto {
  @ApiProperty({ description: 'Full name' })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({ description: 'Email address' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Service address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @ApiProperty({ description: 'Marketing consent granted' })
  @IsBoolean()
  marketingConsentGranted: boolean;

  @ApiPropertyOptional({ description: 'Custom field values', type: 'object' })
  @IsOptional()
  customFieldValues?: Record<string, string>;
}

export class UpdateLeadStatusDto {
  @ApiProperty({ description: 'New status', enum: LeadStatus })
  @IsEnum(LeadStatus)
  status: LeadStatus;

  @ApiPropertyOptional({ description: 'Notes about the status change' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class OffersQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: OfferStatus })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @ApiPropertyOptional({ description: 'Filter by service category' })
  @IsOptional()
  @IsUUID()
  serviceCategoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by region' })
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class LeadsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ description: 'Filter by marketing consent' })
  @IsOptional()
  @IsBoolean()
  hasMarketingConsent?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

// ============================================
// RESPONSE DTOS
// ============================================

export class OfferCampaignResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  headline: string;

  @ApiPropertyOptional()
  subheadline?: string;

  @ApiProperty({ enum: OfferType })
  offerType: OfferType;

  @ApiPropertyOptional()
  discountValue?: number;

  @ApiProperty({ enum: OfferStatus })
  status: OfferStatus;

  @ApiPropertyOptional()
  serviceCategoryId?: string;

  @ApiPropertyOptional()
  regionId?: string;

  @ApiPropertyOptional()
  heroImageUrl?: string;

  @ApiPropertyOptional()
  termsText?: string;

  @ApiPropertyOptional()
  expiresAt?: Date;

  @ApiProperty()
  requiresMarketingConsent: boolean;

  @ApiPropertyOptional({ type: 'array' })
  customFields?: string[];

  @ApiProperty()
  leadCount: number;

  @ApiProperty()
  conversionCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class OfferCampaignsListResponseDto {
  @ApiProperty({ type: [OfferCampaignResponseDto] })
  campaigns: OfferCampaignResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class PublicOfferResponseDto {
  @ApiProperty()
  slug: string;

  @ApiProperty()
  headline: string;

  @ApiPropertyOptional()
  subheadline?: string;

  @ApiProperty({ enum: OfferType })
  offerType: OfferType;

  @ApiPropertyOptional()
  discountValue?: number;

  @ApiPropertyOptional()
  heroImageUrl?: string;

  @ApiPropertyOptional()
  termsText?: string;

  @ApiPropertyOptional()
  expiresAt?: Date;

  @ApiProperty()
  requiresMarketingConsent: boolean;

  @ApiPropertyOptional({ type: 'array' })
  customFields?: string[];

  @ApiPropertyOptional({ description: 'Service category details' })
  serviceCategory?: {
    id: string;
    name: string;
    code: string;
  };
}

export class OfferLeadResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  campaignId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ enum: LeadStatus })
  status: LeadStatus;

  @ApiProperty()
  marketingConsentGranted: boolean;

  @ApiPropertyOptional({ type: 'object' })
  customFieldValues?: Record<string, string>;

  @ApiProperty()
  followUpCount: number;

  @ApiPropertyOptional()
  lastContactedAt?: Date;

  @ApiPropertyOptional()
  convertedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class OfferLeadsListResponseDto {
  @ApiProperty({ type: [OfferLeadResponseDto] })
  leads: OfferLeadResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}

export class LeadSubmissionResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  leadId?: string;
}

export class OfferStatsResponseDto {
  @ApiProperty()
  totalLeads: number;

  @ApiProperty()
  newLeads: number;

  @ApiProperty()
  contactedLeads: number;

  @ApiProperty()
  qualifiedLeads: number;

  @ApiProperty()
  convertedLeads: number;

  @ApiProperty()
  conversionRate: number;

  @ApiProperty()
  leadsWithConsent: number;
}
