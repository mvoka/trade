import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Portfolio DTOs for Phase 3 Portfolio Enhancement
 *
 * Feature Flag: PRO_PORTFOLIO_ENABLED
 */

export enum PortfolioTheme {
  DEFAULT = 'DEFAULT',
  MODERN = 'MODERN',
  CLASSIC = 'CLASSIC',
  MINIMAL = 'MINIMAL',
}

// ============================================
// REQUEST DTOS
// ============================================

export class CreatePortfolioDto {
  @ApiProperty({ description: 'URL slug for the portfolio (lowercase, alphanumeric, hyphens)' })
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens only' })
  slug: string;

  @ApiPropertyOptional({ description: 'Portfolio headline' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  headline?: string;

  @ApiPropertyOptional({ description: 'Portfolio bio/description' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  bio?: string;

  @ApiPropertyOptional({ enum: PortfolioTheme, default: PortfolioTheme.DEFAULT })
  @IsOptional()
  @IsEnum(PortfolioTheme)
  theme?: PortfolioTheme;
}

export class UpdatePortfolioSettingsDto {
  @ApiPropertyOptional({ description: 'URL slug for the portfolio' })
  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens only' })
  slug?: string;

  @ApiPropertyOptional({ description: 'Portfolio headline' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  headline?: string;

  @ApiPropertyOptional({ description: 'Portfolio bio/description' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  bio?: string;

  @ApiPropertyOptional({ description: 'Display email on portfolio' })
  @IsOptional()
  @IsString()
  displayEmail?: string;

  @ApiPropertyOptional({ description: 'Display phone on portfolio' })
  @IsOptional()
  @IsString()
  displayPhone?: string;

  @ApiPropertyOptional({ description: 'Show reviews on portfolio' })
  @IsOptional()
  @IsBoolean()
  showReviews?: boolean;

  @ApiPropertyOptional({ enum: PortfolioTheme })
  @IsOptional()
  @IsEnum(PortfolioTheme)
  theme?: PortfolioTheme;

  @ApiPropertyOptional({ description: 'Social media links', type: 'object' })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}

export class AddPortfolioItemFromJobDto {
  @ApiProperty({ description: 'Job ID to add to portfolio' })
  @IsUUID()
  jobId: string;

  @ApiPropertyOptional({ description: 'Custom title for the item' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  title?: string;

  @ApiPropertyOptional({ description: 'Custom description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Specific photo URLs to include' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @ApiProperty({ description: 'Customer opt-in granted for public display' })
  @IsBoolean()
  customerOptIn: boolean;
}

export class RequestCustomerOptInDto {
  @ApiProperty({ description: 'Job ID to request opt-in for' })
  @IsUUID()
  jobId: string;

  @ApiPropertyOptional({ description: 'Custom message to customer' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  message?: string;
}

// ============================================
// RESPONSE DTOS
// ============================================

export class PortfolioResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  proProfileId: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ enum: PortfolioTheme })
  theme: PortfolioTheme;

  @ApiProperty()
  isPublished: boolean;

  @ApiPropertyOptional()
  headline?: string;

  @ApiPropertyOptional()
  bio?: string;

  @ApiPropertyOptional()
  displayEmail?: string;

  @ApiPropertyOptional()
  displayPhone?: string;

  @ApiProperty()
  showReviews: boolean;

  @ApiPropertyOptional({ type: 'object' })
  socialLinks?: Record<string, string>;

  @ApiProperty()
  viewCount: number;

  @ApiPropertyOptional()
  publishedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PublicPortfolioResponseDto {
  @ApiProperty()
  slug: string;

  @ApiProperty({ enum: PortfolioTheme })
  theme: PortfolioTheme;

  @ApiPropertyOptional()
  headline?: string;

  @ApiPropertyOptional()
  bio?: string;

  @ApiPropertyOptional()
  displayEmail?: string;

  @ApiPropertyOptional()
  displayPhone?: string;

  @ApiProperty()
  showReviews: boolean;

  @ApiPropertyOptional({ type: 'object' })
  socialLinks?: Record<string, string>;

  @ApiProperty({ description: 'Pro profile information' })
  proProfile: {
    businessName?: string;
    avatarUrl?: string;
    verificationBadge?: string;
    serviceCategories: string[];
    averageRating?: number;
    totalReviews?: number;
  };

  @ApiProperty({ description: 'Portfolio items', type: 'array' })
  items: PublicPortfolioItemDto[];

  @ApiPropertyOptional({ description: 'Reviews (if showReviews is true)', type: 'array' })
  reviews?: PublicReviewDto[];
}

export class PublicPortfolioItemDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  mediaUrl: string;

  @ApiPropertyOptional()
  mediaType?: string;

  @ApiProperty()
  sortOrder: number;

  @ApiPropertyOptional()
  serviceCategory?: string;

  @ApiProperty()
  createdAt: Date;
}

export class PublicReviewDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  rating: number;

  @ApiPropertyOptional()
  comment?: string;

  @ApiProperty()
  reviewerName: string;

  @ApiProperty()
  createdAt: Date;
}

export class PortfolioOptInRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  message?: string;

  @ApiProperty()
  requestedAt: Date;

  @ApiPropertyOptional()
  respondedAt?: Date;
}

export class PortfolioStatsResponseDto {
  @ApiProperty()
  totalViews: number;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  publishedItems: number;

  @ApiProperty()
  pendingOptIns: number;

  @ApiProperty()
  isPublished: boolean;

  @ApiPropertyOptional()
  lastViewedAt?: Date;
}
