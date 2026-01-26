import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { ScopeType } from '@trades/shared';

// ============================================
// SCOPE CONTEXT DTO
// ============================================

export class ScopeContextDto {
  @ApiPropertyOptional({
    description: 'Region ID for scope resolution',
    example: 'region_abc123',
  })
  @IsString()
  @IsOptional()
  regionId?: string;

  @ApiPropertyOptional({
    description: 'Organization ID for scope resolution',
    example: 'org_xyz789',
  })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({
    description: 'Service Category ID for scope resolution',
    example: 'svc_cat_456',
  })
  @IsString()
  @IsOptional()
  serviceCategoryId?: string;
}

// ============================================
// FEATURE FLAG DTOs
// ============================================

export class CreateFeatureFlagDto {
  @ApiProperty({
    description: 'Feature flag key identifier',
    example: 'DISPATCH_ENABLED',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Key is required' })
  key: string;

  @ApiPropertyOptional({
    description: 'Human-readable description of the feature flag',
    example: 'Enables the dispatch functionality for this scope',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Whether the feature flag is enabled',
    example: true,
    default: false,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Scope type for the feature flag',
    enum: ['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'],
    example: 'GLOBAL',
  })
  @IsEnum(['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'], {
    message: 'Scope type must be GLOBAL, REGION, ORG, or SERVICE_CATEGORY',
  })
  scopeType: ScopeType;

  @ApiPropertyOptional({
    description: 'Region ID (required if scopeType is REGION)',
    example: 'region_abc123',
  })
  @IsString()
  @IsOptional()
  regionId?: string;

  @ApiPropertyOptional({
    description: 'Organization ID (required if scopeType is ORG)',
    example: 'org_xyz789',
  })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({
    description: 'Service Category ID (required if scopeType is SERVICE_CATEGORY)',
    example: 'svc_cat_456',
  })
  @IsString()
  @IsOptional()
  serviceCategoryId?: string;
}

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional({
    description: 'Human-readable description of the feature flag',
    example: 'Enables the dispatch functionality for this scope',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the feature flag is enabled',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Scope type for the feature flag',
    enum: ['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'],
    example: 'GLOBAL',
  })
  @IsEnum(['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'], {
    message: 'Scope type must be GLOBAL, REGION, ORG, or SERVICE_CATEGORY',
  })
  @IsOptional()
  scopeType?: ScopeType;

  @ApiPropertyOptional({
    description: 'Region ID (required if scopeType is REGION)',
    example: 'region_abc123',
  })
  @IsString()
  @IsOptional()
  regionId?: string;

  @ApiPropertyOptional({
    description: 'Organization ID (required if scopeType is ORG)',
    example: 'org_xyz789',
  })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({
    description: 'Service Category ID (required if scopeType is SERVICE_CATEGORY)',
    example: 'svc_cat_456',
  })
  @IsString()
  @IsOptional()
  serviceCategoryId?: string;
}

// ============================================
// POLICY DTOs
// ============================================

export class CreatePolicyDto {
  @ApiProperty({
    description: 'Policy key identifier',
    example: 'SLA_ACCEPT_MINUTES',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Key is required' })
  key: string;

  @ApiPropertyOptional({
    description: 'Human-readable description of the policy',
    example: 'Number of minutes a pro has to accept a dispatch',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Policy value (JSON - can be string, number, boolean, array, or object)',
    example: 5,
  })
  @IsNotEmpty()
  value: unknown;

  @ApiProperty({
    description: 'Scope type for the policy',
    enum: ['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'],
    example: 'GLOBAL',
  })
  @IsEnum(['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'], {
    message: 'Scope type must be GLOBAL, REGION, ORG, or SERVICE_CATEGORY',
  })
  scopeType: ScopeType;

  @ApiPropertyOptional({
    description: 'Region ID (required if scopeType is REGION)',
    example: 'region_abc123',
  })
  @IsString()
  @IsOptional()
  regionId?: string;

  @ApiPropertyOptional({
    description: 'Organization ID (required if scopeType is ORG)',
    example: 'org_xyz789',
  })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({
    description: 'Service Category ID (required if scopeType is SERVICE_CATEGORY)',
    example: 'svc_cat_456',
  })
  @IsString()
  @IsOptional()
  serviceCategoryId?: string;
}

export class UpdatePolicyDto {
  @ApiPropertyOptional({
    description: 'Human-readable description of the policy',
    example: 'Number of minutes a pro has to accept a dispatch',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Policy value (JSON - can be string, number, boolean, array, or object)',
    example: 10,
  })
  @IsOptional()
  value?: unknown;

  @ApiPropertyOptional({
    description: 'Scope type for the policy',
    enum: ['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'],
    example: 'GLOBAL',
  })
  @IsEnum(['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'], {
    message: 'Scope type must be GLOBAL, REGION, ORG, or SERVICE_CATEGORY',
  })
  @IsOptional()
  scopeType?: ScopeType;

  @ApiPropertyOptional({
    description: 'Region ID (required if scopeType is REGION)',
    example: 'region_abc123',
  })
  @IsString()
  @IsOptional()
  regionId?: string;

  @ApiPropertyOptional({
    description: 'Organization ID (required if scopeType is ORG)',
    example: 'org_xyz789',
  })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({
    description: 'Service Category ID (required if scopeType is SERVICE_CATEGORY)',
    example: 'svc_cat_456',
  })
  @IsString()
  @IsOptional()
  serviceCategoryId?: string;
}

// ============================================
// RESPONSE DTOs
// ============================================

export class FeatureFlagResponseDto {
  @ApiProperty({ description: 'Feature flag ID' })
  id: string;

  @ApiProperty({ description: 'Feature flag key' })
  key: string;

  @ApiPropertyOptional({ description: 'Feature flag description' })
  description?: string | null;

  @ApiProperty({ description: 'Whether the feature flag is enabled' })
  enabled: boolean;

  @ApiProperty({ description: 'Scope type', enum: ['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'] })
  scopeType: string;

  @ApiPropertyOptional({ description: 'Region ID' })
  regionId?: string | null;

  @ApiPropertyOptional({ description: 'Organization ID' })
  orgId?: string | null;

  @ApiPropertyOptional({ description: 'Service Category ID' })
  serviceCategoryId?: string | null;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export class PolicyResponseDto {
  @ApiProperty({ description: 'Policy ID' })
  id: string;

  @ApiProperty({ description: 'Policy key' })
  key: string;

  @ApiPropertyOptional({ description: 'Policy description' })
  description?: string | null;

  @ApiProperty({ description: 'Policy value' })
  value: unknown;

  @ApiProperty({ description: 'Scope type', enum: ['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'] })
  scopeType: string;

  @ApiPropertyOptional({ description: 'Region ID' })
  regionId?: string | null;

  @ApiPropertyOptional({ description: 'Organization ID' })
  orgId?: string | null;

  @ApiPropertyOptional({ description: 'Service Category ID' })
  serviceCategoryId?: string | null;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export class FeatureFlagValueResponseDto {
  @ApiProperty({ description: 'Feature flag key' })
  key: string;

  @ApiProperty({ description: 'Whether the feature flag is enabled' })
  enabled: boolean;

  @ApiProperty({ description: 'Resolved scope type', enum: ['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'] })
  resolvedScopeType: string;
}

export class PolicyValueResponseDto {
  @ApiProperty({ description: 'Policy key' })
  key: string;

  @ApiProperty({ description: 'Policy value' })
  value: unknown;

  @ApiProperty({ description: 'Resolved scope type', enum: ['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'] })
  resolvedScopeType: string;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;
}
