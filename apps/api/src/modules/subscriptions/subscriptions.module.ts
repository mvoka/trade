import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { ServicePlansService } from './service-plans.service';
import { OccurrenceSchedulerService } from './occurrence-scheduler.service';
import { StripeSubscriptionService } from './stripe-subscription.service';
import { AuditModule } from '../audit/audit.module';

/**
 * SubscriptionsModule - Subscription services management
 *
 * Feature Flags:
 * - SUBSCRIPTIONS_ENABLED: Gates the entire module (per region)
 *
 * This module is disabled by default. Admins can enable it per region
 * through the feature flags management interface.
 *
 * Provides:
 * - Service plan management (templates for recurring services)
 * - Subscription lifecycle (create, pause, resume, cancel)
 * - Occurrence scheduling (auto-generate jobs from subscriptions)
 * - Stripe Billing integration (P2)
 *
 * Key Services:
 * - ServicePlansService: CRUD for service plans
 * - SubscriptionsService: Subscription lifecycle management
 * - OccurrenceSchedulerService: Job scheduling from subscriptions
 * - StripeSubscriptionService: Stripe Billing integration
 *
 * Dependencies:
 * - PrismaService (global)
 * - FeatureFlagsService (global)
 * - PolicyService (global)
 * - AuditModule (for audit logging)
 */
@Module({
  imports: [AuditModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    ServicePlansService,
    OccurrenceSchedulerService,
    StripeSubscriptionService,
  ],
  exports: [
    SubscriptionsService,
    ServicePlansService,
    OccurrenceSchedulerService,
    StripeSubscriptionService,
  ],
})
export class SubscriptionsModule {}
