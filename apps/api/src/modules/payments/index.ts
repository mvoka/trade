/**
 * Payments Module - Barrel Export
 *
 * PHASE 2 STRIPE INTEGRATION PLAN:
 * ================================
 * This module provides payment processing capabilities for the Trades Dispatch Platform.
 *
 * Current Status: STUB IMPLEMENTATION
 * - All methods return mock data
 * - Ready for Stripe SDK integration
 * - Comprehensive logging for debugging
 *
 * Components:
 * - PaymentsModule: NestJS module configuration
 * - PaymentsService: Core payment operations (intents, capture, refund)
 * - EscrowService: Fund holding and release for job payments
 * - MilestoneService: Milestone-based payment management
 * - PaymentsController: REST API endpoints
 *
 * Phase 2 Implementation Checklist:
 * [ ] Install Stripe SDK: npm install stripe
 * [ ] Add Stripe configuration to environment
 * [ ] Initialize Stripe client in PaymentsService
 * [ ] Implement webhook signature verification
 * [ ] Add database schema for payment tracking
 * [ ] Implement Stripe Connect for pro payouts
 * [ ] Add proper error handling for Stripe errors
 * [ ] Implement idempotency keys
 * [ ] Add rate limiting
 * [ ] Set up payment event tracking
 */

// Module
export { PaymentsModule } from './payments.module';

// Services
export { PaymentsService } from './payments.service';
export { EscrowService, EscrowStatus, EscrowTransaction } from './escrow.service';
export { MilestoneService, MilestoneStatus, Milestone } from './milestone.service';

// Controller
export { PaymentsController } from './payments.controller';

// DTOs
export {
  CreatePaymentIntentDto,
  CapturePaymentDto,
  RefundPaymentDto,
  StripeWebhookDto,
  PaymentIntentResponseDto,
  PaymentStatusResponseDto,
  RefundResponseDto,
  WebhookResponseDto,
  PaymentCurrency,
  PaymentIntentStatus,
} from './dto/payments.dto';
