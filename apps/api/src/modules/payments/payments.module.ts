import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { EscrowService } from './escrow.service';
import { MilestoneService } from './milestone.service';
import { PaymentsController } from './payments.controller';

/**
 * PaymentsModule - Payment Processing Module
 *
 * PHASE 2 STRIPE INTEGRATION PLAN:
 * ================================
 * 1. Add ConfigModule for Stripe configuration:
 *    - STRIPE_SECRET_KEY
 *    - STRIPE_PUBLISHABLE_KEY
 *    - STRIPE_WEBHOOK_SECRET
 *
 * 2. Add PrismaModule for database access:
 *    - Store payment records
 *    - Track escrow transactions
 *    - Manage milestones
 *
 * 3. Add HttpModule for external API calls (optional)
 *
 * 4. Consider adding:
 *    - StripeModule (custom module for Stripe client)
 *    - EventEmitterModule for payment events
 *    - BullModule for async payment processing
 *
 * Services:
 * - PaymentsService: Core Stripe payment operations
 * - EscrowService: Fund holding and release management
 * - MilestoneService: Milestone-based payment management
 */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, EscrowService, MilestoneService],
  exports: [PaymentsService, EscrowService, MilestoneService],
})
export class PaymentsModule {}
