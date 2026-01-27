import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for JobAcceptance skill
 */
const JobAcceptanceInputSchema = z.object({
  action: z.enum(['VIEW_OFFERS', 'ACCEPT_JOB', 'DECLINE_JOB', 'REQUEST_INFO', 'COUNTER_OFFER']),
  dispatchId: z.string().optional(),
  jobId: z.string().optional(),
  declineReason: z.string().optional(),
  counterOffer: z.object({
    proposedTime: z.string().optional(),
    proposedPrice: z.number().optional(),
    notes: z.string().optional(),
  }).optional(),
  infoRequested: z.array(z.string()).optional(),
});

type JobAcceptanceInput = z.infer<typeof JobAcceptanceInputSchema>;

/**
 * Job offer details
 */
interface JobOffer {
  dispatchId: string;
  jobId: string;
  serviceType: string;
  description: string;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';
  location: {
    address: string;
    city: string;
    distance: number;
    estimatedTravelTime: number;
  };
  scheduledTime?: string;
  estimatedDuration: number;
  payoutAmount: number;
  expiresAt: string;
  customerInfo: {
    name: string;
    rating?: number;
    previousJobs?: number;
  };
}

/**
 * JobAcceptance Skill
 *
 * Handles job offers for contractors including accepting, declining, and counter-offers.
 * Used by contractor-facing agents.
 */
export class JobAcceptanceSkill extends BaseSkill {
  readonly name = 'JobAcceptance';
  readonly description = 'View and respond to job offers including accepting, declining, or making counter-offers';
  readonly requiredFlags = ['DISPATCH_ENABLED'];
  readonly requiredPermissions = ['contractor:jobs'];
  readonly inputSchema: SkillInputSchema = JobAcceptanceInputSchema;

  protected async executeInternal(
    input: JobAcceptanceInput,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    offers?: JobOffer[];
    acceptedJob?: {
      jobId: string;
      confirmationCode: string;
      scheduledTime: string;
      customerContact: string;
    };
    message: string;
    slaWarning?: string;
  }> {
    this.logger.debug('Processing job acceptance action', { action: input.action });

    switch (input.action) {
      case 'VIEW_OFFERS':
        return this.viewOffers(context);
      case 'ACCEPT_JOB':
        return this.acceptJob(input.dispatchId || input.jobId, context);
      case 'DECLINE_JOB':
        return this.declineJob(input.dispatchId || input.jobId, input.declineReason, context);
      case 'REQUEST_INFO':
        return this.requestInfo(input.jobId, input.infoRequested, context);
      case 'COUNTER_OFFER':
        return this.makeCounterOffer(input.jobId, input.counterOffer, context);
      default:
        return {
          action: input.action,
          success: false,
          message: 'Unknown action',
        };
    }
  }

  private async viewOffers(context: SkillExecutionContext): Promise<{
    action: string;
    success: boolean;
    offers: JobOffer[];
    message: string;
    slaWarning?: string;
  }> {
    // Generate mock job offers
    const offers: JobOffer[] = [
      {
        dispatchId: `dispatch_${Date.now()}_1`,
        jobId: `job_${Date.now()}_1`,
        serviceType: 'PLUMBING',
        description: 'Leaky faucet repair in kitchen',
        urgency: 'NORMAL',
        location: {
          address: '123 Main St',
          city: 'Toronto',
          distance: 5.2,
          estimatedTravelTime: 15,
        },
        scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        estimatedDuration: 60,
        payoutAmount: 125.00,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        customerInfo: {
          name: 'John D.',
          rating: 4.8,
          previousJobs: 3,
        },
      },
      {
        dispatchId: `dispatch_${Date.now()}_2`,
        jobId: `job_${Date.now()}_2`,
        serviceType: 'PLUMBING',
        description: 'Toilet not flushing properly',
        urgency: 'HIGH',
        location: {
          address: '456 Oak Ave',
          city: 'Toronto',
          distance: 8.7,
          estimatedTravelTime: 22,
        },
        estimatedDuration: 90,
        payoutAmount: 175.00,
        expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
        customerInfo: {
          name: 'Sarah M.',
          rating: 5.0,
          previousJobs: 1,
        },
      },
    ];

    // Check for expiring offers
    const expiringOffers = offers.filter(o => {
      const expiresIn = new Date(o.expiresAt).getTime() - Date.now();
      return expiresIn < 2 * 60 * 1000; // Less than 2 minutes
    });

    let slaWarning: string | undefined;
    if (expiringOffers.length > 0) {
      slaWarning = `${expiringOffers.length} offer(s) expiring soon! Accept within the time limit to maintain your acceptance rate.`;
    }

    return {
      action: 'VIEW_OFFERS',
      success: true,
      offers,
      message: `You have ${offers.length} pending job offer(s)`,
      slaWarning,
    };
  }

  private async acceptJob(
    jobIdOrDispatchId: string | undefined,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    acceptedJob: {
      jobId: string;
      confirmationCode: string;
      scheduledTime: string;
      customerContact: string;
    };
    message: string;
  }> {
    if (!jobIdOrDispatchId) {
      return {
        action: 'ACCEPT_JOB',
        success: false,
        acceptedJob: { jobId: '', confirmationCode: '', scheduledTime: '', customerContact: '' },
        message: 'Job ID or Dispatch ID is required',
      };
    }

    const confirmationCode = Math.random().toString(36).substr(2, 8).toUpperCase();
    const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    return {
      action: 'ACCEPT_JOB',
      success: true,
      acceptedJob: {
        jobId: jobIdOrDispatchId.replace('dispatch_', 'job_'),
        confirmationCode,
        scheduledTime,
        customerContact: '(555) 123-4567',
      },
      message: `Job accepted! Confirmation code: ${confirmationCode}. Please arrive by ${new Date(scheduledTime).toLocaleTimeString()}.`,
    };
  }

  private async declineJob(
    jobIdOrDispatchId: string | undefined,
    reason: string | undefined,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    message: string;
  }> {
    if (!jobIdOrDispatchId) {
      return {
        action: 'DECLINE_JOB',
        success: false,
        message: 'Job ID or Dispatch ID is required',
      };
    }

    const reasonText = reason ? ` Reason recorded: ${reason}` : '';
    return {
      action: 'DECLINE_JOB',
      success: true,
      message: `Job declined.${reasonText} This has been noted in your records. Frequent declines may affect your priority for future offers.`,
    };
  }

  private async requestInfo(
    jobId: string | undefined,
    infoRequested: string[] | undefined,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    message: string;
  }> {
    if (!jobId) {
      return {
        action: 'REQUEST_INFO',
        success: false,
        message: 'Job ID is required',
      };
    }

    const requestedItems = infoRequested?.join(', ') || 'additional details';
    return {
      action: 'REQUEST_INFO',
      success: true,
      message: `Information request sent for: ${requestedItems}. The customer will be notified. Note: The offer timer continues while waiting for response.`,
    };
  }

  private async makeCounterOffer(
    jobId: string | undefined,
    counterOffer: { proposedTime?: string; proposedPrice?: number; notes?: string } | undefined,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    message: string;
  }> {
    if (!jobId) {
      return {
        action: 'COUNTER_OFFER',
        success: false,
        message: 'Job ID is required',
      };
    }

    if (!counterOffer?.proposedTime && !counterOffer?.proposedPrice) {
      return {
        action: 'COUNTER_OFFER',
        success: false,
        message: 'At least a proposed time or price is required for a counter-offer',
      };
    }

    const changes: string[] = [];
    if (counterOffer.proposedTime) {
      changes.push(`time: ${counterOffer.proposedTime}`);
    }
    if (counterOffer.proposedPrice) {
      changes.push(`price: $${counterOffer.proposedPrice}`);
    }

    return {
      action: 'COUNTER_OFFER',
      success: true,
      message: `Counter-offer submitted with ${changes.join(' and ')}. The customer will review and respond. You'll be notified of their decision.`,
    };
  }
}

export { JobAcceptanceInputSchema };
