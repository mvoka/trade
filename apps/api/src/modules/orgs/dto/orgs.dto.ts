import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  IsBoolean,
  MinLength,
  MaxLength,
  IsEnum,
  IsUUID,
} from 'class-validator';

// Org member roles
export const OrgMemberRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
export type OrgMemberRole = (typeof OrgMemberRole)[keyof typeof OrgMemberRole];

// ============================================
// CREATE ORG DTO
// ============================================
export class CreateOrgDto {
  @ApiProperty({
    description: 'Organization name',
    example: 'Acme Plumbing Co.',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, { message: 'Organization name must be at least 2 characters' })
  @MaxLength(100, { message: 'Organization name cannot exceed 100 characters' })
  name: string;

  @ApiPropertyOptional({
    description: 'Legal business name',
    example: 'Acme Plumbing Co. Ltd.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({
    description: 'Tax ID / Business Number',
    example: '123456789RC0001',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Organization phone number',
    example: '+14165551234',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Organization email',
    example: 'info@acmeplumbing.ca',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Organization website',
    example: 'https://acmeplumbing.ca',
  })
  @IsUrl({}, { message: 'Please provide a valid URL' })
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({
    description: 'Address line 1',
    example: '123 Main Street',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  addressLine1?: string;

  @ApiPropertyOptional({
    description: 'Address line 2',
    example: 'Suite 400',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'Toronto',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: 'Province/State',
    example: 'ON',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  province?: string;

  @ApiPropertyOptional({
    description: 'Postal code',
    example: 'M5V 3A1',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Country code',
    example: 'CA',
    default: 'CA',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2)
  country?: string;
}

// ============================================
// UPDATE ORG DTO
// ============================================
export class UpdateOrgDto {
  @ApiPropertyOptional({
    description: 'Organization name',
    example: 'Acme Plumbing Co.',
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Legal business name',
    example: 'Acme Plumbing Co. Ltd.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({
    description: 'Tax ID / Business Number',
    example: '123456789RC0001',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Organization phone number',
    example: '+14165551234',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Organization email',
    example: 'info@acmeplumbing.ca',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Organization website',
    example: 'https://acmeplumbing.ca',
  })
  @IsUrl({}, { message: 'Please provide a valid URL' })
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({
    description: 'Address line 1',
    example: '123 Main Street',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  addressLine1?: string;

  @ApiPropertyOptional({
    description: 'Address line 2',
    example: 'Suite 400',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'Toronto',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: 'Province/State',
    example: 'ON',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  province?: string;

  @ApiPropertyOptional({
    description: 'Postal code',
    example: 'M5V 3A1',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Country code',
    example: 'CA',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({
    description: 'Is organization active',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ============================================
// ADD MEMBER DTO
// ============================================
export class AddMemberDto {
  @ApiProperty({
    description: 'User ID to add as member',
    example: 'clxyz123abc456def789',
  })
  @IsString()
  @MinLength(1)
  userId: string;

  @ApiPropertyOptional({
    description: 'Member role in the organization',
    enum: ['owner', 'admin', 'member'],
    default: 'member',
  })
  @IsEnum(['owner', 'admin', 'member'], {
    message: 'Role must be owner, admin, or member',
  })
  @IsOptional()
  role?: OrgMemberRole;
}

// ============================================
// RESPONSE DTOs
// ============================================
export class OrgMemberResponseDto {
  @ApiProperty({ description: 'Membership ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiPropertyOptional({ description: 'User first name' })
  firstName: string | null;

  @ApiPropertyOptional({ description: 'User last name' })
  lastName: string | null;

  @ApiProperty({ description: 'Member role in organization' })
  role: string;

  @ApiProperty({ description: 'Is membership active' })
  isActive: boolean;

  @ApiProperty({ description: 'Date member joined' })
  joinedAt: Date;
}

export class OrgResponseDto {
  @ApiProperty({ description: 'Organization ID' })
  id: string;

  @ApiProperty({ description: 'Organization name' })
  name: string;

  @ApiPropertyOptional({ description: 'Legal business name' })
  legalName: string | null;

  @ApiPropertyOptional({ description: 'Tax ID' })
  taxId: string | null;

  @ApiPropertyOptional({ description: 'Phone number' })
  phone: string | null;

  @ApiPropertyOptional({ description: 'Email' })
  email: string | null;

  @ApiPropertyOptional({ description: 'Website' })
  website: string | null;

  @ApiPropertyOptional({ description: 'Address line 1' })
  addressLine1: string | null;

  @ApiPropertyOptional({ description: 'Address line 2' })
  addressLine2: string | null;

  @ApiPropertyOptional({ description: 'City' })
  city: string | null;

  @ApiPropertyOptional({ description: 'Province' })
  province: string | null;

  @ApiPropertyOptional({ description: 'Postal code' })
  postalCode: string | null;

  @ApiProperty({ description: 'Country' })
  country: string;

  @ApiProperty({ description: 'Is organization active' })
  isActive: boolean;

  @ApiProperty({ description: 'Created date' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated date' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Organization members',
    type: [OrgMemberResponseDto],
  })
  members?: OrgMemberResponseDto[];
}

export class OrgWithMembershipResponseDto extends OrgResponseDto {
  @ApiProperty({ description: 'Current user role in this organization' })
  memberRole: string;
}
