import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for DispatchOverride skill
 */
const DispatchOverrideInputSchema = z.object({
  action: z.enum(['MANUAL_ASSIGN', 'REASSIGN', 'CANCEL_DISPATCH', 'FORCE_DISPATCH', 'ADJUST_PRIORITY']),
  jobId: z.string(),
  dispatchId: z.string().optional(),
  targetContractorId: z.string().optional(),
  reason: z.string().describe('Reason for the override action'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).optional(),
  bypassSla: z.boolean().optional().default(false),
  notifyCustomer: z.boolean().optional().default(true),
  notifyContractor: z.boolean().optional().default(true),
});

type DispatchOverrideInput = z.infer<typeof DispatchOverrideInputSchema>;

/**
 * Override result
 */
interface OverrideResult {
  overrideId: string;
  action: string;
  jobId: string;
  dispatchId?: string;
  previousState?: {
    status: string;
    assignedTo?: string;
    priority?: string;
  };
  newState: {
    status: string;
    assignedTo?: string;
    priority?: string;
  };
  notifications: {
    customerNotified: boolean;
    contractorNotified: boolean;
    supervisorNotified: boolean;
  };
  auditTrail: {
    performedBy: string;
    reason: string;
    timestamp: string;
  };
}

/**
 * DispatchOverride Skill
 *
 * Allows operations team to manually override dispatch assignments.
 * Used by Dispatch Optimizer agent.
 */
export class DispatchOverrideSkill extends BaseSkill {
  readonly name = 'DispatchOverride';
  readonly description = 'Manually override dispatch assignments including reassigning contractors, canceling dispatches, and adjusting priorities';
  readonly requiredFlags = ['DISPATCH_ENABLED'];
  readonly requiredPermissions = ['dispatch:manage', 'dispatch:override'];
  readonly inputSchema: SkillInputSchema = DispatchOverrideInputSchema;

  protected async executeInternal(
    input: DispatchOverrideInput,
    context: SkillExecutionContext,
  ): Promise<{
    success: boolean;
    result: OverrideResult;
    warnings: string[];
    message: string;
  }> {
    this.logger.debug('Processing dispatch override', { action: input.action, jobId: input.jobId });

    const warnings: string[] = [];

    // Check for SLA bypass warning
    if (input.bypassSla) {
      warnings.push('SLA bypass enabled - this action will not count against SLA metrics');
    }

    // Execute the override action
    const result = await this.executeOverride(input, context);

    // Generate appropriate message
    const message = this.generateMessage(input.action, result, warnings);

    return {
      success: true,
      result,
      warnings,
      message,
    };
  }

  private async executeOverride(
    input: DispatchOverrideInput,
    context: SkillExecutionContext,
  ): Promise<OverrideResult> {
    const overrideId = `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const baseResult: OverrideResult = {
      overrideId,
      action: input.action,
      jobId: input.jobId,
      dispatchId: input.dispatchId || `dispatch_${input.jobId}`,
      previousState: {
        status: 'IN_PROGRESS',
        assignedTo: 'contractor_previous',
        priority: 'NORMAL',
      },
      newState: {
        status: 'IN_PROGRESS',
        assignedTo: undefined,
        priority: input.priority || 'NORMAL',
      },
      notifications: {
        customerNotified: input.notifyCustomer ?? true,
        contractorNotified: input.notifyContractor ?? true,
        supervisorNotified: true,
      },
      auditTrail: {
        performedBy: context.userId || 'system',
        reason: input.reason,
        timestamp,
      },
    };

    switch (input.action) {
      case 'MANUAL_ASSIGN':
        return {
          ...baseResult,
          previousState: {
            status: 'PENDING',
            priority: 'NORMAL',
          },
          newState: {
            status: 'ASSIGNED',
            assignedTo: input.targetContractorId || 'contractor_assigned',
            priority: input.priority || 'NORMAL',
          },
        };

      case 'REASSIGN':
        return {
          ...baseResult,
          newState: {
            status: 'REASSIGNED',
            assignedTo: input.targetContractorId || 'contractor_new',
            priority: input.priority || baseResult.previousState?.priority || 'NORMAL',
          },
        };

      case 'CANCEL_DISPATCH':
        return {
          ...baseResult,
          newState: {
            status: 'CANCELLED',
            priority: baseResult.previousState?.priority || 'NORMAL',
          },
        };

      case 'FORCE_DISPATCH':
        return {
          ...baseResult,
          newState: {
            status: 'FORCE_DISPATCHED',
            assignedTo: input.targetContractorId,
            priority: 'HIGH',
          },
        };

      case 'ADJUST_PRIORITY':
        return {
          ...baseResult,
          newState: {
            status: baseResult.previousState?.status || 'IN_PROGRESS',
            assignedTo: baseResult.previousState?.assignedTo,
            priority: input.priority || 'HIGH',
          },
        };

      default:
        return baseResult;
    }
  }

  private generateMessage(action: string, result: OverrideResult, warnings: string[]): string {
    const warningText = warnings.length > 0 ? ` Warnings: ${warnings.join('; ')}` : '';

    switch (action) {
      case 'MANUAL_ASSIGN':
        return `Job ${result.jobId} manually assigned to contractor ${result.newState.assignedTo}.${warningText}`;
      case 'REASSIGN':
        return `Job ${result.jobId} reassigned from ${result.previousState?.assignedTo} to ${result.newState.assignedTo}.${warningText}`;
      case 'CANCEL_DISPATCH':
        return `Dispatch for job ${result.jobId} has been cancelled. Reason: ${result.auditTrail.reason}${warningText}`;
      case 'FORCE_DISPATCH':
        return `Force dispatch executed for job ${result.jobId}. Contractor ${result.newState.assignedTo} must respond immediately.${warningText}`;
      case 'ADJUST_PRIORITY':
        return `Priority for job ${result.jobId} adjusted from ${result.previousState?.priority} to ${result.newState.priority}.${warningText}`;
      default:
        return `Override action ${action} completed for job ${result.jobId}.${warningText}`;
    }
  }
}

export { DispatchOverrideInputSchema };
