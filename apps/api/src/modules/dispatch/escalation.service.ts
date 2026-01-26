import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PolicyService } from '../feature-flags/policy.service';
import { AuditService } from '../audit/audit.service';
import {
  POLICY_KEYS,
  DEFAULT_POLICIES,
  AUDIT_ACTIONS,
  DispatchAttemptStatus,
} from '@trades/shared';
import { ActorType } from '../audit/dto/audit.dto';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get the escalation steps policy value
   * Returns array like [1, 2, 5] meaning:
   * - Step 0: dispatch to 1 pro
   * - Step 1: dispatch to next 2 pros
   * - Step 2: dispatch to next 5 pros
   */
  async getEscalationSteps(serviceCategoryId?: string): Promise<number[]> {
    try {
      const steps = await this.policyService.getValue<number[]>(
        POLICY_KEYS.DISPATCH_ESCALATION_STEPS,
        serviceCategoryId ? { serviceCategoryId } : undefined,
      );
      return steps;
    } catch {
      // Fall back to default if no policy found
      return [...DEFAULT_POLICIES.DISPATCH_ESCALATION_STEPS];
    }
  }

  /**
   * Get current escalation step for a job based on dispatch attempts
   * Returns the step index (0-indexed)
   */
  async getCurrentEscalationStep(jobId: string): Promise<number> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        dispatchAttempts: {
          orderBy: { attemptNumber: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const escalationSteps = await this.getEscalationSteps(job.serviceCategoryId);
    const totalAttempts = job.dispatchAttempts.length;

    // Determine which escalation step we're on
    let cumulativeAttempts = 0;
    for (let step = 0; step < escalationSteps.length; step++) {
      cumulativeAttempts += escalationSteps[step];
      if (totalAttempts < cumulativeAttempts) {
        return step;
      }
    }

    // If we've exceeded all steps, return the last step
    return escalationSteps.length - 1;
  }

  /**
   * Check if a job should escalate to the next step
   * This happens when all dispatch attempts in the current step have been
   * declined or timed out
   */
  async shouldEscalate(jobId: string): Promise<{
    shouldEscalate: boolean;
    reason?: string;
    currentStep: number;
    nextStep?: number;
  }> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        dispatchAttempts: {
          orderBy: { attemptNumber: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // Check if job is already accepted or in a terminal state
    if (job.status !== 'DISPATCHED') {
      return {
        shouldEscalate: false,
        reason: `Job status is ${job.status}, not DISPATCHED`,
        currentStep: 0,
      };
    }

    const escalationSteps = await this.getEscalationSteps(job.serviceCategoryId);
    const currentStep = await this.getCurrentEscalationStep(jobId);

    // Check if we've reached the maximum escalation step
    if (currentStep >= escalationSteps.length - 1) {
      return {
        shouldEscalate: false,
        reason: 'Maximum escalation step reached',
        currentStep,
      };
    }

    // Check if all current step attempts have completed (declined or timeout)
    const pendingAttempts = job.dispatchAttempts.filter(
      (a) => a.status === DispatchAttemptStatus.PENDING,
    );

    if (pendingAttempts.length > 0) {
      return {
        shouldEscalate: false,
        reason: `${pendingAttempts.length} pending dispatch attempts`,
        currentStep,
      };
    }

    // Check if we have capacity to dispatch more
    const totalAttempts = job.dispatchAttempts.length;
    let cumulativeCapacity = 0;
    for (let step = 0; step <= currentStep; step++) {
      cumulativeCapacity += escalationSteps[step];
    }

    // If we haven't filled the current step capacity, we should escalate
    // (actually, this means there weren't enough matching pros)
    if (totalAttempts < cumulativeCapacity) {
      return {
        shouldEscalate: true,
        reason: 'Current step capacity not filled, may need more pros',
        currentStep,
        nextStep: currentStep + 1,
      };
    }

    // All attempts in current step have completed (declined/timeout)
    return {
      shouldEscalate: true,
      reason: 'All dispatch attempts in current step completed',
      currentStep,
      nextStep: currentStep + 1,
    };
  }

  /**
   * Escalate to the next step
   * Returns the new escalation step or null if escalation not needed
   */
  async escalate(
    jobId: string,
    actorId?: string,
  ): Promise<{
    escalated: boolean;
    message: string;
    newStep?: number;
  }> {
    const escalationCheck = await this.shouldEscalate(jobId);

    if (!escalationCheck.shouldEscalate) {
      this.logger.debug(
        `Job ${jobId} should not escalate: ${escalationCheck.reason}`,
      );
      return {
        escalated: false,
        message: escalationCheck.reason || 'Escalation not needed',
      };
    }

    const newStep = escalationCheck.nextStep!;

    // Log the escalation
    await this.auditService.log({
      action: AUDIT_ACTIONS.DISPATCH_ESCALATED,
      actorId,
      actorType: actorId ? ActorType.USER : ActorType.SYSTEM,
      targetType: 'Job',
      targetId: jobId,
      details: {
        previousStep: escalationCheck.currentStep,
        newStep,
        reason: escalationCheck.reason,
      },
    });

    this.logger.log(
      `Job ${jobId} escalated from step ${escalationCheck.currentStep} to ${newStep}`,
    );

    return {
      escalated: true,
      message: `Escalated from step ${escalationCheck.currentStep} to ${newStep}`,
      newStep,
    };
  }

  /**
   * Get the number of pros to dispatch for a given step
   */
  async getProsCountForStep(
    step: number,
    serviceCategoryId?: string,
  ): Promise<number> {
    const escalationSteps = await this.getEscalationSteps(serviceCategoryId);

    if (step < 0 || step >= escalationSteps.length) {
      // Return the last step's count if out of bounds
      return escalationSteps[escalationSteps.length - 1];
    }

    return escalationSteps[step];
  }

  /**
   * Get the max dispatch attempts policy value
   */
  async getMaxDispatchAttempts(serviceCategoryId?: string): Promise<number> {
    try {
      return await this.policyService.getValue<number>(
        POLICY_KEYS.MAX_DISPATCH_ATTEMPTS,
        serviceCategoryId ? { serviceCategoryId } : undefined,
      );
    } catch {
      return DEFAULT_POLICIES.MAX_DISPATCH_ATTEMPTS as number;
    }
  }

  /**
   * Check if maximum dispatch attempts have been reached
   */
  async hasReachedMaxAttempts(jobId: string): Promise<boolean> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        _count: {
          select: { dispatchAttempts: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const maxAttempts = await this.getMaxDispatchAttempts(job.serviceCategoryId);
    return job._count.dispatchAttempts >= maxAttempts;
  }
}
