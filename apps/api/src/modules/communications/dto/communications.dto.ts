import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsEmail,
  IsObject,
  MinLength,
  MaxLength,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ConsentType,
  NotificationChannel,
  MessageSender,
} from '@trades/shared';

// ============================================
// SEND MESSAGE DTOs
// ============================================

export class SendMessageDto {
  @ApiProperty({
    description: 'Message content',
    example: 'Hello, when can you arrive?',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1, { message: 'Message content is required' })
  @MaxLength(2000, { message: 'Message content cannot exceed 2000 characters' })
  content: string;

  @ApiPropertyOptional({
    description: 'Optional attachment URL',
    example: 'https://storage.example.com/attachments/image.jpg',
  })
  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}

export class MessageResponseDto {
  @ApiProperty({ description: 'Message ID' })
  id: string;

  @ApiProperty({ description: 'Thread ID' })
  threadId: string;

  @ApiProperty({ description: 'Sender user ID' })
  senderId: string | null;

  @ApiProperty({
    description: 'Sender type',
    enum: ['SMB', 'PRO', 'OPERATOR', 'SYSTEM'],
  })
  senderType: string;

  @ApiProperty({ description: 'Message content' })
  content: string;

  @ApiPropertyOptional({ description: 'Attachment URL' })
  attachmentUrl?: string | null;

  @ApiPropertyOptional({ description: 'When the message was read' })
  readAt?: Date | null;

  @ApiProperty({ description: 'When the message was created' })
  createdAt: Date;
}

export class MessageThreadResponseDto {
  @ApiProperty({ description: 'Thread ID' })
  id: string;

  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiProperty({ description: 'Messages in the thread', type: [MessageResponseDto] })
  messages: MessageResponseDto[];

  @ApiProperty({ description: 'When the thread was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When the thread was last updated' })
  updatedAt: Date;
}

// ============================================
// CONSENT DTOs
// ============================================

export class ConsentItemDto {
  @ApiProperty({
    description: 'Consent type',
    enum: ['TRANSACTIONAL_SMS', 'MARKETING_SMS', 'TRANSACTIONAL_EMAIL', 'MARKETING_EMAIL', 'CALL_RECORDING'],
  })
  @IsEnum(
    ['TRANSACTIONAL_SMS', 'MARKETING_SMS', 'TRANSACTIONAL_EMAIL', 'MARKETING_EMAIL', 'CALL_RECORDING'],
    { message: 'Invalid consent type' },
  )
  type: ConsentType;

  @ApiProperty({
    description: 'Whether consent is granted',
    example: true,
  })
  @IsBoolean()
  granted: boolean;
}

export class UpdateConsentDto {
  @ApiProperty({
    description: 'Array of consent settings to update',
    type: [ConsentItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsentItemDto)
  consents: ConsentItemDto[];
}

export class ConsentResponseDto {
  @ApiProperty({ description: 'Consent ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({
    description: 'Consent type',
    enum: ['TRANSACTIONAL_SMS', 'MARKETING_SMS', 'TRANSACTIONAL_EMAIL', 'MARKETING_EMAIL', 'CALL_RECORDING'],
  })
  type: string;

  @ApiProperty({ description: 'Whether consent is granted' })
  granted: boolean;

  @ApiPropertyOptional({ description: 'When consent was granted' })
  grantedAt?: Date | null;

  @ApiPropertyOptional({ description: 'When consent was revoked' })
  revokedAt?: Date | null;

  @ApiProperty({ description: 'When the consent record was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When the consent record was last updated' })
  updatedAt: Date;
}

export class ConsentStatusResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({
    description: 'List of all consents',
    type: [ConsentResponseDto],
  })
  consents: ConsentResponseDto[];
}

// ============================================
// NOTIFICATION DTOs
// ============================================

export class SendNotificationDto {
  @ApiProperty({
    description: 'User ID to send notification to',
    example: 'clxx1234567890',
  })
  @IsString()
  @MinLength(1)
  userId: string;

  @ApiProperty({
    description: 'Notification type',
    example: 'DISPATCH_NEW',
  })
  @IsString()
  @MinLength(1)
  type: string;

  @ApiProperty({
    description: 'Notification data/payload',
    example: { jobId: 'clxx1234567890', message: 'New job available' },
  })
  @IsObject()
  data: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Channels to send notification through',
    enum: ['SMS', 'EMAIL', 'PUSH', 'IN_APP'],
    isArray: true,
    example: ['SMS', 'EMAIL'],
  })
  @IsArray()
  @IsEnum(['SMS', 'EMAIL', 'PUSH', 'IN_APP'], { each: true })
  @IsOptional()
  channels?: NotificationChannel[];
}

export class NotificationLogResponseDto {
  @ApiProperty({ description: 'Notification log ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({
    description: 'Notification channel',
    enum: ['SMS', 'EMAIL', 'PUSH', 'IN_APP'],
  })
  channel: string;

  @ApiProperty({ description: 'Notification type' })
  type: string;

  @ApiPropertyOptional({ description: 'Notification subject' })
  subject?: string | null;

  @ApiProperty({ description: 'Notification content' })
  content: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'When notification was sent' })
  sentAt?: Date | null;

  @ApiPropertyOptional({ description: 'When notification was delivered' })
  deliveredAt?: Date | null;

  @ApiPropertyOptional({ description: 'When notification failed' })
  failedAt?: Date | null;

  @ApiPropertyOptional({ description: 'Failure reason' })
  failReason?: string | null;

  @ApiProperty({ description: 'When the log was created' })
  createdAt: Date;
}

// ============================================
// SMS DTOs (for internal use / future expansion)
// ============================================

export class SendSmsOptionsDto {
  @ApiPropertyOptional({
    description: 'From phone number (masked number)',
    example: '+14165551234',
  })
  @IsString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'Media URLs for MMS',
    example: ['https://example.com/image.jpg'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mediaUrls?: string[];

  @ApiPropertyOptional({
    description: 'Webhook URL for status callbacks',
    example: 'https://api.example.com/webhooks/sms-status',
  })
  @IsString()
  @IsOptional()
  statusCallback?: string;
}

export class SmsResultDto {
  @ApiProperty({ description: 'Whether SMS was sent successfully' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Message SID from provider' })
  messageSid?: string;

  @ApiPropertyOptional({ description: 'Status of the message' })
  status?: string;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;
}

// ============================================
// EMAIL DTOs (for internal use / future expansion)
// ============================================

export class SendEmailOptionsDto {
  @ApiPropertyOptional({
    description: 'From email address',
    example: 'noreply@tradesplatform.com',
  })
  @IsEmail()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'Reply-to email address',
    example: 'support@tradesplatform.com',
  })
  @IsEmail()
  @IsOptional()
  replyTo?: string;

  @ApiPropertyOptional({
    description: 'CC recipients',
    example: ['manager@example.com'],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  cc?: string[];

  @ApiPropertyOptional({
    description: 'BCC recipients',
    example: ['archive@example.com'],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  bcc?: string[];

  @ApiPropertyOptional({
    description: 'Attachment URLs',
    example: ['https://storage.example.com/invoice.pdf'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];
}

export class EmailResultDto {
  @ApiProperty({ description: 'Whether email was sent successfully' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Message ID from provider' })
  messageId?: string;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;
}

// ============================================
// PAGINATION
// ============================================

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size',
    example: 20,
    default: 20,
  })
  @IsOptional()
  pageSize?: number;
}

export class PaginatedMessagesResponseDto {
  @ApiProperty({ description: 'Messages', type: [MessageResponseDto] })
  data: MessageResponseDto[];

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Page size' })
  pageSize: number;

  @ApiProperty({ description: 'Total number of messages' })
  total: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}
