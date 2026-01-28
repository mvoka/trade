import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateSubscriptionDto,
  CheckoutSessionResponseDto,
  ServicePlanResponseDto,
} from './dto/subscriptions.dto';

/**
 * StripeSubscriptionService - Handles Stripe Billing integration
 *
 * P1 Feature: Stub implementation
 * P2 Feature: Full Stripe Billing integration
 *
 * Handles:
 * - Checkout session creation
 * - Subscription lifecycle (pause, resume, cancel)
 * - Webhook processing
 * - Customer management
 */
@Injectable()
export class StripeSubscriptionService {
  private readonly logger = new Logger(StripeSubscriptionService.name);
  private readonly stripeEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.stripeEnabled = !!this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!this.stripeEnabled) {
      this.logger.warn('Stripe is not configured. Using stub implementation.');
    }
  }

  /**
   * Create a Stripe checkout session for subscription
   *
   * P1: Returns stub checkout URL
   * P2: Creates actual Stripe checkout session
   */
  async createCheckoutSession(
    userId: string,
    consumerProfileId: string,
    plan: ServicePlanResponseDto,
    dto: CreateSubscriptionDto,
  ): Promise<CheckoutSessionResponseDto> {
    this.logger.debug(`Creating checkout session for plan: ${plan.id}`);

    if (!this.stripeEnabled) {
      // Stub implementation
      const stubSessionId = `stub_cs_${Date.now()}_${plan.id}`;

      return {
        sessionId: stubSessionId,
        checkoutUrl: `/checkout/stub/${stubSessionId}?plan=${plan.id}&consumer=${consumerProfileId}`,
      };
    }

    // P2: Actual Stripe implementation
    // const stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'));
    //
    // const session = await stripe.checkout.sessions.create({
    //   mode: 'subscription',
    //   customer_email: user.email,
    //   line_items: [{
    //     price: plan.stripePriceId,
    //     quantity: 1,
    //   }],
    //   metadata: {
    //     consumerProfileId,
    //     servicePlanId: plan.id,
    //     preferredDayOfWeek: dto.preferredDayOfWeek,
    //     preferredTimeSlot: dto.preferredTimeSlot,
    //   },
    //   success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: `${baseUrl}/subscription/cancel`,
    // });
    //
    // return {
    //   sessionId: session.id,
    //   checkoutUrl: session.url,
    // };

    // Stub fallback
    const stubSessionId = `stub_cs_${Date.now()}_${plan.id}`;
    return {
      sessionId: stubSessionId,
      checkoutUrl: `/checkout/stub/${stubSessionId}`,
    };
  }

  /**
   * Pause a Stripe subscription
   *
   * P1: Stub - logs action
   * P2: Pauses Stripe subscription
   */
  async pauseSubscription(stripeSubscriptionId: string): Promise<void> {
    this.logger.debug(`Pausing Stripe subscription: ${stripeSubscriptionId}`);

    if (!this.stripeEnabled) {
      this.logger.debug(`[STUB] Paused subscription: ${stripeSubscriptionId}`);
      return;
    }

    // P2: Actual Stripe implementation
    // const stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'));
    // await stripe.subscriptions.update(stripeSubscriptionId, {
    //   pause_collection: { behavior: 'mark_uncollectible' },
    // });
  }

  /**
   * Resume a paused Stripe subscription
   *
   * P1: Stub - logs action
   * P2: Resumes Stripe subscription
   */
  async resumeSubscription(stripeSubscriptionId: string): Promise<void> {
    this.logger.debug(`Resuming Stripe subscription: ${stripeSubscriptionId}`);

    if (!this.stripeEnabled) {
      this.logger.debug(`[STUB] Resumed subscription: ${stripeSubscriptionId}`);
      return;
    }

    // P2: Actual Stripe implementation
    // const stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'));
    // await stripe.subscriptions.update(stripeSubscriptionId, {
    //   pause_collection: null,
    // });
  }

  /**
   * Cancel a Stripe subscription
   *
   * P1: Stub - logs action
   * P2: Cancels Stripe subscription
   */
  async cancelSubscription(
    stripeSubscriptionId: string,
    immediate: boolean = false,
  ): Promise<void> {
    this.logger.debug(
      `Cancelling Stripe subscription: ${stripeSubscriptionId} (immediate: ${immediate})`,
    );

    if (!this.stripeEnabled) {
      this.logger.debug(`[STUB] Cancelled subscription: ${stripeSubscriptionId}`);
      return;
    }

    // P2: Actual Stripe implementation
    // const stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'));
    //
    // if (immediate) {
    //   await stripe.subscriptions.cancel(stripeSubscriptionId);
    // } else {
    //   await stripe.subscriptions.update(stripeSubscriptionId, {
    //     cancel_at_period_end: true,
    //   });
    // }
  }

  /**
   * Process Stripe webhook event
   *
   * P1: Stub - logs event
   * P2: Full webhook processing
   */
  async processWebhookEvent(
    eventType: string,
    eventData: Record<string, unknown>,
  ): Promise<{ processed: boolean; action?: string }> {
    this.logger.debug(`Processing Stripe webhook: ${eventType}`);

    if (!this.stripeEnabled) {
      this.logger.debug(`[STUB] Processed webhook: ${eventType}`);
      return { processed: true, action: 'stub' };
    }

    // P2: Handle different event types
    switch (eventType) {
      case 'checkout.session.completed':
        // Extract metadata and create subscription
        return { processed: true, action: 'subscription_created' };

      case 'invoice.paid':
        // Update subscription billing dates
        return { processed: true, action: 'invoice_paid' };

      case 'invoice.payment_failed':
        // Mark subscription as past_due
        return { processed: true, action: 'payment_failed' };

      case 'customer.subscription.deleted':
        // Mark subscription as cancelled
        return { processed: true, action: 'subscription_cancelled' };

      case 'customer.subscription.updated':
        // Sync subscription status
        return { processed: true, action: 'subscription_updated' };

      default:
        this.logger.debug(`Unhandled webhook event: ${eventType}`);
        return { processed: false };
    }
  }

  /**
   * Get or create Stripe customer for user
   *
   * P1: Returns stub customer ID
   * P2: Gets/creates actual Stripe customer
   */
  async getOrCreateCustomer(
    userId: string,
    email: string,
    name?: string,
  ): Promise<string> {
    this.logger.debug(`Getting/creating Stripe customer for user: ${userId}`);

    if (!this.stripeEnabled) {
      return `stub_cus_${userId}`;
    }

    // P2: Actual Stripe implementation
    // const stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'));
    //
    // // Check if customer exists in metadata
    // const customers = await stripe.customers.list({
    //   email,
    //   limit: 1,
    // });
    //
    // if (customers.data.length > 0) {
    //   return customers.data[0].id;
    // }
    //
    // // Create new customer
    // const customer = await stripe.customers.create({
    //   email,
    //   name,
    //   metadata: { userId },
    // });
    //
    // return customer.id;

    return `stub_cus_${userId}`;
  }

  /**
   * Create Stripe price for a service plan
   *
   * P1: Returns stub price ID
   * P2: Creates actual Stripe price
   */
  async createPrice(
    planId: string,
    amountCents: number,
    currency: string,
    interval: string,
  ): Promise<string> {
    this.logger.debug(`Creating Stripe price for plan: ${planId}`);

    if (!this.stripeEnabled) {
      return `stub_price_${planId}`;
    }

    // P2: Actual Stripe implementation
    // const stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'));
    //
    // const stripeInterval = this.mapBillingInterval(interval);
    //
    // const price = await stripe.prices.create({
    //   unit_amount: amountCents,
    //   currency: currency.toLowerCase(),
    //   recurring: stripeInterval ? { interval: stripeInterval } : undefined,
    //   product_data: {
    //     name: `Service Plan ${planId}`,
    //   },
    //   metadata: { planId },
    // });
    //
    // return price.id;

    return `stub_price_${planId}`;
  }

  /**
   * Map billing interval to Stripe interval
   */
  private mapBillingInterval(interval: string): string | null {
    switch (interval) {
      case 'WEEKLY':
        return 'week';
      case 'MONTHLY':
        return 'month';
      case 'QUARTERLY':
        return 'month'; // 3 months
      case 'ANNUALLY':
        return 'year';
      case 'ONE_TIME':
        return null;
      default:
        return 'month';
    }
  }
}
