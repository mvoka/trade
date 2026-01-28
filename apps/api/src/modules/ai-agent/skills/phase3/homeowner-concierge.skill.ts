import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';
import { FEATURE_FLAGS } from '@trades/shared';

/**
 * Input schema for HomeownerConcierge skill
 */
const HomeownerConciergeInputSchema = z.object({
  action: z.enum([
    'browse_plans',
    'book_service',
    'manage_subscription',
    'view_service_history',
    'update_profile',
    'get_upcoming_services',
    'ask_question',
    'request_callback',
  ]).describe('The homeowner operation to perform'),
  consumerId: z.string().optional().describe('Consumer profile ID'),
  serviceCategoryId: z.string().optional().describe('Service category filter'),
  planId: z.string().optional().describe('Service plan ID'),
  subscriptionId: z.string().optional().describe('Subscription ID'),
  subscriptionAction: z.enum(['pause', 'resume', 'cancel']).optional().describe('Subscription action'),
  reason: z.string().optional().describe('Reason for action'),
  question: z.string().optional().describe('Question text for inquiries'),
  profileUpdates: z.object({
    propertyType: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    preferredContactMethod: z.string().optional(),
  }).optional().describe('Profile update fields'),
  callbackPhone: z.string().optional().describe('Phone number for callback request'),
  preferredTime: z.string().optional().describe('Preferred time for callback'),
});

type HomeownerConciergeInput = z.infer<typeof HomeownerConciergeInputSchema>;

/**
 * HomeownerConcierge Skill
 *
 * Customer-facing skill for homeowner interactions.
 * Used by HOMEOWNER_CONCIERGE agent.
 *
 * Feature Flag: AGENT_HOMEOWNER_CONCIERGE_ENABLED
 */
export class HomeownerConciergeSkill extends BaseSkill {
  readonly name = 'HomeownerConcierge';
  readonly description = 'Assist homeowners with browsing services, managing subscriptions, viewing service history, and general inquiries';
  readonly requiredFlags = [FEATURE_FLAGS.AGENT_HOMEOWNER_CONCIERGE_ENABLED];
  readonly requiredPermissions = ['homeowner:view'];
  readonly inputSchema: SkillInputSchema = HomeownerConciergeInputSchema;

  protected async executeInternal(
    input: HomeownerConciergeInput,
    context: SkillExecutionContext,
  ): Promise<unknown> {
    this.logger.debug(`HomeownerConcierge: ${input.action}`, { sessionId: context.sessionId });

    switch (input.action) {
      case 'browse_plans':
        return this.browsePlans(input);

      case 'book_service':
        return this.bookService(input, context);

      case 'manage_subscription':
        return this.manageSubscription(input, context);

      case 'view_service_history':
        return this.viewServiceHistory(input);

      case 'update_profile':
        return this.updateProfile(input, context);

      case 'get_upcoming_services':
        return this.getUpcomingServices(input);

      case 'ask_question':
        return this.handleQuestion(input, context);

      case 'request_callback':
        return this.requestCallback(input, context);

      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  }

  private async browsePlans(input: HomeownerConciergeInput) {
    // Stub: would call ServicePlansService.listPlans()
    return {
      action: 'browse_plans',
      status: 'success',
      plans: [
        {
          id: 'plan_weekly',
          name: 'Weekly Pool Maintenance',
          description: 'Complete weekly pool cleaning and chemical balancing',
          price: '$199/month',
          frequency: '4 visits per month',
        },
        {
          id: 'plan_biweekly',
          name: 'Bi-Weekly Pool Maintenance',
          description: 'Bi-weekly pool cleaning and chemical check',
          price: '$129/month',
          frequency: '2 visits per month',
        },
        {
          id: 'plan_opening',
          name: 'Pool Opening (Seasonal)',
          description: 'Full spring pool opening service',
          price: '$299 (one-time)',
          frequency: 'One-time service',
        },
      ],
      message: 'Here are our available service plans. Would you like more details about any of them?',
    };
  }

  private async bookService(input: HomeownerConciergeInput, context: SkillExecutionContext) {
    if (!input.planId) {
      return {
        action: 'book_service',
        status: 'incomplete',
        missingFields: ['planId'],
        message: 'Which service plan would you like to subscribe to? I can show you the available plans.',
      };
    }

    // Stub: would initiate subscription checkout
    return {
      action: 'book_service',
      status: 'success',
      planId: input.planId,
      checkoutUrl: `/checkout/stub/${input.planId}`,
      message: 'I\'ve set up your subscription. Please complete the checkout to activate your service.',
    };
  }

  private async manageSubscription(input: HomeownerConciergeInput, context: SkillExecutionContext) {
    if (!input.subscriptionId) {
      return {
        action: 'manage_subscription',
        status: 'incomplete',
        missingFields: ['subscriptionId'],
        message: 'Which subscription would you like to manage? I can list your active subscriptions.',
      };
    }

    if (!input.subscriptionAction) {
      return {
        action: 'manage_subscription',
        status: 'incomplete',
        missingFields: ['subscriptionAction'],
        options: ['pause', 'resume', 'cancel'],
        message: 'What would you like to do with this subscription? You can pause, resume, or cancel it.',
      };
    }

    // Stub: would call SubscriptionsService
    const messages: Record<string, string> = {
      pause: 'Your subscription has been paused. You can resume it anytime.',
      resume: 'Your subscription has been resumed. Your next service will be scheduled automatically.',
      cancel: 'Your subscription has been cancelled. We\'re sorry to see you go.',
    };

    return {
      action: 'manage_subscription',
      status: 'success',
      subscriptionId: input.subscriptionId,
      subscriptionAction: input.subscriptionAction,
      reason: input.reason,
      message: messages[input.subscriptionAction],
    };
  }

  private async viewServiceHistory(input: HomeownerConciergeInput) {
    // Stub: would call HomeownerService.getJobs()
    return {
      action: 'view_service_history',
      status: 'success',
      services: [
        { date: '2025-04-15', service: 'Weekly Pool Maintenance', status: 'COMPLETED', rating: 5 },
        { date: '2025-04-08', service: 'Weekly Pool Maintenance', status: 'COMPLETED', rating: 4 },
        { date: '2025-04-01', service: 'Weekly Pool Maintenance', status: 'COMPLETED', rating: 5 },
      ],
      message: 'Here is your recent service history.',
    };
  }

  private async updateProfile(input: HomeownerConciergeInput, context: SkillExecutionContext) {
    if (!input.profileUpdates) {
      return {
        action: 'update_profile',
        status: 'incomplete',
        message: 'What information would you like to update? You can change your property type, address, phone, or preferred contact method.',
      };
    }

    // Stub: would call ConsumerProfileService.updateProfile()
    return {
      action: 'update_profile',
      status: 'success',
      updates: input.profileUpdates,
      message: 'Your profile has been updated successfully.',
    };
  }

  private async getUpcomingServices(input: HomeownerConciergeInput) {
    // Stub: would call OccurrenceSchedulerService.getUpcomingForConsumer()
    return {
      action: 'get_upcoming_services',
      status: 'success',
      upcoming: [
        { date: '2025-04-22', service: 'Weekly Pool Maintenance', timeSlot: '9:00 AM - 11:00 AM', status: 'SCHEDULED' },
        { date: '2025-04-29', service: 'Weekly Pool Maintenance', timeSlot: '9:00 AM - 11:00 AM', status: 'SCHEDULED' },
      ],
      message: 'Here are your upcoming scheduled services.',
    };
  }

  private async handleQuestion(input: HomeownerConciergeInput, context: SkillExecutionContext) {
    if (!input.question) {
      return {
        action: 'ask_question',
        status: 'incomplete',
        message: 'What question can I help you with?',
      };
    }

    // Stub: would use LLM to answer or route to appropriate handler
    return {
      action: 'ask_question',
      status: 'success',
      question: input.question,
      answer: 'I understand your question. Let me connect you with the right team to help.',
      suggestedActions: ['browse_plans', 'request_callback'],
      message: 'Is there anything else I can help you with?',
    };
  }

  private async requestCallback(input: HomeownerConciergeInput, context: SkillExecutionContext) {
    if (!input.callbackPhone) {
      return {
        action: 'request_callback',
        status: 'incomplete',
        missingFields: ['callbackPhone'],
        message: 'What phone number would you like us to call you back on?',
      };
    }

    // Stub: would create callback request
    return {
      action: 'request_callback',
      status: 'success',
      phone: input.callbackPhone,
      preferredTime: input.preferredTime ?? 'Next available',
      message: `We'll call you back at ${input.callbackPhone}${input.preferredTime ? ` around ${input.preferredTime}` : ' as soon as possible'}.`,
    };
  }
}

export { HomeownerConciergeInputSchema };
