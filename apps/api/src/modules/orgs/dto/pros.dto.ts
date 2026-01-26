import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek, VerificationStatus } from '@trades/shared';

// ============================================
// SERVICE AREA DTOs
// ============================================
export class ServiceAreaDto {
  @ApiProperty({
    description: 'Center latitude',
    example: 43.6532,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLat: number;

  @ApiProperty({
    description: 'Center longitude',
    example: -79.3832,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  centerLng: number;

  @ApiProperty({
    description: 'Service radius in kilometers',
    example: 25,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  radiusKm: number;
}

// ============================================
// SERVICE HOURS DTOs
// ============================================
export class ServiceHoursItemDto {
  @ApiProperty({
    description: 'Day of week',
    enum: DayOfWeek,
    example: 'MONDAY',
  })
  @IsEnum(DayOfWeek, { message: 'Invalid day of week' })
  dayOfWeek: string;

  @ApiProperty({
    description: 'Start time in HH:mm format',
    example: '08:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Start time must be in HH:mm format',
  })
  startTime: string;

  @ApiProperty({
    description: 'End time in HH:mm format',
    example: '17:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'End time must be in HH:mm format',
  })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Is this day active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateServiceHoursDto {
  @ApiProperty({
    description: 'Array of service hours for each day',
    type: [ServiceHoursItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceHoursItemDto)
  @ArrayMinSize(1, { message: 'At least one service hour entry is required' })
  hours: ServiceHoursItemDto[];
}

// ============================================
// CREATE PRO PROFILE DTO
// ============================================
export class CreateProProfileDto {
  @ApiPropertyOptional({
    description: 'Organization ID to associate with',
    example: 'clxyz123abc456def789',
  })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({
    description: 'Region ID',
    example: 'clxyz123abc456def789',
  })
  @IsString()
  @IsOptional()
  regionId?: string;

  @ApiPropertyOptional({
    description: 'Business name',
    example: 'Smith Plumbing Services',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  businessName?: string;

  @ApiPropertyOptional({
    description: 'Business phone number',
    example: '+14165551234',
  })
  @IsString()
  @IsOptional()
  businessPhone?: string;

  @ApiPropertyOptional({
    description: 'Business email',
    example: 'contact@smithplumbing.ca',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  businessEmail?: string;

  @ApiPropertyOptional({
    description: 'Professional bio',
    example: 'Licensed plumber with 15 years of experience in residential and commercial projects.',
    maxLength: 2000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({
    description: 'Years of experience',
    example: 15,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  yearsExperience?: number;

  @ApiPropertyOptional({
    description: 'Service category IDs the pro offers',
    type: [String],
    example: ['clxyz123abc456def789'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviceCategoryIds?: string[];

  @ApiPropertyOptional({
    description: 'Service area configuration',
    type: ServiceAreaDto,
  })
  @ValidateNested()
  @Type(() => ServiceAreaDto)
  @IsOptional()
  serviceArea?: ServiceAreaDto;

  @ApiPropertyOptional({
    description: 'Service hours configuration',
    type: [ServiceHoursItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceHoursItemDto)
  @IsOptional()
  serviceHours?: ServiceHoursItemDto[];
}

// ============================================
// UPDATE PRO PROFILE DTO
// ============================================
export class UpdateProProfileDto {
  @ApiPropertyOptional({
    description: 'Organization ID',
    example: 'clxyz123abc456def789',
  })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({
    description: 'Region ID',
    example: 'clxyz123abc456def789',
  })
  @IsString()
  @IsOptional()
  regionId?: string;

  @ApiPropertyOptional({
    description: 'Business name',
    example: 'Smith Plumbing Services',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  businessName?: string;

  @ApiPropertyOptional({
    description: 'Business phone number',
    example: '+14165551234',
  })
  @IsString()
  @IsOptional()
  businessPhone?: string;

  @ApiPropertyOptional({
    description: 'Business email',
    example: 'contact@smithplumbing.ca',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  businessEmail?: string;

  @ApiPropertyOptional({
    description: 'Professional bio',
    example: 'Licensed plumber with 15 years of experience.',
    maxLength: 2000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({
    description: 'Years of experience',
    example: 15,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  yearsExperience?: number;

  @ApiPropertyOptional({
    description: 'Service category IDs',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviceCategoryIds?: string[];

  @ApiPropertyOptional({
    description: 'Is profile active',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ============================================
// SEARCH PROs DTO
// ============================================
export class SearchProsInRadiusDto {
  @ApiProperty({
    description: 'Search center latitude',
    example: 43.6532,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({
    description: 'Search center longitude',
    example: -79.3832,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({
    description: 'Search radius in kilometers',
    example: 25,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  radiusKm: number;

  @ApiPropertyOptional({
    description: 'Filter by service category ID',
    example: 'clxyz123abc456def789',
  })
  @IsString()
  @IsOptional()
  categoryId?: string;
}

// ============================================
// RESPONSE DTOs
// ============================================
export class ServiceAreaResponseDto {
  @ApiProperty({ description: 'Service area ID' })
  id: string;

  @ApiProperty({ description: 'Center latitude' })
  centerLat: number;

  @ApiProperty({ description: 'Center longitude' })
  centerLng: number;

  @ApiProperty({ description: 'Radius in kilometers' })
  radiusKm: number;
}

export class ServiceHoursResponseDto {
  @ApiProperty({ description: 'Service hours ID' })
  id: string;

  @ApiProperty({ description: 'Day of week', enum: DayOfWeek })
  dayOfWeek: string;

  @ApiProperty({ description: 'Start time (HH:mm)' })
  startTime: string;

  @ApiProperty({ description: 'End time (HH:mm)' })
  endTime: string;

  @ApiProperty({ description: 'Is active' })
  isActive: boolean;
}

export class ServiceCategoryResponseDto {
  @ApiProperty({ description: 'Category ID' })
  id: string;

  @ApiProperty({ description: 'Category name' })
  name: string;

  @ApiProperty({ description: 'Category code' })
  code: string;
}

export class ProProfileResponseDto {
  @ApiProperty({ description: 'Pro profile ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiPropertyOptional({ description: 'Organization ID' })
  orgId: string | null;

  @ApiPropertyOptional({ description: 'Region ID' })
  regionId: string | null;

  @ApiPropertyOptional({ description: 'Business name' })
  businessName: string | null;

  @ApiPropertyOptional({ description: 'Business phone' })
  businessPhone: string | null;

  @ApiPropertyOptional({ description: 'Business email' })
  businessEmail: string | null;

  @ApiPropertyOptional({ description: 'Professional bio' })
  bio: string | null;

  @ApiPropertyOptional({ description: 'Years of experience' })
  yearsExperience: number | null;

  @ApiProperty({
    description: 'Verification status',
    enum: VerificationStatus,
  })
  verificationStatus: string;

  @ApiPropertyOptional({ description: 'Verified at timestamp' })
  verifiedAt: Date | null;

  @ApiPropertyOptional({ description: 'Average response time in minutes' })
  avgResponseMinutes: number | null;

  @ApiPropertyOptional({ description: 'Job completion rate (0-1)' })
  completionRate: number | null;

  @ApiProperty({ description: 'Total jobs completed' })
  totalJobsCompleted: number;

  @ApiProperty({ description: 'Is profile active' })
  isActive: boolean;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Service area',
    type: ServiceAreaResponseDto,
  })
  serviceArea?: ServiceAreaResponseDto | null;

  @ApiPropertyOptional({
    description: 'Service hours',
    type: [ServiceHoursResponseDto],
  })
  serviceHours?: ServiceHoursResponseDto[];

  @ApiPropertyOptional({
    description: 'Service categories',
    type: [ServiceCategoryResponseDto],
  })
  serviceCategories?: ServiceCategoryResponseDto[];

  @ApiPropertyOptional({
    description: 'User information',
  })
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export class ProProfileWithDistanceResponseDto extends ProProfileResponseDto {
  @ApiProperty({
    description: 'Distance from search point in kilometers',
  })
  distance: number;

  @ApiPropertyOptional({
    description: 'Ranking score for dispatch ordering',
  })
  rankingScore?: number;
}
