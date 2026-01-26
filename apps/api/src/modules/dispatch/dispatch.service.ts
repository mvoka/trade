import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { PolicyService } from '../feature-flags/policy.service';
import { AuditService } from '../audit/audit.service';
import { MatchingService } from './matching.service';
import { RankingService, RankedPro } from './ranking.service';
import { EscalationService } from './escalation.service';
import {
  AUDIT_ACTIONS,
  POLICY_KEYS,
  DEFAULT_POLICIES,
  JobStatus,
  DispatchAttemptStatus,
} from '@trades/shared';
import { ActorType } from '../audit/dto/audit.dto';
import {
  DispatchAttemptResponseDto,
  PendingDispatchResponseDto,
  DispatchHistoryResponseDto,
  DispatchInitiationResponseDto,
  DispatchActionResponseDto,
} from './dto/dispatch.dto';
import { Queue } from 'bullmq';

// Queue name for dispatch jobs
export const DISPATCH_QUEUE_NAME = 'dispatch';

// Job types
export enum DispatchJobType {
  CHECK_TIMEOUT = 'check_timeout',
  ESCALATE = 'escalate',
}

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  private dispatchQueue: Queue | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
    private readonly matchingService: MatchingService,
    private readonly rankingService: RankingService,
    private readonly escalationService: EscalationService,
  ) {}

  /**
   * Initialize the dispatch queue (called from processor)
   */
  setQueue(queue: Queue): void {
    this.dispatchQueue = queue;
  }

  /**
   * Get the SLA accept minutes policy value
   */
  async getSlaAcceptMinutes(serviceCategoryId?: string): Promise<number> {
    try {
      return await this.policyService.getValue<number>(
        POLICY_KEYS.SLA_ACCEPT_MINUTES,
        serviceCategoryId ? { serviceCategoryId } : undefined,
      );
    } catch {
      return DEFAULT_POLICIES.SLA_ACCEPT_MINUTES as number;
    }
  }

  /**
   * Initiate dispatch process for a job
   */
  async initiateDispatch(
    jobId: string,
    actorId?: string,
  ): Promise<DispatchInitiationResponseDto> {
    this.logger.log(`Initiating dispatch for job ${jobId}`);

    // Get the job
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        dispatchAttempts: true,
        dispatchAssignment: true,
      },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // Validate job can be dispatched
    if (job.status !== JobStatus.DRAFT && job.status !== JobStatus.DISPATCHED) {
      throw new BadRequestException(
        `Job cannot be dispatched. Current status: ${job.status}`,
      );
    }

    // Check if already assigned
    if (job.dispatchAssignment) {
      throw new ConflictException(
        `Job ${jobId} has already been assigned to a pro`,
      );
    }

    // Check if max attempts reached
    if (await this.escalationService.hasReachedMaxAttempts(jobId)) {
      throw new BadRequestException(
        `Job ${jobId} has reached maximum dispatch attempts`,
      );
    }

    // Find matching pros
    const matchingPros = await this.matchingService.findMatchingPros({
      id: job.id,
      serviceCategoryId: job.serviceCategoryId,
      serviceLat: job.serviceLat,
      serviceLng: job.serviceLng,
    });

    if (matchingPros.length === 0) {
      this.logger.warn(`No matching pros found for job ${jobId}`);
      return {
        success: false,
        message: 'No matching pros available for this job',
        matchingProsCount: 0,
      };
    }

    // Get already dispatched pro IDs
    const dispatchedProIds = await this.matchingService.getDispatchedProIds(jobId);

    // Filter out already dispatched pros
    const availablePros = matchingPros.filter(
      (pro) => !dispatchedProIds.includes(pro.id),
    );

    if (availablePros.length === 0) {
      this.logger.warn(`All matching pros have already been dispatched for job ${jobId}`);
      return {
        success: false,
        message: 'All matching pros have already been dispatched',
        matchingProsCount: matchingPros.length,
      };
    }

    // Rank the available pros
    const rankedPros = this.rankingService.rankPros(
      availablePros,
      job.serviceLat,
      job.serviceLng,
    );

    // Get current escalation step
    const currentStep = await this.escalationService.getCurrentEscalationStep(jobId);
    const prosToDispatch = this.rankingService.getProsForEscalationStep(
      rankedPros,
      await this.escalationService.getEscalationSteps(job.serviceCategoryId),
      currentStep,
      dispatchedProIds,
    );

    if (prosToDispatch.length === 0) {
      this.logger.warn(`No pros available for escalation step ${currentStep}`);
      return {
        success: false,
        message: `No pros available for escalation step ${currentStep}`,
        matchingProsCount: matchingPros.length,
      };
    }

    // Dispatch to the first pro
    const dispatchAttempt = await this.dispatchToPro(
      jobId,
      prosToDispatch[0],
      job.dispatchAttempts.length + 1,
      job.serviceCategoryId,
    );

    // Update job status if not already dispatched
    if (job.status !== JobStatus.DISPATCHED) {
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.DISPATCHED,
          dispatchedAt: new Date(),
        },
      });
    }

    // Log audit
    await this.auditService.log({
      action: AUDIT_ACTIONS.DISPATCH_INITIATED,
      actorId,
      actorType: actorId ? ActorType.USER : ActorType.SYSTEM,
      targetType: 'Job',
      targetId: jobId,
      details: {
        proProfileId: dispatchAttempt.proProfileId,
        attemptNumber: dispatchAttempt.attemptNumber,
        escalationStep: currentStep,
        matchingProsCount: matchingPros.length,
      },
    });

    return {
      success: true,
      message: 'Dispatch initiated successfully',
      dispatchAttempt: this.mapToDispatchAttemptResponse(dispatchAttempt),
      matchingProsCount: matchingPros.length,
    };
  }

  /**
   * Dispatch to the next ranked pro
   */
  async dispatchToNextPro(
    jobId: string,
    actorId?: string,
  ): Promise<DispatchInitiationResponseDto> {
    this.logger.log(`Dispatching to next pro for job ${jobId}`);

    // This is essentially the same as initiateDispatch but can be called
    // after a decline/timeout to continue the dispatch process
    return this.initiateDispatch(jobId, actorId);
  }

  /**
   * Create a dispatch attempt to a specific pro
   */
  private async dispatchToPro(
    jobId: string,
    pro: RankedPro,
    attemptNumber: number,
    serviceCategoryId: string,
  ): Promise<{
    id: string;
    jobId: string;
    proProfileId: string;
    attemptNumber: number;
    status: string;
    dispatchedAt: Date;
    slaDeadline: Date;
    ranking: number;
    distance: number;
    createdAt: Date;
  }> {
    // Get SLA deadline
    const slaMinutes = await this.getSlaAcceptMinutes(serviceCategoryId);
    const now = new Date();
    const slaDeadline = new Date(now.getTime() + slaMinutes * 60 * 1000);

    // Create dispatch attempt
    const attempt = await this.prisma.dispatchAttempt.create({
      data: {
        jobId,
        proProfileId: pro.id,
        attemptNumber,
        status: DispatchAttemptStatus.PENDING,
        dispatchedAt: now,
        slaDeadline,
        ranking: pro.score,
        distance: pro.distance,
      },
    });

    this.logger.log(
      `Dispatch attempt ${attempt.id} created for pro ${pro.id}, SLA deadline: ${slaDeadline}`,
    );

    // Schedule timeout check if queue is available
    if (this.dispatchQueue) {
      const delayMs = slaMinutes * 60 * 1000;
      await this.dispatchQueue.add(
        DispatchJobType.CHECK_TIMEOUT,
        {
          jobId,
          dispatchAttemptId: attempt.id,
        },
        {
          delay: delayMs,
          jobId: `timeout_${attempt.id}`,
        },
      );
      this.logger.debug(`Scheduled timeout check for attempt ${attempt.id} in ${slaMinutes} minutes`);
    }

    return {
      id: attempt.id,
      jobId: attempt.jobId,
      proProfileId: attempt.proProfileId,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      dispatchedAt: attempt.dispatchedAt,
      slaDeadline: attempt.slaDeadline,
      ranking: attempt.ranking || 0,
      distance: attempt.distance || 0,
      createdAt: attempt.createdAt,
    };
  }

  /**
   * Pro accepts a dispatch
   */
  async acceptDispatch(
    jobId: string,
    proProfileId: string,
    actorId?: string,
  ): Promise<DispatchActionResponseDto> {
    this.logger.log(`Pro ${proProfileId} accepting dispatch for job ${jobId}`);

    // Find the pending dispatch attempt
    const attempt = await this.prisma.dispatchAttempt.findFirst({
      where: {
        jobId,
        proProfileId,
        status: DispatchAttemptStatus.PENDING,
      },
      include: {
        job: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException(
        `No pending dispatch found for pro ${proProfileId} on job ${jobId}`,
      );
    }

    // Check if SLA has expired
    if (new Date() > attempt.slaDeadline) {
      throw new BadRequestException(
        'SLA deadline has passed. This dispatch has timed out.',
      );
    }

    // Check if job is still in dispatchable state
    if (attempt.job.status !== JobStatus.DISPATCHED) {
      throw new BadRequestException(
        `Job is no longer available. Current status: ${attempt.job.status}`,
      );
    }

    // Update dispatch attempt
    const updatedAttempt = await this.prisma.dispatchAttempt.update({
      where: { id: attempt.id },
      data: {
        status: DispatchAttemptStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    });

    // Create assignment
    await this.prisma.dispatchAssignment.create({
      data: {
        jobId,
        proProfileId,
        assignedAt: new Date(),
        assignedBy: actorId,
        isManual: false,
      },
    });

    // Update job status
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.ACCEPTED,
        acceptedAt: new Date(),
        assignedProId: proProfileId,
      },
    });

    // Cancel other pending dispatch attempts for this job
    await this.prisma.dispatchAttempt.updateMany({
      where: {
        jobId,
        id: { not: attempt.id },
        status: DispatchAttemptStatus.PENDING,
      },
      data: {
        status: DispatchAttemptStatus.CANCELLED,
        respondedAt: new Date(),
      },
    });

    // Log audit
    await this.auditService.log({
      action: AUDIT_ACTIONS.DISPATCH_ACCEPTED,
      actorId,
      actorType: ActorType.USER,
      targetType: 'Job',
      targetId: jobId,
      details: {
        proProfileId,
        dispatchAttemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        responseTimeMinutes: this.calculateResponseTime(attempt.dispatchedAt),
      },
    });

    // Update pro's average response time
    await this.updateProResponseMetrics(proProfileId, attempt.dispatchedAt);

    return {
      success: true,
      message: 'Dispatch accepted successfully',
      dispatchAttempt: this.mapToDispatchAttemptResponse(updatedAttempt),
    };
  }

  /**
   * Pro declines a dispatch
   */
  async declineDispatch(
    jobId: string,
    proProfileId: string,
    reasonId: string,
    notes?: string,
    actorId?: string,
  ): Promise<DispatchActionResponseDto> {
    this.logger.log(`Pro ${proProfileId} declining dispatch for job ${jobId}`);

    // Find the pending dispatch attempt
    const attempt = await this.prisma.dispatchAttempt.findFirst({
      where: {
        jobId,
        proProfileId,
        status: DispatchAttemptStatus.PENDING,
      },
      include: {
        job: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException(
        `No pending dispatch found for pro ${proProfileId} on job ${jobId}`,
      );
    }

    // Verify decline reason exists
    const declineReason = await this.prisma.declineReason.findUnique({
      where: { id: reasonId },
    });

    if (!declineReason) {
      throw new NotFoundException(`Decline reason ${reasonId} not found`);
    }

    // Update dispatch attempt
    const updatedAttempt = await this.prisma.dispatchAttempt.update({
      where: { id: attempt.id },
      data: {
        status: DispatchAttemptStatus.DECLINED,
        respondedAt: new Date(),
        declineReasonId: reasonId,
        declineNotes: notes,
      },
    });

    // Log audit
    await this.auditService.log({
      action: AUDIT_ACTIONS.DISPATCH_DECLINED,
      actorId,
      actorType: ActorType.USER,
      targetType: 'Job',
      targetId: jobId,
      details: {
        proProfileId,
        dispatchAttemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        declineReasonCode: declineReason.code,
        responseTimeMinutes: this.calculateResponseTime(attempt.dispatchedAt),
      },
    });

    // Check if we should escalate or dispatch to next pro
    await this.checkAndContinueDispatch(jobId);

    return {
      success: true,
      message: 'Dispatch declined successfully',
      dispatchAttempt: this.mapToDispatchAttemptResponse(updatedAttempt),
    };
  }

  /**
   * Handle SLA timeout for a dispatch attempt
   */
  async handleTimeout(
    jobId: string,
    dispatchAttemptId: string,
  ): Promise<void> {
    this.logger.log(`Handling timeout for dispatch attempt ${dispatchAttemptId}`);

    // Get the dispatch attempt
    const attempt = await this.prisma.dispatchAttempt.findUnique({
      where: { id: dispatchAttemptId },
      include: { job: true },
    });

    if (!attempt) {
      this.logger.warn(`Dispatch attempt ${dispatchAttemptId} not found`);
      return;
    }

    // Check if still pending (might have been accepted/declined in the meantime)
    if (attempt.status !== DispatchAttemptStatus.PENDING) {
      this.logger.debug(
        `Dispatch attempt ${dispatchAttemptId} is no longer pending (status: ${attempt.status})`,
      );
      return;
    }

    // Update to timeout status
    await this.prisma.dispatchAttempt.update({
      where: { id: dispatchAttemptId },
      data: {
        status: DispatchAttemptStatus.TIMEOUT,
        respondedAt: new Date(),
      },
    });

    // Log audit
    await this.auditService.log({
      action: AUDIT_ACTIONS.DISPATCH_TIMEOUT,
      actorType: ActorType.SYSTEM,
      targetType: 'Job',
      targetId: jobId,
      details: {
        proProfileId: attempt.proProfileId,
        dispatchAttemptId,
        attemptNumber: attempt.attemptNumber,
        slaDeadline: attempt.slaDeadline,
      },
    });

    this.logger.log(
      `Dispatch attempt ${dispatchAttemptId} timed out for pro ${attempt.proProfileId}`,
    );

    // Continue dispatch process
    await this.checkAndContinueDispatch(jobId);
  }

  /**
   * Check if dispatch should continue and initiate next steps
   */
  private async checkAndContinueDispatch(jobId: string): Promise<void> {
    // Check if job is still in dispatch state
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true },
    });

    if (!job || job.status !== JobStatus.DISPATCHED) {
      this.logger.debug(`Job ${jobId} is no longer in DISPATCHED status`);
      return;
    }

    // Check if we should escalate
    const escalationResult = await this.escalationService.shouldEscalate(jobId);

    if (escalationResult.shouldEscalate) {
      await this.escalationService.escalate(jobId);
    }

    // Try to dispatch to next pro
    try {
      await this.dispatchToNextPro(jobId);
    } catch (error) {
      this.logger.warn(`Could not dispatch to next pro for job ${jobId}: ${error.message}`);
    }
  }

  /**
   * Get dispatch attempts for a job
   */
  async getDispatchAttempts(jobId: string): Promise<DispatchHistoryResponseDto> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        dispatchAttempts: {
          include: {
            proProfile: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
            declineReason: true,
          },
          orderBy: { attemptNumber: 'asc' },
        },
        dispatchAssignment: {
          include: {
            proProfile: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const currentStep = await this.escalationService.getCurrentEscalationStep(jobId);

    return {
      jobId,
      totalAttempts: job.dispatchAttempts.length,
      currentEscalationStep: currentStep,
      attempts: job.dispatchAttempts.map((attempt) => ({
        id: attempt.id,
        jobId: attempt.jobId,
        proProfileId: attempt.proProfileId,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        declineReasonId: attempt.declineReasonId,
        declineNotes: attempt.declineNotes,
        dispatchedAt: attempt.dispatchedAt,
        respondedAt: attempt.respondedAt,
        slaDeadline: attempt.slaDeadline,
        ranking: attempt.ranking,
        distance: attempt.distance,
        createdAt: attempt.createdAt,
        proProfile: attempt.proProfile
          ? {
              id: attempt.proProfile.id,
              businessName: attempt.proProfile.businessName,
              businessPhone: attempt.proProfile.businessPhone,
              user: attempt.proProfile.user,
            }
          : undefined,
      })),
      assignment: job.dispatchAssignment
        ? {
            id: job.dispatchAssignment.id,
            proProfileId: job.dispatchAssignment.proProfileId,
            assignedAt: job.dispatchAssignment.assignedAt,
            isManual: job.dispatchAssignment.isManual,
            proProfile: job.dispatchAssignment.proProfile
              ? {
                  id: job.dispatchAssignment.proProfile.id,
                  businessName: job.dispatchAssignment.proProfile.businessName,
                  user: job.dispatchAssignment.proProfile.user,
                }
              : undefined,
          }
        : null,
    };
  }

  /**
   * Get active/pending dispatches for a pro
   */
  async getActiveDispatch(
    proProfileId: string,
  ): Promise<PendingDispatchResponseDto[]> {
    const pendingAttempts = await this.prisma.dispatchAttempt.findMany({
      where: {
        proProfileId,
        status: DispatchAttemptStatus.PENDING,
      },
      include: {
        job: {
          include: {
            serviceCategory: true,
          },
        },
      },
      orderBy: { dispatchedAt: 'desc' },
    });

    const now = new Date();

    return pendingAttempts.map((attempt) => ({
      dispatch: this.mapToDispatchAttemptResponse(attempt),
      job: {
        id: attempt.job.id,
        jobNumber: attempt.job.jobNumber,
        title: attempt.job.title,
        description: attempt.job.description,
        serviceAddressLine1: attempt.job.serviceAddressLine1,
        serviceCity: attempt.job.serviceCity,
        serviceProvince: attempt.job.serviceProvince,
        servicePostalCode: attempt.job.servicePostalCode,
        urgency: attempt.job.urgency,
        preferredDateStart: attempt.job.preferredDateStart,
        preferredDateEnd: attempt.job.preferredDateEnd,
        serviceCategory: {
          id: attempt.job.serviceCategory.id,
          name: attempt.job.serviceCategory.name,
          code: attempt.job.serviceCategory.code,
        },
      },
      timeRemaining: Math.max(
        0,
        Math.floor((attempt.slaDeadline.getTime() - now.getTime()) / 1000),
      ),
    }));
  }

  /**
   * Calculate response time in minutes
   */
  private calculateResponseTime(dispatchedAt: Date): number {
    const now = new Date();
    return Math.round((now.getTime() - dispatchedAt.getTime()) / 60000);
  }

  /**
   * Update pro's average response time metrics
   */
  private async updateProResponseMetrics(
    proProfileId: string,
    dispatchedAt: Date,
  ): Promise<void> {
    const responseMinutes = this.calculateResponseTime(dispatchedAt);

    // Get current metrics
    const pro = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      select: {
        avgResponseMinutes: true,
        totalJobsCompleted: true,
      },
    });

    if (!pro) return;

    // Calculate new average (simple moving average)
    const currentAvg = pro.avgResponseMinutes || responseMinutes;
    const completedCount = pro.totalJobsCompleted || 0;
    const newAvg =
      (currentAvg * completedCount + responseMinutes) / (completedCount + 1);

    await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: {
        avgResponseMinutes: newAvg,
      },
    });
  }

  /**
   * Map database entity to response DTO
   */
  private mapToDispatchAttemptResponse(attempt: {
    id: string;
    jobId: string;
    proProfileId: string;
    attemptNumber: number;
    status: string;
    declineReasonId?: string | null;
    declineNotes?: string | null;
    dispatchedAt: Date;
    respondedAt?: Date | null;
    slaDeadline: Date;
    ranking?: number | null;
    distance?: number | null;
    createdAt: Date;
  }): DispatchAttemptResponseDto {
    return {
      id: attempt.id,
      jobId: attempt.jobId,
      proProfileId: attempt.proProfileId,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      declineReasonId: attempt.declineReasonId,
      declineNotes: attempt.declineNotes,
      dispatchedAt: attempt.dispatchedAt,
      respondedAt: attempt.respondedAt,
      slaDeadline: attempt.slaDeadline,
      ranking: attempt.ranking,
      distance: attempt.distance,
      createdAt: attempt.createdAt,
    };
  }

  /**
   * Get all dispatch attempts that have exceeded their SLA deadline
   */
  async getTimedOutAttempts() {
    const now = new Date();

    return this.prisma.dispatchAttempt.findMany({
      where: {
        status: 'PENDING',
        slaDeadline: {
          lt: now,
        },
      },
      include: {
        job: true,
        proProfile: true,
      },
    });
  }

  /**
   * Process a timeout for a dispatch attempt
   */
  async processTimeout(attemptId: string) {
    const attempt = await this.prisma.dispatchAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'TIMEOUT',
        respondedAt: new Date(),
      },
    });

    this.logger.log(`Dispatch attempt ${attemptId} marked as timed out`);

    return attempt;
  }
}
