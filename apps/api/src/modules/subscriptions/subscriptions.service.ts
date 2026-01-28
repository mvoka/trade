import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, DayOfWeek } from '@trades/prisma';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { AuditService } from '../audit/audit.service';
import { ServicePlansService } from './service-plans.service';
import { StripeSubscriptionService } from './stripe-subscription.service';
import { FEATURE_FLAGS, AUDIT_ACTIONS, ERROR_CODES } from '@trades/shared';
import {
  CreateSubscriptionDto,
  SubscriptionResponseDto,
  PauseSubscriptionDto,
  CancelSubscriptionDto,
  CheckoutSessionResponseDto,
  ServicePlanResponseDto,
} from './dto/subscriptions.dto';

/**
 * SubscriptionsService - Manages customer subscriptions
 *
 * Feature Flags:
 * - SUBSCRIPTIONS_ENABLED: Gates the entire module
 *
 * Handles:
 * - Subscription lifecycle (create, pause, resume, cancel)
 * - Stripe Billing integration
 * - Schedule generation for recurring services
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly auditService: AuditService,
    private readonly servicePlansService: ServicePlansService,
    private readonly stripeSubscriptionService: StripeSubscriptionService,
  ) {}

  /**
   * Check if subscriptions feature is enabled
   */
  async isEnabled(regionId?: string): Promise<boolean> {
    return this.featureFlagsService.isEnabled(
      FEATURE_FLAGS.SUBSCRIPTIONS_ENABLED,
      { regionId },
    );
  }

  /**
   * Ensure subscriptions feature is enabled
   */
  async ensureEnabled(regionId?: string): Promise<void> {
    const enabled = await this.isEnabled(regionId);
    if (!enabled) {
      throw new ForbiddenException({
        message: 'Subscriptions feature is not enabled',
        errorCode: ERROR_CODES.SUBSCRIPTION_INACTIVE,
      });
    }
  }

  /**
   * Create a new subscription (initiates Stripe checkout)
   */
  async createSubscription(
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<CheckoutSessionResponseDto> {
    await this.ensureEnabled();

    // Get consumer profile
    const consumerProfile = await this.prisma.consumerProfile.findUnique({
      where: { userId },
    });

    if (!consumerProfile) {
      throw new NotFoundException({
        message: 'Consumer profile not found. Please complete registration first.',
        errorCode: ERROR_CODES.CONSUMER_PROFILE_NOT_FOUND,
      });
    }

    // Get service plan
    const plan = await this.servicePlansService.getPlanById(dto.servicePlanId);

    if (!plan.isActive) {
      throw new BadRequestException({
        message: 'Service plan is not active',
        errorCode: ERROR_CODES.SERVICE_PLAN_NOT_FOUND,
      });
    }

    // Check for existing active subscription to same plan
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        consumerProfileId: consumerProfile.id,
        servicePlanId: dto.servicePlanId,
        status: { in: ['ACTIVE', 'TRIAL', 'PAUSED'] },
      },
    });

    if (existingSubscription) {
      throw new BadRequestException({
        message: 'You already have an active subscription to this plan',
        errorCode: ERROR_CODES.SUBSCRIPTION_ALREADY_EXISTS,
      });
    }

    // For one-time plans, create subscription directly
    if (plan.billingInterval === 'ONE_TIME') {
      const subscription = await this.createOneTimeSubscription(
        consumerProfile.id,
        dto,
        plan,
      );

      // Return stub checkout response for one-time
      return {
        sessionId: `one_time_${subscription.id}`,
        checkoutUrl: `/payment/one-time/${subscription.id}`,
      };
    }

    // Create Stripe checkout session for recurring plans
    const checkoutSession = await this.stripeSubscriptionService.createCheckoutSession(
      userId,
      consumerProfile.id,
      plan,
      dto,
    );

    return checkoutSession;
  }

  /**
   * Create a one-time subscription (no Stripe recurring billing)
   */
  private async createOneTimeSubscription(
    consumerProfileId: string,
    dto: CreateSubscriptionDto,
    plan: ServicePlanResponseDto,
  ): Promise<SubscriptionResponseDto> {
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();

    const subscription = await this.prisma.subscription.create({
      data: {
        consumerProfileId,
        servicePlanId: dto.servicePlanId,
        status: 'ACTIVE',
        startDate,
        preferredDayOfWeek: dto.preferredDayOfWeek as DayOfWeek | undefined,
        preferredTimeSlot: dto.preferredTimeSlot,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
      include: {
        servicePlan: true,
      },
    });

    // Create single occurrence for one-time service
    await this.prisma.serviceOccurrence.create({
      data: {
        subscriptionId: subscription.id,
        scheduledDate: startDate,
        scheduledTimeSlot: dto.preferredTimeSlot,
        occurrenceNumber: 1,
        status: 'SCHEDULED',
      },
    });

    this.logger.log(`One-time subscription created: ${subscription.id}`);

    return this.mapToResponse(subscription);
  }

  /**
   * Handle successful Stripe subscription (webhook callback)
   */
  async handleSubscriptionCreated(
    stripeSubscriptionId: string,
    stripeCustomerId: string,
    consumerProfileId: string,
    servicePlanId: string,
    metadata: Record<string, unknown>,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.prisma.subscription.create({
      data: {
        consumerProfileId,
        servicePlanId,
        status: 'ACTIVE',
        startDate: new Date(),
        stripeSubscriptionId,
        stripeCustomerId,
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days stub
        preferredDayOfWeek: (metadata.preferredDayOfWeek as DayOfWeek) || undefined,
        preferredTimeSlot: metadata.preferredTimeSlot as string | undefined,
        metadata: metadata as Prisma.InputJsonValue,
      },
      include: {
        servicePlan: true,
      },
    });

    // Generate initial occurrences
    await this.generateOccurrences(subscription.id);

    // Audit log
    await this.auditService.log({
      action: AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
      targetType: 'Subscription',
      targetId: subscription.id,
      details: { servicePlanId, stripeSubscriptionId },
    });

    this.logger.log(`Subscription created: ${subscription.id}`);

    return this.mapToResponse(subscription);
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(
    id: string,
    userId: string,
  ): Promise<SubscriptionResponseDto> {
    await this.ensureEnabled();

    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        servicePlan: true,
        consumerProfile: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException({
        message: 'Subscription not found',
        errorCode: ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
      });
    }

    // Verify ownership
    if (subscription.consumerProfile.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapToResponse(subscription);
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userId: string): Promise<SubscriptionResponseDto[]> {
    await this.ensureEnabled();

    const consumerProfile = await this.prisma.consumerProfile.findUnique({
      where: { userId },
    });

    if (!consumerProfile) {
      return [];
    }

    const subscriptions = await this.prisma.subscription.findMany({
      where: { consumerProfileId: consumerProfile.id },
      include: { servicePlan: true },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map((sub) => this.mapToResponse(sub));
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(
    id: string,
    userId: string,
    dto: PauseSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    await this.ensureEnabled();

    const subscription = await this.getSubscriptionWithOwnershipCheck(id, userId);

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException('Can only pause active subscriptions');
    }

    // Pause in Stripe if applicable
    if (subscription.stripeSubscriptionId) {
      await this.stripeSubscriptionService.pauseSubscription(
        subscription.stripeSubscriptionId,
      );
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: 'PAUSED',
        pausedAt: new Date(),
        metadata: {
          ...(subscription.metadata as Record<string, unknown> ?? {}),
          pauseReason: dto.reason,
        },
      },
      include: { servicePlan: true },
    });

    // Audit log
    await this.auditService.log({
      action: AUDIT_ACTIONS.SUBSCRIPTION_PAUSED,
      actorId: userId,
      targetType: 'Subscription',
      targetId: id,
      details: { reason: dto.reason },
    });

    this.logger.log(`Subscription paused: ${id}`);

    return this.mapToResponse(updated);
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(
    id: string,
    userId: string,
  ): Promise<SubscriptionResponseDto> {
    await this.ensureEnabled();

    const subscription = await this.getSubscriptionWithOwnershipCheck(id, userId);

    if (subscription.status !== 'PAUSED') {
      throw new BadRequestException('Can only resume paused subscriptions');
    }

    // Resume in Stripe if applicable
    if (subscription.stripeSubscriptionId) {
      await this.stripeSubscriptionService.resumeSubscription(
        subscription.stripeSubscriptionId,
      );
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        pausedAt: null,
      },
      include: { servicePlan: true },
    });

    // Regenerate upcoming occurrences
    await this.generateOccurrences(id);

    // Audit log
    await this.auditService.log({
      action: AUDIT_ACTIONS.SUBSCRIPTION_RESUMED,
      actorId: userId,
      targetType: 'Subscription',
      targetId: id,
    });

    this.logger.log(`Subscription resumed: ${id}`);

    return this.mapToResponse(updated);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    id: string,
    userId: string,
    dto: CancelSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    await this.ensureEnabled();

    const subscription = await this.getSubscriptionWithOwnershipCheck(id, userId);

    if (subscription.status === 'CANCELLED') {
      throw new BadRequestException('Subscription is already cancelled');
    }

    // Cancel in Stripe if applicable
    if (subscription.stripeSubscriptionId) {
      await this.stripeSubscriptionService.cancelSubscription(
        subscription.stripeSubscriptionId,
        dto.immediate ?? false,
      );
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: dto.reason,
        endDate: dto.immediate ? new Date() : subscription.nextBillingDate,
      },
      include: { servicePlan: true },
    });

    // Cancel pending occurrences
    await this.prisma.serviceOccurrence.updateMany({
      where: {
        subscriptionId: id,
        status: 'SCHEDULED',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    // Audit log
    await this.auditService.log({
      action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED,
      actorId: userId,
      targetType: 'Subscription',
      targetId: id,
      details: { reason: dto.reason, immediate: dto.immediate },
    });

    this.logger.log(`Subscription cancelled: ${id}`);

    return this.mapToResponse(updated);
  }

  /**
   * Generate service occurrences for a subscription
   */
  async generateOccurrences(subscriptionId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { servicePlan: true },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      return;
    }

    const plan = subscription.servicePlan;

    // Get last occurrence number
    const lastOccurrence = await this.prisma.serviceOccurrence.findFirst({
      where: { subscriptionId },
      orderBy: { occurrenceNumber: 'desc' },
    });

    const startNumber = (lastOccurrence?.occurrenceNumber ?? 0) + 1;

    // Calculate next dates based on billing interval
    const dates = this.calculateOccurrenceDates(
      subscription.startDate,
      plan.billingInterval,
      plan.visitsPerInterval,
      subscription.preferredDayOfWeek,
      startNumber,
    );

    // Create occurrences
    for (let i = 0; i < dates.length; i++) {
      await this.prisma.serviceOccurrence.create({
        data: {
          subscriptionId,
          scheduledDate: dates[i],
          scheduledTimeSlot: subscription.preferredTimeSlot,
          occurrenceNumber: startNumber + i,
          status: 'SCHEDULED',
        },
      });
    }

    this.logger.debug(`Generated ${dates.length} occurrences for subscription ${subscriptionId}`);
  }

  /**
   * Calculate occurrence dates based on billing interval
   */
  private calculateOccurrenceDates(
    startDate: Date,
    billingInterval: string,
    visitsPerInterval: number,
    preferredDayOfWeek: string | null,
    _startNumber: number,
  ): Date[] {
    const dates: Date[] = [];
    const now = new Date();
    let currentDate = new Date(Math.max(startDate.getTime(), now.getTime()));

    // Generate dates for the next billing period
    const daysInPeriod = this.getDaysInBillingPeriod(billingInterval);
    const daysBetweenVisits = Math.floor(daysInPeriod / visitsPerInterval);

    for (let i = 0; i < visitsPerInterval; i++) {
      let visitDate = new Date(currentDate);
      visitDate.setDate(visitDate.getDate() + (i * daysBetweenVisits));

      // Adjust to preferred day of week if set
      if (preferredDayOfWeek) {
        visitDate = this.adjustToPreferredDay(visitDate, preferredDayOfWeek);
      }

      // Only add future dates
      if (visitDate > now) {
        dates.push(visitDate);
      }
    }

    return dates;
  }

  /**
   * Get days in billing period
   */
  private getDaysInBillingPeriod(billingInterval: string): number {
    switch (billingInterval) {
      case 'WEEKLY':
        return 7;
      case 'BIWEEKLY':
        return 14;
      case 'MONTHLY':
        return 30;
      case 'QUARTERLY':
        return 90;
      case 'ANNUALLY':
        return 365;
      case 'ONE_TIME':
        return 1;
      default:
        return 30;
    }
  }

  /**
   * Adjust date to preferred day of week
   */
  private adjustToPreferredDay(date: Date, preferredDay: string): Date {
    const dayMap: Record<string, number> = {
      SUNDAY: 0,
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
    };

    const targetDay = dayMap[preferredDay];
    if (targetDay === undefined) return date;

    const currentDay = date.getDay();
    const diff = targetDay - currentDay;
    const adjustedDate = new Date(date);
    adjustedDate.setDate(adjustedDate.getDate() + diff);

    return adjustedDate;
  }

  /**
   * Get subscription with ownership check
   */
  private async getSubscriptionWithOwnershipCheck(
    id: string,
    userId: string,
  ): Promise<{
    id: string;
    status: string;
    stripeSubscriptionId: string | null;
    nextBillingDate: Date | null;
    metadata: unknown;
  } & { servicePlan: { id: string } }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        servicePlan: true,
        consumerProfile: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException({
        message: 'Subscription not found',
        errorCode: ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
      });
    }

    if (subscription.consumerProfile.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return subscription;
  }

  /**
   * Map database entity to response DTO
   */
  private mapToResponse(subscription: {
    id: string;
    consumerProfileId: string;
    servicePlanId: string;
    servicePlan: {
      id: string;
      name: string;
      description: string | null;
      billingInterval: string;
      pricePerIntervalCents: number;
      currency: string;
      serviceTemplate: unknown;
      visitsPerInterval: number;
      estimatedDurationMins: number | null;
      serviceCategoryId: string | null;
      proProfileId: string | null;
      isActive: boolean;
      isPublic: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
    status: string;
    startDate: Date;
    endDate: Date | null;
    pausedAt: Date | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
    stripeSubscriptionId: string | null;
    nextBillingDate: Date | null;
    lastBillingDate: Date | null;
    preferredDayOfWeek: string | null;
    preferredTimeSlot: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SubscriptionResponseDto {
    return {
      id: subscription.id,
      consumerProfileId: subscription.consumerProfileId,
      servicePlanId: subscription.servicePlanId,
      servicePlan: {
        id: subscription.servicePlan.id,
        name: subscription.servicePlan.name,
        description: subscription.servicePlan.description ?? undefined,
        billingInterval: subscription.servicePlan.billingInterval,
        pricePerIntervalCents: subscription.servicePlan.pricePerIntervalCents,
        currency: subscription.servicePlan.currency,
        serviceTemplate: subscription.servicePlan.serviceTemplate as Record<string, unknown>,
        visitsPerInterval: subscription.servicePlan.visitsPerInterval,
        estimatedDurationMins: subscription.servicePlan.estimatedDurationMins ?? undefined,
        serviceCategoryId: subscription.servicePlan.serviceCategoryId ?? undefined,
        proProfileId: subscription.servicePlan.proProfileId ?? undefined,
        isActive: subscription.servicePlan.isActive,
        isPublic: subscription.servicePlan.isPublic,
        createdAt: subscription.servicePlan.createdAt,
        updatedAt: subscription.servicePlan.updatedAt,
      },
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate ?? undefined,
      pausedAt: subscription.pausedAt ?? undefined,
      cancelledAt: subscription.cancelledAt ?? undefined,
      cancelReason: subscription.cancelReason ?? undefined,
      stripeSubscriptionId: subscription.stripeSubscriptionId ?? undefined,
      nextBillingDate: subscription.nextBillingDate ?? undefined,
      lastBillingDate: subscription.lastBillingDate ?? undefined,
      preferredDayOfWeek: subscription.preferredDayOfWeek ?? undefined,
      preferredTimeSlot: subscription.preferredTimeSlot ?? undefined,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }
}
