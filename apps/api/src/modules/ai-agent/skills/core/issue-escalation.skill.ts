import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for IssueEscalation skill
 */
const IssueEscalationInputSchema = z.object({
  issueType: z.enum([
    'NO_SHOW',
    'QUALITY_CONCERN',
    'SAFETY_ISSUE',
    'BILLING_DISPUTE',
    'COMMUNICATION_ISSUE',
    'SCHEDULE_CONFLICT',
    'PROPERTY_DAMAGE',
    'OTHER',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  relatedEntityType: z.enum(['JOB', 'BOOKING', 'DISPATCH', 'CONTRACTOR', 'PAYMENT']).optional(),
  relatedEntityId: z.string().optional(),
  description: z.string().describe('Detailed description of the issue'),
  customerImpact: z.string().optional().describe('How the customer is affected'),
  immediateActionRequired: z.boolean().optional().default(false),
  preferredResolution: z.string().optional(),
  contactPreference: z.enum(['CALL', 'EMAIL', 'SMS', 'ANY']).optional().default('ANY'),
});

type IssueEscalationInput = z.infer<typeof IssueEscalationInputSchema>;

/**
 * Escalation ticket
 */
interface EscalationTicket {
  ticketId: string;
  status: 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  assignedTeam: string;
  assignedAgent?: string;
  estimatedResponseTime: string;
  trackingUrl?: string;
}

/**
 * IssueEscalation Skill
 *
 * Escalates issues to appropriate teams based on severity and type.
 * Used by Job Status agent.
 */
export class IssueEscalationSkill extends BaseSkill {
  readonly name = 'IssueEscalation';
  readonly description = 'Escalate customer issues to the appropriate team based on severity and type, creating trackable tickets';
  readonly requiredFlags = [];
  readonly requiredPermissions = [];
  readonly inputSchema: SkillInputSchema = IssueEscalationInputSchema;

  // Team routing rules
  private readonly teamRouting: Record<string, string> = {
    NO_SHOW: 'dispatch-operations',
    QUALITY_CONCERN: 'quality-assurance',
    SAFETY_ISSUE: 'safety-compliance',
    BILLING_DISPUTE: 'billing-support',
    COMMUNICATION_ISSUE: 'customer-support',
    SCHEDULE_CONFLICT: 'scheduling-team',
    PROPERTY_DAMAGE: 'claims-department',
    OTHER: 'customer-support',
  };

  // SLA response times by priority (in minutes)
  private readonly slaResponseTimes: Record<string, number> = {
    P1: 15,
    P2: 60,
    P3: 240,
    P4: 1440,
  };

  protected async executeInternal(
    input: IssueEscalationInput,
    context: SkillExecutionContext,
  ): Promise<{
    ticket: EscalationTicket;
    acknowledgment: string;
    nextSteps: string[];
    emergencyContact?: string;
  }> {
    this.logger.debug('Creating escalation ticket', {
      issueType: input.issueType,
      severity: input.severity,
    });

    // Determine priority based on severity and issue type
    const priority = this.determinePriority(input.severity, input.issueType, input.immediateActionRequired);

    // Route to appropriate team
    const assignedTeam = this.teamRouting[input.issueType] || 'customer-support';

    // Calculate response time
    const responseMinutes = this.slaResponseTimes[priority];
    const estimatedResponseTime = new Date(Date.now() + responseMinutes * 60000).toISOString();

    // Generate ticket
    const ticketId = `ESC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const ticket: EscalationTicket = {
      ticketId,
      status: 'CREATED',
      priority,
      assignedTeam,
      estimatedResponseTime,
      trackingUrl: `https://support.example.com/tickets/${ticketId}`,
    };

    // Generate acknowledgment message
    const acknowledgment = this.generateAcknowledgment(input, ticket);

    // Determine next steps
    const nextSteps = this.determineNextSteps(input, priority);

    const result: {
      ticket: EscalationTicket;
      acknowledgment: string;
      nextSteps: string[];
      emergencyContact?: string;
    } = {
      ticket,
      acknowledgment,
      nextSteps,
    };

    // Add emergency contact for critical issues
    if (priority === 'P1' || input.issueType === 'SAFETY_ISSUE') {
      result.emergencyContact = '1-800-555-HELP';
    }

    return result;
  }

  private determinePriority(
    severity: string,
    issueType: string,
    immediateActionRequired?: boolean,
  ): 'P1' | 'P2' | 'P3' | 'P4' {
    // Critical issues that always get P1
    if (issueType === 'SAFETY_ISSUE' || issueType === 'PROPERTY_DAMAGE') {
      return 'P1';
    }

    if (immediateActionRequired) {
      return severity === 'CRITICAL' ? 'P1' : 'P2';
    }

    switch (severity) {
      case 'CRITICAL':
        return 'P1';
      case 'HIGH':
        return 'P2';
      case 'MEDIUM':
        return 'P3';
      case 'LOW':
      default:
        return 'P4';
    }
  }

  private generateAcknowledgment(input: IssueEscalationInput, ticket: EscalationTicket): string {
    const priorityMessages: Record<string, string> = {
      P1: 'This is a critical priority issue. Our team has been immediately notified and will respond within 15 minutes.',
      P2: 'This is a high priority issue. Our team will respond within 1 hour.',
      P3: 'This issue has been logged and our team will respond within 4 hours.',
      P4: 'Your issue has been logged and will be addressed within 24 hours.',
    };

    return `Thank you for reporting this issue. Your ticket number is ${ticket.ticketId}. ${priorityMessages[ticket.priority]} You can track the status at ${ticket.trackingUrl}`;
  }

  private determineNextSteps(input: IssueEscalationInput, priority: string): string[] {
    const steps: string[] = [];

    // Common next steps
    steps.push(`A ${this.teamRouting[input.issueType]} team member will contact you via your preferred method (${input.contactPreference})`);

    // Priority-specific steps
    if (priority === 'P1') {
      steps.push('For immediate assistance, call our emergency line');
      steps.push('A supervisor has been notified and will oversee this case');
    }

    // Issue-specific steps
    switch (input.issueType) {
      case 'NO_SHOW':
        steps.push('We will attempt to contact the assigned contractor');
        steps.push('If needed, we will dispatch an alternative contractor');
        break;
      case 'QUALITY_CONCERN':
        steps.push('Please document any issues with photos if possible');
        steps.push('A quality review will be scheduled');
        break;
      case 'BILLING_DISPUTE':
        steps.push('Please have your invoice number ready');
        steps.push('Our billing team will review the charges');
        break;
      case 'PROPERTY_DAMAGE':
        steps.push('Please document all damage with photos');
        steps.push('Do not attempt repairs until our claims team reviews');
        steps.push('Our insurance coordinator will be in touch');
        break;
      case 'SAFETY_ISSUE':
        steps.push('If there is immediate danger, please call emergency services (911)');
        steps.push('Our safety team will conduct an investigation');
        break;
    }

    return steps;
  }
}

export { IssueEscalationInputSchema };
