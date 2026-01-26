import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
  IsEnum,
  MaxLength,
} from 'class-validator';

/**
 * Supported currencies for payment processing
 * Phase 2: Will be validated against Stripe's supported currencies
 */
export enum PaymentCurrency {
  USD = 'usd',
  CAD = 'cad',
  EUR = 'eur',
  GBP = 'gbp',
}

/**
 * Payment intent status enum
 * Phase 2: Will map to Stripe PaymentIntent statuses
 */
export enum PaymentIntentStatus {
  REQUIRES_PAYMENT_METHOD = 'requires_payment_method',
  REQUIRES_CONFIRMATION = 'requires_confirmation',
  REQUIRES_ACTION = 'requires_action',
  PROCESSING = 'processing',
  REQUIRES_CAPTURE = 'requires_capture',
  CANCELED = 'canceled',
  SUCCEEDED = 'succeeded',
}

/**
 * DTO for creating a payment intent
 * Phase 2: Will integrate with Stripe PaymentIntent.create()
 */
export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Payment amount in cents (smallest currency unit)',
    example: 5000,
    minimum: 50,
  })
  @IsNumber()
  @Min(50, { message: 'Amount must be at least 50 cents' })
  amount: number;

  @ApiProperty({
    description: 'Three-letter ISO currency code',
    example: 'usd',
    enum: PaymentCurrency,
  })
  @IsEnum(PaymentCurrency, { message: 'Invalid currency code' })
  currency: PaymentCurrency;

  @ApiPropertyOptional({
    description: 'Additional metadata for the payment (jobId, customerId, etc.)',
    example: { jobId: 'job_123', customerId: 'cust_456' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Description of the payment',
    example: 'Payment for plumbing services - Job #123',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Customer ID for the payment',
    example: 'cust_abc123',
  })
  @IsString()
  @IsOptional()
  customerId?: string;
}

/**
 * DTO for capturing an authorized payment
 * Phase 2: Will integrate with Stripe PaymentIntent.capture()
 */
export class CapturePaymentDto {
  @ApiPropertyOptional({
    description: 'Amount to capture in cents (if less than authorized amount)',
    example: 4500,
    minimum: 50,
  })
  @IsNumber()
  @IsOptional()
  @Min(50, { message: 'Amount must be at least 50 cents' })
  amountToCapture?: number;

  @ApiPropertyOptional({
    description: 'Statement descriptor for the charge',
    example: 'TRADES-JOB123',
    maxLength: 22,
  })
  @IsString()
  @IsOptional()
  @MaxLength(22)
  statementDescriptor?: string;
}

/**
 * DTO for refunding a payment
 * Phase 2: Will integrate with Stripe Refund.create()
 */
export class RefundPaymentDto {
  @ApiPropertyOptional({
    description: 'Amount to refund in cents (partial refund). If not provided, full refund.',
    example: 2500,
    minimum: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(1, { message: 'Refund amount must be at least 1 cent' })
  amount?: number;

  @ApiPropertyOptional({
    description: 'Reason for the refund',
    example: 'Customer requested refund due to service issues',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the refund',
    example: { refundedBy: 'admin_123', ticketId: 'ticket_456' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;
}

/**
 * DTO for Stripe webhook events
 * Phase 2: Will be validated using Stripe's webhook signature verification
 */
export class StripeWebhookDto {
  @ApiProperty({
    description: 'Stripe event type',
    example: 'payment_intent.succeeded',
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: 'Stripe event data object',
  })
  @IsObject()
  data: {
    object: Record<string, unknown>;
  };
}

// ==================== Response DTOs ====================

/**
 * Response DTO for payment intent creation
 */
export class PaymentIntentResponseDto {
  @ApiProperty({
    description: 'Payment intent ID',
    example: 'pi_mock_abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Client secret for frontend payment confirmation',
    example: 'pi_mock_abc123_secret_xyz789',
  })
  clientSecret: string;

  @ApiProperty({
    description: 'Payment amount in cents',
    example: 5000,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'usd',
  })
  currency: string;

  @ApiProperty({
    description: 'Current status of the payment intent',
    enum: PaymentIntentStatus,
    example: PaymentIntentStatus.REQUIRES_PAYMENT_METHOD,
  })
  status: PaymentIntentStatus;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  metadata?: Record<string, string>;
}

/**
 * Response DTO for payment status
 */
export class PaymentStatusResponseDto {
  @ApiProperty({
    description: 'Payment intent ID',
    example: 'pi_mock_abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Current status',
    enum: PaymentIntentStatus,
    example: PaymentIntentStatus.SUCCEEDED,
  })
  status: PaymentIntentStatus;

  @ApiProperty({
    description: 'Payment amount in cents',
    example: 5000,
  })
  amount: number;

  @ApiProperty({
    description: 'Amount captured in cents',
    example: 5000,
  })
  amountCaptured: number;

  @ApiProperty({
    description: 'Amount refunded in cents',
    example: 0,
  })
  amountRefunded: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'usd',
  })
  currency: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: string;

  @ApiPropertyOptional({
    description: 'Payment metadata',
  })
  metadata?: Record<string, string>;
}

/**
 * Response DTO for refund operations
 */
export class RefundResponseDto {
  @ApiProperty({
    description: 'Refund ID',
    example: 're_mock_abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Payment intent ID that was refunded',
    example: 'pi_mock_abc123',
  })
  paymentIntentId: string;

  @ApiProperty({
    description: 'Refund amount in cents',
    example: 2500,
  })
  amount: number;

  @ApiProperty({
    description: 'Refund status',
    example: 'succeeded',
  })
  status: string;

  @ApiProperty({
    description: 'Refund creation timestamp',
    example: '2024-01-15T11:00:00Z',
  })
  createdAt: string;
}

/**
 * Response DTO for webhook handling
 */
export class WebhookResponseDto {
  @ApiProperty({
    description: 'Whether the webhook was received successfully',
    example: true,
  })
  received: boolean;

  @ApiProperty({
    description: 'Event type that was processed',
    example: 'payment_intent.succeeded',
  })
  eventType: string;
}
