import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for StatusInquiry skill
 */
const StatusInquiryInputSchema = z.object({
  entityType: z.enum(['JOB', 'BOOKING', 'DISPATCH', 'PAYMENT']),
  entityId: z.string().describe('ID of the entity to check'),
  includeHistory: z.boolean().optional().default(false),
  includeDetails: z.boolean().optional().default(true),
});

type StatusInquiryInput = z.infer<typeof StatusInquiryInputSchema>;

/**
 * Status timeline event
 */
interface StatusEvent {
  status: string;
  timestamp: string;
  description: string;
  actor?: string;
}

/**
 * Generic status result
 */
interface StatusResult {
  entityType: string;
  entityId: string;
  currentStatus: string;
  statusDescription: string;
  lastUpdated: string;
  nextExpectedAction?: string;
  estimatedCompletion?: string;
  timeline?: StatusEvent[];
  details?: Record<string, unknown>;
}

/**
 * StatusInquiry Skill
 *
 * Checks status of jobs, bookings, dispatches, and payments.
 * Used by Job Status agent.
 */
export class StatusInquirySkill extends BaseSkill {
  readonly name = 'StatusInquiry';
  readonly description = 'Check the current status of jobs, bookings, dispatches, or payments and provide updates';
  readonly requiredFlags = [];
  readonly requiredPermissions = ['booking:read', 'dispatch:read'];
  readonly inputSchema: SkillInputSchema = StatusInquiryInputSchema;

  // Status mappings and descriptions
  private readonly statusDescriptions: Record<string, Record<string, string>> = {
    JOB: {
      CREATED: 'Job has been created and is awaiting dispatch',
      DISPATCHING: 'Finding available contractors in your area',
      ASSIGNED: 'A contractor has accepted the job',
      EN_ROUTE: 'Contractor is on their way to your location',
      IN_PROGRESS: 'Work is currently being performed',
      COMPLETED: 'Job has been completed',
      CANCELLED: 'Job has been cancelled',
    },
    BOOKING: {
      PENDING: 'Booking is pending confirmation',
      CONFIRMED: 'Booking has been confirmed',
      RESCHEDULED: 'Booking has been rescheduled',
      CANCELLED: 'Booking has been cancelled',
      COMPLETED: 'Appointment has been completed',
      NO_SHOW: 'Contractor did not arrive for the appointment',
    },
    DISPATCH: {
      PENDING: 'Dispatch is queued for processing',
      SEARCHING: 'Searching for available contractors',
      OFFERED: 'Job has been offered to contractors',
      ACCEPTED: 'A contractor has accepted the dispatch',
      DECLINED: 'All contractors declined - retrying',
      COMPLETED: 'Dispatch completed successfully',
      FAILED: 'Unable to find available contractors',
    },
    PAYMENT: {
      PENDING: 'Payment is pending',
      PROCESSING: 'Payment is being processed',
      COMPLETED: 'Payment has been completed',
      FAILED: 'Payment failed - please retry',
      REFUNDED: 'Payment has been refunded',
    },
  };

  protected async executeInternal(
    input: StatusInquiryInput,
    context: SkillExecutionContext,
  ): Promise<StatusResult> {
    this.logger.debug('Checking status', { entityType: input.entityType, entityId: input.entityId });

    // Generate mock status based on entity type
    const status = this.generateMockStatus(input.entityType, input.entityId);

    const result: StatusResult = {
      entityType: input.entityType,
      entityId: input.entityId,
      currentStatus: status.currentStatus,
      statusDescription: this.getStatusDescription(input.entityType, status.currentStatus),
      lastUpdated: status.lastUpdated,
      nextExpectedAction: status.nextAction,
      estimatedCompletion: status.estimatedCompletion,
    };

    if (input.includeHistory) {
      result.timeline = this.generateTimeline(input.entityType, status.currentStatus);
    }

    if (input.includeDetails) {
      result.details = this.generateDetails(input.entityType, input.entityId);
    }

    return result;
  }

  private getStatusDescription(entityType: string, status: string): string {
    return this.statusDescriptions[entityType]?.[status] || `Status: ${status}`;
  }

  private generateMockStatus(entityType: string, entityId: string): {
    currentStatus: string;
    lastUpdated: string;
    nextAction?: string;
    estimatedCompletion?: string;
  } {
    // Use entityId hash to generate consistent "random" status
    const hash = entityId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const statusIndex = hash % 5;

    const statuses: Record<string, string[]> = {
      JOB: ['CREATED', 'DISPATCHING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'],
      BOOKING: ['PENDING', 'CONFIRMED', 'COMPLETED'],
      DISPATCH: ['PENDING', 'SEARCHING', 'OFFERED', 'ACCEPTED', 'COMPLETED'],
      PAYMENT: ['PENDING', 'PROCESSING', 'COMPLETED'],
    };

    const entityStatuses = statuses[entityType] || ['UNKNOWN'];
    const currentStatus = entityStatuses[Math.min(statusIndex, entityStatuses.length - 1)];

    const now = new Date();
    const lastUpdated = new Date(now.getTime() - Math.random() * 3600000); // Up to 1 hour ago

    return {
      currentStatus,
      lastUpdated: lastUpdated.toISOString(),
      nextAction: this.getNextAction(entityType, currentStatus),
      estimatedCompletion: this.getEstimatedCompletion(entityType, currentStatus),
    };
  }

  private getNextAction(entityType: string, currentStatus: string): string | undefined {
    const nextActions: Record<string, Record<string, string>> = {
      JOB: {
        CREATED: 'Dispatch to contractors',
        DISPATCHING: 'Contractor acceptance',
        ASSIGNED: 'Contractor arrives at location',
        EN_ROUTE: 'Work begins',
        IN_PROGRESS: 'Work completion',
      },
      BOOKING: {
        PENDING: 'Confirmation from contractor',
        CONFIRMED: 'Appointment date arrives',
      },
      DISPATCH: {
        PENDING: 'Start searching for contractors',
        SEARCHING: 'Contractor accepts offer',
        OFFERED: 'Contractor response',
        ACCEPTED: 'Job assignment confirmation',
      },
      PAYMENT: {
        PENDING: 'Payment processing',
        PROCESSING: 'Payment completion',
      },
    };

    return nextActions[entityType]?.[currentStatus];
  }

  private getEstimatedCompletion(entityType: string, currentStatus: string): string | undefined {
    const now = new Date();

    // Estimate based on typical timelines
    const estimates: Record<string, Record<string, number>> = {
      JOB: {
        CREATED: 30,
        DISPATCHING: 15,
        ASSIGNED: 60,
        EN_ROUTE: 30,
        IN_PROGRESS: 120,
      },
      DISPATCH: {
        PENDING: 5,
        SEARCHING: 10,
        OFFERED: 15,
        ACCEPTED: 5,
      },
    };

    const minutesRemaining = estimates[entityType]?.[currentStatus];
    if (minutesRemaining) {
      const estimatedTime = new Date(now.getTime() + minutesRemaining * 60000);
      return estimatedTime.toISOString();
    }

    return undefined;
  }

  private generateTimeline(entityType: string, currentStatus: string): StatusEvent[] {
    const timeline: StatusEvent[] = [];
    const now = new Date();

    const statusOrder: Record<string, string[]> = {
      JOB: ['CREATED', 'DISPATCHING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'],
      BOOKING: ['PENDING', 'CONFIRMED', 'COMPLETED'],
      DISPATCH: ['PENDING', 'SEARCHING', 'OFFERED', 'ACCEPTED', 'COMPLETED'],
      PAYMENT: ['PENDING', 'PROCESSING', 'COMPLETED'],
    };

    const statuses = statusOrder[entityType] || [];
    const currentIndex = statuses.indexOf(currentStatus);

    // Generate past events
    for (let i = 0; i <= currentIndex && i < statuses.length; i++) {
      const status = statuses[i];
      const minutesAgo = (currentIndex - i) * 15 + Math.random() * 10;
      const timestamp = new Date(now.getTime() - minutesAgo * 60000);

      timeline.push({
        status,
        timestamp: timestamp.toISOString(),
        description: this.getStatusDescription(entityType, status),
        actor: i === 0 ? 'System' : 'Contractor',
      });
    }

    return timeline;
  }

  private generateDetails(entityType: string, entityId: string): Record<string, unknown> {
    const baseDetails = {
      id: entityId,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    };

    switch (entityType) {
      case 'JOB':
        return {
          ...baseDetails,
          serviceType: 'PLUMBING',
          description: 'Leaky faucet repair',
          assignedContractor: {
            name: 'John Smith',
            rating: 4.8,
            phone: '(555) 123-4567',
          },
          location: 'Toronto, ON',
        };
      case 'BOOKING':
        return {
          ...baseDetails,
          scheduledDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          scheduledTime: '10:00 AM',
          duration: '2 hours',
          contractor: 'Jane Doe',
        };
      case 'DISPATCH':
        return {
          ...baseDetails,
          jobId: 'job_' + entityId.split('_')[1],
          attempts: 3,
          radius: '15 km',
          contractorsContacted: 5,
        };
      case 'PAYMENT':
        return {
          ...baseDetails,
          amount: 245.99,
          currency: 'CAD',
          method: 'Credit Card',
          invoiceId: 'inv_' + entityId.split('_')[1],
        };
      default:
        return baseDetails;
    }
  }
}

export { StatusInquiryInputSchema };
