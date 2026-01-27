import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for JobIntake skill
 */
const JobIntakeInputSchema = z.object({
  serviceType: z.string().describe('Type of service requested'),
  description: z.string().describe('Description of the job'),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).optional().default('NORMAL'),
  location: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
  contactInfo: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
  preferredSchedule: z.object({
    date: z.string().optional(),
    timeOfDay: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME']).optional(),
  }).optional(),
  specialRequirements: z.array(z.string()).optional(),
});

type JobIntakeInput = z.infer<typeof JobIntakeInputSchema>;

/**
 * JobIntake Skill
 *
 * Collects job requirements from customers.
 * Used by Dispatch Concierge and Quote Assistant agents.
 */
export class JobIntakeSkill extends BaseSkill {
  readonly name = 'JobIntake';
  readonly description = 'Collect job requirements from customers including service type, location, urgency, and special requirements';
  readonly requiredFlags = ['BOOKING_ENABLED'];
  readonly requiredPermissions = ['booking:read'];
  readonly inputSchema: SkillInputSchema = JobIntakeInputSchema;

  protected async executeInternal(
    input: JobIntakeInput,
    context: SkillExecutionContext,
  ): Promise<{
    jobIntakeId: string;
    status: string;
    summary: {
      serviceType: string;
      description: string;
      urgency: string;
      hasLocation: boolean;
      hasContact: boolean;
      hasSchedulePreference: boolean;
    };
    nextSteps: string[];
    missingInfo: string[];
  }> {
    this.logger.debug('Processing job intake', { serviceType: input.serviceType });

    // Analyze what information is missing
    const missingInfo: string[] = [];
    if (!input.location?.address && !input.location?.postalCode) {
      missingInfo.push('Service location address');
    }
    if (!input.contactInfo?.phone && !input.contactInfo?.email) {
      missingInfo.push('Contact phone or email');
    }
    if (!input.preferredSchedule) {
      missingInfo.push('Preferred schedule');
    }

    // Determine next steps based on completeness
    const nextSteps: string[] = [];
    if (missingInfo.length > 0) {
      nextSteps.push(`Collect missing information: ${missingInfo.join(', ')}`);
    }
    if (input.urgency === 'EMERGENCY') {
      nextSteps.push('Initiate emergency dispatch');
    } else {
      nextSteps.push('Generate quote');
      nextSteps.push('Check contractor availability');
    }

    // Create job intake record (stub - would persist to database)
    const jobIntakeId = `intake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      jobIntakeId,
      status: missingInfo.length > 0 ? 'INCOMPLETE' : 'COMPLETE',
      summary: {
        serviceType: input.serviceType,
        description: input.description.substring(0, 100),
        urgency: input.urgency || 'NORMAL',
        hasLocation: !!(input.location?.address || input.location?.postalCode),
        hasContact: !!(input.contactInfo?.phone || input.contactInfo?.email),
        hasSchedulePreference: !!input.preferredSchedule,
      },
      nextSteps,
      missingInfo,
    };
  }
}

export { JobIntakeInputSchema };
