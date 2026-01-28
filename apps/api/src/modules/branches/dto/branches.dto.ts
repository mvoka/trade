import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsEmail,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

/**
 * Branch type enum (mirrors Prisma BranchType)
 */
export enum BranchTypeDto {
  HEADQUARTERS = 'HEADQUARTERS',
  BRANCH = 'BRANCH',
  FRANCHISE = 'FRANCHISE',
}

/**
 * Create branch request DTO
 */
export class CreateBranchDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsEnum(BranchTypeDto)
  branchType?: BranchTypeDto;

  @IsOptional()
  @IsString()
  parentBranchId?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  regionId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  serviceRadiusKm?: number;
}

/**
 * Update branch request DTO
 */
export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsEnum(BranchTypeDto)
  branchType?: BranchTypeDto;

  @IsOptional()
  @IsString()
  parentBranchId?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  regionId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Branch query parameters DTO
 */
export class BranchesQueryDto {
  @IsOptional()
  @IsEnum(BranchTypeDto)
  branchType?: BranchTypeDto;

  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;

  @IsOptional()
  @IsString()
  regionId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Branch response DTO
 */
export class BranchResponseDto {
  id: string;
  orgId: string;
  parentBranchId?: string;
  name: string;
  code?: string;
  branchType: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country: string;
  lat?: number;
  lng?: number;
  regionId?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  serviceRadiusKm?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  childBranches?: BranchResponseDto[];
}
