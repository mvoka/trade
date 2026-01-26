import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { VerificationStatus } from '@trades/shared';

// ============================================
// Request DTOs
// ============================================

export class UploadDocumentDto {
  @ApiProperty({
    description: 'Type of document being uploaded',
    example: 'LICENSE',
    enum: ['LICENSE', 'INSURANCE', 'WSIB', 'CERTIFICATION', 'BACKGROUND_CHECK', 'OTHER'],
  })
  @IsString()
  @IsNotEmpty({ message: 'Document type is required' })
  documentType: string;

  @ApiProperty({
    description: 'Original filename of the uploaded document',
    example: 'electrician-license.pdf',
  })
  @IsString()
  @IsNotEmpty({ message: 'File name is required' })
  fileName: string;

  @ApiProperty({
    description: 'URL where the file is stored',
    example: 'https://storage.example.com/documents/abc123.pdf',
  })
  @IsString()
  @IsNotEmpty({ message: 'File URL is required' })
  fileUrl: string;

  @ApiPropertyOptional({
    description: 'File size in bytes',
    example: 102400,
  })
  @IsInt()
  @IsOptional()
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Document expiry date (ISO 8601 format)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsDateString({}, { message: 'Expiry date must be a valid ISO date string' })
  @IsOptional()
  expiryDate?: string;
}

export class ApproveVerificationDto {
  @ApiPropertyOptional({
    description: 'Optional notes from admin about the approval',
    example: 'All documents verified successfully.',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class DenyVerificationDto {
  @ApiProperty({
    description: 'Required reason for denial',
    example: 'Insurance document expired. Please upload a valid certificate.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Denial notes are required' })
  notes: string;
}

export class VerificationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by verification status',
    enum: VerificationStatus,
    example: 'PENDING',
  })
  @IsEnum(VerificationStatus)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'submittedAt',
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'submittedAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ExpiringDocumentsQueryDto {
  @ApiProperty({
    description: 'Number of days ahead to check for expiring documents',
    example: 30,
    minimum: 1,
    maximum: 365,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  daysAhead: number;
}

// ============================================
// Response DTOs
// ============================================

export class VerificationDocumentResponseDto {
  @ApiProperty({ description: 'Document ID' })
  id: string;

  @ApiProperty({ description: 'Type of document', example: 'LICENSE' })
  documentType: string;

  @ApiProperty({ description: 'Original filename' })
  fileName: string;

  @ApiProperty({ description: 'File storage URL' })
  fileUrl: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  fileSize: number | null;

  @ApiPropertyOptional({ description: 'MIME type' })
  mimeType: string | null;

  @ApiPropertyOptional({ description: 'Document expiry date' })
  expiryDate: Date | null;

  @ApiProperty({ description: 'Document verification status', enum: VerificationStatus })
  status: string;

  @ApiPropertyOptional({ description: 'Review notes from admin' })
  reviewNotes: string | null;

  @ApiProperty({ description: 'Upload timestamp' })
  uploadedAt: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class VerificationRecordResponseDto {
  @ApiProperty({ description: 'Verification record ID' })
  id: string;

  @ApiProperty({ description: 'Pro profile ID' })
  proProfileId: string;

  @ApiProperty({ description: 'Verification status', enum: VerificationStatus })
  status: string;

  @ApiPropertyOptional({ description: 'ID of admin who reviewed' })
  reviewedById: string | null;

  @ApiPropertyOptional({ description: 'Review timestamp' })
  reviewedAt: Date | null;

  @ApiPropertyOptional({ description: 'Review notes' })
  reviewNotes: string | null;

  @ApiProperty({ description: 'Submission timestamp' })
  submittedAt: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Associated documents',
    type: [VerificationDocumentResponseDto],
  })
  documents?: VerificationDocumentResponseDto[];

  @ApiPropertyOptional({
    description: 'Pro profile information',
  })
  proProfile?: {
    id: string;
    businessName: string | null;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
}

export class VerificationStatusResponseDto {
  @ApiProperty({ description: 'Current verification status', enum: VerificationStatus })
  status: string;

  @ApiPropertyOptional({ description: 'Active verification record' })
  currentRecord: VerificationRecordResponseDto | null;

  @ApiProperty({ description: 'Total documents submitted' })
  totalDocuments: number;

  @ApiPropertyOptional({ description: 'Date when verification was approved' })
  verifiedAt: Date | null;
}

export class VerificationChecklistItemDto {
  @ApiProperty({ description: 'Checklist item ID' })
  id: string;

  @ApiProperty({ description: 'Document type code', example: 'LICENSE' })
  documentType: string;

  @ApiProperty({ description: 'Human-readable name', example: 'Electrical License' })
  name: string;

  @ApiPropertyOptional({ description: 'Description of the requirement' })
  description: string | null;

  @ApiProperty({ description: 'Whether this document is required' })
  isRequired: boolean;

  @ApiProperty({ description: 'Whether expiry date is required for this document' })
  expiryRequired: boolean;

  @ApiProperty({ description: 'Display order' })
  sortOrder: number;
}

export class ExpiringDocumentResponseDto {
  @ApiProperty({ description: 'Document ID' })
  documentId: string;

  @ApiProperty({ description: 'Document type' })
  documentType: string;

  @ApiProperty({ description: 'Document expiry date' })
  expiryDate: Date;

  @ApiProperty({ description: 'Days until expiry' })
  daysUntilExpiry: number;

  @ApiProperty({ description: 'Verification record ID' })
  verificationRecordId: string;

  @ApiProperty({
    description: 'Pro profile information',
  })
  proProfile: {
    id: string;
    businessName: string | null;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
}

export class PaginatedVerificationRecordsDto {
  @ApiProperty({ type: [VerificationRecordResponseDto] })
  data: VerificationRecordResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
  })
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Verification submitted successfully',
  })
  message: string;
}
