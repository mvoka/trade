import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

// ============================================
// REQUEST DTOs
// ============================================

/**
 * DTO for adding a contractor to preferred list
 */
export class AddPreferredDto {
  @ApiProperty({
    description: 'Pro profile ID to add to preferred list',
    example: 'clx1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty({ message: 'Pro profile ID is required' })
  proProfileId: string;

  @ApiPropertyOptional({
    description: 'Optional notes about this preferred contractor',
    example: 'Great work on electrical repairs, always on time',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Notes must be 500 characters or less' })
  notes?: string;
}

// ============================================
// RESPONSE DTOs
// ============================================

/**
 * Pro profile summary for preferred contractor responses
 */
export class ProProfileSummaryDto {
  @ApiProperty({ description: 'Pro profile ID' })
  id: string;

  @ApiProperty({ description: 'Business name' })
  businessName: string | null;

  @ApiProperty({ description: 'Business phone' })
  businessPhone: string | null;

  @ApiProperty({ description: 'Business email' })
  businessEmail: string | null;

  @ApiPropertyOptional({ description: 'Bio/description' })
  bio?: string | null;

  @ApiPropertyOptional({ description: 'Years of experience' })
  yearsExperience?: number | null;

  @ApiProperty({ description: 'Verification status' })
  verificationStatus: string;

  @ApiPropertyOptional({ description: 'Average response time in minutes' })
  avgResponseMinutes?: number | null;

  @ApiPropertyOptional({ description: 'Job completion rate' })
  completionRate?: number | null;

  @ApiProperty({ description: 'Total jobs completed' })
  totalJobsCompleted: number;

  @ApiPropertyOptional({
    description: 'User first name',
  })
  firstName?: string | null;

  @ApiPropertyOptional({
    description: 'User last name',
  })
  lastName?: string | null;
}

/**
 * SMB user summary for preferred-by responses
 */
export class SmbUserSummaryDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiPropertyOptional({ description: 'First name' })
  firstName?: string | null;

  @ApiPropertyOptional({ description: 'Last name' })
  lastName?: string | null;

  @ApiPropertyOptional({ description: 'Phone number' })
  phone?: string | null;
}

/**
 * Response DTO for a preferred contractor entry
 */
export class PreferredResponseDto {
  @ApiProperty({ description: 'Preferred contractor record ID' })
  id: string;

  @ApiProperty({ description: 'SMB user ID' })
  smbUserId: string;

  @ApiProperty({ description: 'Pro profile ID' })
  proProfileId: string;

  @ApiPropertyOptional({ description: 'Notes about this contractor' })
  notes?: string | null;

  @ApiProperty({ description: 'When the contractor was added to preferred list' })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Pro profile details',
    type: ProProfileSummaryDto,
  })
  proProfile?: ProProfileSummaryDto;
}

/**
 * Response DTO for SMBs who have favorited a pro
 */
export class PreferredByResponseDto {
  @ApiProperty({ description: 'Preferred contractor record ID' })
  id: string;

  @ApiProperty({ description: 'SMB user ID' })
  smbUserId: string;

  @ApiProperty({ description: 'Pro profile ID' })
  proProfileId: string;

  @ApiPropertyOptional({ description: 'Notes about this contractor' })
  notes?: string | null;

  @ApiProperty({ description: 'When the contractor was added to preferred list' })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'SMB user details',
    type: SmbUserSummaryDto,
  })
  smbUser?: SmbUserSummaryDto;
}

/**
 * Response DTO for checking if a pro is preferred
 */
export class IsPreferredResponseDto {
  @ApiProperty({
    description: 'Whether the pro is in the preferred list',
    example: true,
  })
  isPreferred: boolean;

  @ApiPropertyOptional({
    description: 'Preferred record if exists',
    type: PreferredResponseDto,
  })
  preferred?: PreferredResponseDto | null;
}

/**
 * Response DTO for message-only responses
 */
export class PreferredMessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Contractor removed from preferred list',
  })
  message: string;
}
