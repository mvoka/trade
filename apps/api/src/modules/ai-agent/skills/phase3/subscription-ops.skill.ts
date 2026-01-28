import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';
import { FEATURE_FLAGS } from '@trades/shared';

/**
 * Input schema for SubscriptionOps skill
 */
const SubscriptionOpsInputSchema = z.object({
  action: z.enum([
    'list_plans',
    'create_subscription',
    'pause_subscription',
    'resume_subscription',
    'cancel_subscription',
    'reschedule_occurrence',
    'skip_occurrence',
    'get_subscription_details',
    'list_occurrences',
  ]).describe('The subscription operation to perform'),
  subscriptionId: z.string().optional().describe('Subscription ID for operations on existing subscriptions'),
  servicePlanId: z.string().optional().describe('Service plan ID for creating subscriptions'),
  consumerProfileId: z.string().optional().describe('Consumer profile ID'),
  occurrenceId: z.string().optional().describe('Occurrence ID for occurrence operations'),
  reason: z.string().optional().describe('Reason for pause, cancel, or skip'),
  newDate: z.string().optional().describe('New date for rescheduling (ISO format)'),
  newTimeSlot: z.string().optional().describe('New time slot for rescheduling'),
  preferredDayOfWeek: z.number().min(0).max(6).optional().describe('Preferred day (0=Sunday, 6=Saturday)'),
  preferredTimeSlot: z.string().optional().describe('Preferred time slot'),
  cancelImmediately: z.boolean().optional().describe('Cancel immediately vs end of period'),
});

type SubscriptionOpsInput = z.infer<typeof SubscriptionOpsInputSchema>;

/**
 * SubscriptionOps Skill
 *
 * Manages subscription lifecycle operations via AI agent.
 * Used by SUBSCRIPTION_MANAGER agent.
 *
 * Feature Flag: AGENT_SUBSCRIPTION_OPS_ENABLED
 */
export class SubscriptionOpsSkill extends BaseSkill {
  readonly name = 'SubscriptionOps';
  readonly description = 'Manage subscription lifecycle including creating, pausing, resuming, cancelling subscriptions and managing service occurrences';
  readonly requiredFlags = [FEATURE_FLAGS.AGENT_SUBSCRIPTION_OPS_ENABLED];
  readonly requiredPermissions = ['subscription:manage'];
  readonly inputSchema: SkillInputSchema = SubscriptionOpsInputSchema;

  protected async executeInternal(
    input: SubscriptionOpsInput,
    context: SkillExecutionContext,
  ): Promise<unknown> {
    this.logger.debug(`SubscriptionOps: ${input.action}`, { sessionId: context.sessionId });

    switch (input.action) {
      case 'list_plans':
        return this.listPlans();

      case 'create_subscription':
        return this.createSubscription(input, context);

      case 'get_subscription_details':
        return this.getSubscriptionDetails(input);

      case 'pause_subscription':
        return this.pauseSubscription(input, context);

      case 'resume_subscription':
        return this.resumeSubscription(input, context);

      case 'cancel_subscription':
        return this.cancelSubscription(input, context);

      case 'list_occurrences':
        return this.listOccurrences(input);

      case 'skip_occurrence':
        return this.skipOccurrence(input, context);

      case 'reschedule_occurrence':
        return this.rescheduleOccurrence(input, context);

      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  }

  private async listPlans() {
    // Stub: would call ServicePlansService.listPlans()
    return {
      action: 'list_plans',
      status: 'success',
      plans: [
        { id: 'plan_weekly', name: 'Weekly Pool Maintenance', price: '$199/mo', interval: 'MONTHLY' },
        { id: 'plan_biweekly', name: 'Bi-Weekly Pool Maintenance', price: '$129/mo', interval: 'MONTHLY' },
      ],
      message: 'Available service plans retrieved',
    };
  }

  private async createSubscription(input: SubscriptionOpsInput, context: SkillExecutionContext) {
    if (!input.servicePlanId || !input.consumerProfileId) {
      return {
        action: 'create_subscription',
        status: 'incomplete',
        missingFields: [
          ...(!input.servicePlanId ? ['servicePlanId'] : []),
          ...(!input.consumerProfileId ? ['consumerProfileId'] : []),
        ],
        message: 'Please provide the required fields to create a subscription',
      };
    }

    // Stub: would call SubscriptionsService.createSubscription()
    return {
      action: 'create_subscription',
      status: 'success',
      subscriptionId: `sub_${Date.now()}_stub`,
      checkoutUrl: `/checkout/stub/${input.servicePlanId}`,
      message: 'Subscription checkout session created. Customer will be redirected to payment.',
    };
  }

  private async getSubscriptionDetails(input: SubscriptionOpsInput) {
    if (!input.subscriptionId) {
      return { action: 'get_subscription_details', status: 'error', message: 'subscriptionId is required' };
    }

    // Stub: would call SubscriptionsService.getSubscription()
    return {
      action: 'get_subscription_details',
      status: 'success',
      subscription: {
        id: input.subscriptionId,
        planName: 'Weekly Pool Maintenance',
        status: 'ACTIVE',
        startDate: new Date().toISOString(),
        nextOccurrence: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      message: 'Subscription details retrieved',
    };
  }

  private async pauseSubscription(input: SubscriptionOpsInput, context: SkillExecutionContext) {
    if (!input.subscriptionId) {
      return { action: 'pause_subscription', status: 'error', message: 'subscriptionId is required' };
    }

    // Stub: would call SubscriptionsService.pauseSubscription()
    return {
      action: 'pause_subscription',
      status: 'success',
      subscriptionId: input.subscriptionId,
      reason: input.reason ?? 'Customer requested pause',
      message: `Subscription ${input.subscriptionId} has been paused`,
    };
  }

  private async resumeSubscription(input: SubscriptionOpsInput, context: SkillExecutionContext) {
    if (!input.subscriptionId) {
      return { action: 'resume_subscription', status: 'error', message: 'subscriptionId is required' };
    }

    // Stub: would call SubscriptionsService.resumeSubscription()
    return {
      action: 'resume_subscription',
      status: 'success',
      subscriptionId: input.subscriptionId,
      message: `Subscription ${input.subscriptionId} has been resumed`,
    };
  }

  private async cancelSubscription(input: SubscriptionOpsInput, context: SkillExecutionContext) {
    if (!input.subscriptionId) {
      return { action: 'cancel_subscription', status: 'error', message: 'subscriptionId is required' };
    }

    // Stub: would call SubscriptionsService.cancelSubscription()
    return {
      action: 'cancel_subscription',
      status: 'success',
      subscriptionId: input.subscriptionId,
      immediate: input.cancelImmediately ?? false,
      reason: input.reason ?? 'Customer requested cancellation',
      message: input.cancelImmediately
        ? `Subscription ${input.subscriptionId} cancelled immediately`
        : `Subscription ${input.subscriptionId} will cancel at end of billing period`,
    };
  }

  private async listOccurrences(input: SubscriptionOpsInput) {
    if (!input.subscriptionId) {
      return { action: 'list_occurrences', status: 'error', message: 'subscriptionId is required' };
    }

    // Stub: would call OccurrenceSchedulerService.getOccurrences()
    return {
      action: 'list_occurrences',
      status: 'success',
      occurrences: [
        { id: 'occ_1', date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), status: 'SCHEDULED' },
        { id: 'occ_2', date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), status: 'SCHEDULED' },
      ],
      message: 'Upcoming occurrences retrieved',
    };
  }

  private async skipOccurrence(input: SubscriptionOpsInput, context: SkillExecutionContext) {
    if (!input.occurrenceId) {
      return { action: 'skip_occurrence', status: 'error', message: 'occurrenceId is required' };
    }

    // Stub: would call OccurrenceSchedulerService.skipOccurrence()
    return {
      action: 'skip_occurrence',
      status: 'success',
      occurrenceId: input.occurrenceId,
      reason: input.reason ?? 'Skipped by request',
      message: `Occurrence ${input.occurrenceId} has been skipped`,
    };
  }

  private async rescheduleOccurrence(input: SubscriptionOpsInput, context: SkillExecutionContext) {
    if (!input.occurrenceId || !input.newDate) {
      return {
        action: 'reschedule_occurrence',
        status: 'error',
        message: 'occurrenceId and newDate are required',
      };
    }

    // Stub: would call OccurrenceSchedulerService.rescheduleOccurrence()
    return {
      action: 'reschedule_occurrence',
      status: 'success',
      occurrenceId: input.occurrenceId,
      newDate: input.newDate,
      newTimeSlot: input.newTimeSlot,
      message: `Occurrence ${input.occurrenceId} rescheduled to ${input.newDate}`,
    };
  }
}

export { SubscriptionOpsInputSchema };
