import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UserRole } from '@trades/shared';

// ============================================
// Request DTOs
// ============================================

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+1234567890',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be a valid E.164 format',
  })
  phone?: string;
}

export class UserQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user role',
    enum: UserRole,
    example: 'PRO_USER',
  })
  @IsEnum(UserRole, { message: 'Invalid user role' })
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Search by email, first name, or last name',
    example: 'john',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field',
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
  })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ============================================
// Response DTOs
// ============================================

export class ProProfileResponseDto {
  @ApiProperty({ description: 'Pro profile ID' })
  id: string;

  @ApiPropertyOptional({ description: 'Business name' })
  businessName?: string | null;

  @ApiPropertyOptional({ description: 'Business phone' })
  businessPhone?: string | null;

  @ApiPropertyOptional({ description: 'Business email' })
  businessEmail?: string | null;

  @ApiPropertyOptional({ description: 'Bio' })
  bio?: string | null;

  @ApiPropertyOptional({ description: 'Years of experience' })
  yearsExperience?: number | null;

  @ApiProperty({ description: 'Verification status' })
  verificationStatus: string;

  @ApiPropertyOptional({ description: 'Verified at date' })
  verifiedAt?: Date | null;

  @ApiPropertyOptional({ description: 'Average response time in minutes' })
  avgResponseMinutes?: number | null;

  @ApiPropertyOptional({ description: 'Job completion rate' })
  completionRate?: number | null;

  @ApiProperty({ description: 'Total jobs completed' })
  totalJobsCompleted: number;

  @ApiProperty({ description: 'Is active flag' })
  isActive: boolean;

  @ApiProperty({ description: 'Created at date' })
  createdAt: Date;
}

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiPropertyOptional({ description: 'User first name' })
  firstName: string | null;

  @ApiPropertyOptional({ description: 'User last name' })
  lastName: string | null;

  @ApiPropertyOptional({ description: 'User phone' })
  phone: string | null;

  @ApiProperty({ description: 'User role', enum: UserRole })
  role: string;

  @ApiProperty({ description: 'Email verified flag' })
  emailVerified: boolean;

  @ApiPropertyOptional({ description: 'Email verified at date' })
  emailVerifiedAt: Date | null;

  @ApiPropertyOptional({ description: 'Last login date' })
  lastLoginAt: Date | null;

  @ApiProperty({ description: 'Is active flag' })
  isActive: boolean;

  @ApiProperty({ description: 'Created at date' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at date' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Pro profile if user is a PRO_USER',
    type: ProProfileResponseDto,
  })
  proProfile?: ProProfileResponseDto | null;
}

export class UserListResponseDto {
  @ApiProperty({
    description: 'List of users',
    type: [UserResponseDto],
  })
  users: UserResponseDto[];

  @ApiProperty({ description: 'Total number of users matching the query' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  pageSize: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;
}
