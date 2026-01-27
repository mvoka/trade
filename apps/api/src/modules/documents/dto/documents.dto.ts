import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DocumentFolder {
  JOB_BEFORE = 'jobs/before',
  JOB_AFTER = 'jobs/after',
  JOB_DOCUMENTS = 'jobs/documents',
  VERIFICATION = 'verification',
  PORTFOLIO = 'portfolio',
  PROFILE = 'profiles',
}

export enum AttachmentType {
  BEFORE_PHOTO = 'BEFORE_PHOTO',
  AFTER_PHOTO = 'AFTER_PHOTO',
  DOCUMENT = 'DOCUMENT',
  OTHER = 'OTHER',
}

export enum PortfolioVisibility {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
}

// Request DTOs
export class GetUploadUrlDto {
  @ApiProperty({ description: 'Original filename' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'MIME type of the file' })
  @IsString()
  contentType: string;

  @ApiProperty({ enum: DocumentFolder, description: 'Folder to upload to' })
  @IsEnum(DocumentFolder)
  folder: DocumentFolder;

  @ApiPropertyOptional({ description: 'Associated job ID' })
  @IsOptional()
  @IsUUID()
  jobId?: string;
}

export class CreateJobAttachmentDto {
  @ApiProperty({ description: 'Job ID' })
  @IsUUID()
  jobId: string;

  @ApiProperty({ enum: AttachmentType, description: 'Type of attachment' })
  @IsEnum(AttachmentType)
  type: AttachmentType;

  @ApiProperty({ description: 'Original filename' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: 'File URL from storage' })
  @IsString()
  fileUrl: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiPropertyOptional({ description: 'MIME type' })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class CreateVerificationDocumentDto {
  @ApiProperty({ description: 'Verification record ID' })
  @IsUUID()
  verificationRecordId: string;

  @ApiProperty({ description: 'Document type (LICENSE, INSURANCE, WSIB)' })
  @IsString()
  documentType: string;

  @ApiProperty({ description: 'Original filename' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: 'File URL from storage' })
  @IsString()
  fileUrl: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiPropertyOptional({ description: 'MIME type' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ description: 'Document expiry date' })
  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class CreatePortfolioItemDto {
  @ApiPropertyOptional({ description: 'Associated job ID' })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ description: 'Title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Media URL' })
  @IsString()
  mediaUrl: string;

  @ApiPropertyOptional({ description: 'Media type (image, video)' })
  @IsOptional()
  @IsString()
  mediaType?: string;

  @ApiPropertyOptional({ enum: PortfolioVisibility, default: 'PRIVATE' })
  @IsOptional()
  @IsEnum(PortfolioVisibility)
  visibility?: PortfolioVisibility;
}

export class UpdatePortfolioItemDto {
  @ApiPropertyOptional({ description: 'Title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PortfolioVisibility })
  @IsOptional()
  @IsEnum(PortfolioVisibility)
  visibility?: PortfolioVisibility;

  @ApiPropertyOptional({ description: 'Opt-in granted for public display' })
  @IsOptional()
  @IsBoolean()
  optInGranted?: boolean;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

// Response DTOs
export class UploadUrlResponseDto {
  @ApiProperty()
  uploadUrl: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  publicUrl: string;
}

export class JobAttachmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty({ enum: AttachmentType })
  type: AttachmentType;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  fileUrl: string;

  @ApiPropertyOptional()
  fileSize?: number;

  @ApiPropertyOptional()
  mimeType?: string;

  @ApiProperty()
  uploadedAt: Date;
}

export class VerificationDocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  verificationRecordId: string;

  @ApiProperty()
  documentType: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  fileUrl: string;

  @ApiPropertyOptional()
  fileSize?: number;

  @ApiPropertyOptional()
  mimeType?: string;

  @ApiPropertyOptional()
  expiryDate?: Date;

  @ApiProperty()
  status: string;

  @ApiProperty()
  uploadedAt: Date;
}

export class PortfolioItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  proProfileId: string;

  @ApiPropertyOptional()
  jobId?: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  mediaUrl: string;

  @ApiPropertyOptional()
  mediaType?: string;

  @ApiProperty({ enum: PortfolioVisibility })
  visibility: PortfolioVisibility;

  @ApiProperty()
  optInGranted: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;
}
