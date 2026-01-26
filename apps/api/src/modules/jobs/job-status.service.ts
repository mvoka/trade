import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActorType } from '../audit/dto/audit.dto';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import {
  JobStatus,
  JobStatusTransitions,
  FEATURE_FLAGS,
  AUDIT_ACTIONS,
  FILE_UPLOAD,
} from '@trades/shared';
import { Job, JobAttachment } from '@trades/prisma';
import { CompleteJobDto } from './dto/jobs.dto';
import { StorageService } from '../../common/storage/storage.service';

export interface StatusChangeResult {
  job: Job;
  previousStatus: JobStatus;
  newStatus: JobStatus;
  changedAt: Date;
}

@Injectable()
export class JobStatusService {
  private readonly logger = new Logger(JobStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Check if a status transition is valid
   */
  canTransition(currentStatus: JobStatus, newStatus: JobStatus): boolean {
    const allowedTransitions = JobStatusTransitions[currentStatus];
    return allowedTransitions?.includes(newStatus) ?? false;
  }

  /**
   * Get all valid transitions from current status
   */
  getValidTransitions(currentStatus: JobStatus): JobStatus[] {
    return JobStatusTransitions[currentStatus] ?? [];
  }

  /**
   * Change job status with validation and side effects
   */
  async changeStatus(
    jobId: string,
    newStatus: JobStatus,
    userId: string,
    options?: {
      reason?: string;
      notes?: string;
      proProfileId?: string;
    },
  ): Promise<StatusChangeResult> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        serviceCategory: true,
        attachments: true,
        dispatchAssignment: true,
      },
    });

    if (!job) {
      throw new BadRequestException(`Job with ID ${jobId} not found`);
    }

    const currentStatus = job.status as JobStatus;

    // Validate transition
    if (!this.canTransition(currentStatus, newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}. ` +
          `Valid transitions: ${this.getValidTransitions(currentStatus).join(', ') || 'none'}`,
      );
    }

    // Run pre-transition validations
    await this.validatePreTransition(job, currentStatus, newStatus, options);

    // Perform the transition
    const changedAt = new Date();
    const updateData = this.buildStatusUpdateData(newStatus, changedAt, options);

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: updateData,
    });

    // Handle post-transition side effects
    await this.onStatusChange(updatedJob, currentStatus, newStatus, userId, options);

    this.logger.log(
      `Job ${job.jobNumber} status changed: ${currentStatus} -> ${newStatus}`,
    );

    return {
      job: updatedJob,
      previousStatus: currentStatus,
      newStatus,
      changedAt,
    };
  }

  /**
   * Complete a job with after photos (for Pro users)
   */
  async completeJob(
    jobId: string,
    dto: CompleteJobDto,
    userId: string,
    proProfileId: string,
  ): Promise<StatusChangeResult> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        serviceCategory: true,
        dispatchAssignment: true,
      },
    });

    if (!job) {
      throw new BadRequestException(`Job with ID ${jobId} not found`);
    }

    // Verify the pro is assigned to this job
    if (job.dispatchAssignment?.proProfileId !== proProfileId) {
      throw new ForbiddenException('You are not assigned to this job');
    }

    // Check current status allows completion
    const currentStatus = job.status as JobStatus;
    if (currentStatus !== JobStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot complete job in ${currentStatus} status. Job must be IN_PROGRESS.`,
      );
    }

    // Check if after photos are required
    const requireAfterPhotos = await this.featureFlagsService.isEnabled(
      FEATURE_FLAGS.REQUIRE_AFTER_PHOTOS,
      {
        serviceCategoryId: job.serviceCategoryId,
      },
    );

    if (requireAfterPhotos) {
      if (!dto.afterPhotoKeys || dto.afterPhotoKeys.length < FILE_UPLOAD.MIN_AFTER_PHOTOS) {
        throw new BadRequestException(
          `At least ${FILE_UPLOAD.MIN_AFTER_PHOTOS} after photo(s) required to complete the job`,
        );
      }
      if (dto.afterPhotoKeys.length > FILE_UPLOAD.MAX_AFTER_PHOTOS) {
        throw new BadRequestException(
          `Maximum ${FILE_UPLOAD.MAX_AFTER_PHOTOS} after photos allowed`,
        );
      }
    }

    // Create after photo attachments and complete job in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Add after photos
      if (dto.afterPhotoKeys && dto.afterPhotoKeys.length > 0) {
        await tx.jobAttachment.createMany({
          data: dto.afterPhotoKeys.map((key) => ({
            jobId: job.id,
            type: 'AFTER_PHOTO' as const,
            fileName: key.split('/').pop() || key,
            fileUrl: this.storageService.getPublicUrl(key),
            uploadedById: userId,
          })),
        });
      }

      // Update job to completed
      const completedJob = await tx.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          internalNotes: dto.completionNotes
            ? `${job.internalNotes || ''}\n\n[Completion Notes]: ${dto.completionNotes}`.trim()
            : job.internalNotes,
        },
      });

      // Update pro profile metrics
      await tx.proProfile.update({
        where: { id: proProfileId },
        data: {
          totalJobsCompleted: { increment: 1 },
        },
      });

      return completedJob;
    });

    // Log audit event
    await this.auditService.log({
      action: AUDIT_ACTIONS.JOB_COMPLETED,
      actorId: userId,
      actorType: ActorType.USER,
      targetType: 'Job',
      targetId: jobId,
      details: {
        jobNumber: job.jobNumber,
        proProfileId,
        afterPhotosCount: dto.afterPhotoKeys?.length || 0,
        actualDuration: dto.actualDuration,
      },
    });

    this.logger.log(`Job ${job.jobNumber} completed by pro ${proProfileId}`);

    return {
      job: result,
      previousStatus: currentStatus,
      newStatus: JobStatus.COMPLETED,
      changedAt: new Date(),
    };
  }

  /**
   * Cancel a job
   */
  async cancelJob(
    jobId: string,
    userId: string,
    reason: string,
  ): Promise<StatusChangeResult> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new BadRequestException(`Job with ID ${jobId} not found`);
    }

    const currentStatus = job.status as JobStatus;

    // Validate can cancel
    if (!this.canTransition(currentStatus, JobStatus.CANCELLED)) {
      throw new BadRequestException(
        `Cannot cancel job in ${currentStatus} status`,
      );
    }

    // Perform cancellation
    const cancelledAt = new Date();
    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.CANCELLED,
        cancelledAt,
        internalNotes: `${job.internalNotes || ''}\n\n[Cancelled]: ${reason}`.trim(),
      },
    });

    // Log audit event
    await this.auditService.log({
      action: AUDIT_ACTIONS.JOB_CANCELLED,
      actorId: userId,
      actorType: ActorType.USER,
      targetType: 'Job',
      targetId: jobId,
      details: {
        jobNumber: job.jobNumber,
        previousStatus: currentStatus,
        reason,
      },
    });

    this.logger.log(`Job ${job.jobNumber} cancelled. Reason: ${reason}`);

    return {
      job: updatedJob,
      previousStatus: currentStatus,
      newStatus: JobStatus.CANCELLED,
      changedAt: cancelledAt,
    };
  }

  /**
   * Validate pre-transition requirements
   */
  private async validatePreTransition(
    job: Job & { attachments?: JobAttachment[]; dispatchAssignment?: any },
    currentStatus: JobStatus,
    newStatus: JobStatus,
    options?: { proProfileId?: string },
  ): Promise<void> {
    switch (newStatus) {
      case JobStatus.DISPATCHED:
        // Job must have all required info before dispatch
        if (!job.contactPhone) {
          throw new BadRequestException('Contact phone is required before dispatching');
        }
        break;

      case JobStatus.ACCEPTED:
        // Must have a dispatch assignment
        if (!job.dispatchAssignment) {
          throw new BadRequestException('Job must be assigned to a pro before acceptance');
        }
        break;

      case JobStatus.SCHEDULED:
        // Must have a booking or scheduled date
        // This is typically handled by the booking flow
        break;

      case JobStatus.IN_PROGRESS:
        // Verify the job is properly scheduled
        if (currentStatus !== JobStatus.SCHEDULED) {
          throw new BadRequestException('Job must be scheduled before starting');
        }
        break;

      case JobStatus.COMPLETED:
        // Check if after photos are required
        const requireAfterPhotos = await this.featureFlagsService.isEnabled(
          FEATURE_FLAGS.REQUIRE_AFTER_PHOTOS,
          {
            serviceCategoryId: job.serviceCategoryId,
          },
        );

        if (requireAfterPhotos) {
          const afterPhotos = job.attachments?.filter((a) => a.type === 'AFTER_PHOTO') || [];
          if (afterPhotos.length < FILE_UPLOAD.MIN_AFTER_PHOTOS) {
            throw new BadRequestException(
              `At least ${FILE_UPLOAD.MIN_AFTER_PHOTOS} after photo(s) required to complete the job`,
            );
          }
        }
        break;

      case JobStatus.CANCELLED:
        // Already validated in canTransition
        break;
    }
  }

  /**
   * Build update data for status change
   */
  private buildStatusUpdateData(
    newStatus: JobStatus,
    changedAt: Date,
    options?: { reason?: string; notes?: string },
  ): any {
    const updateData: any = {
      status: newStatus,
    };

    switch (newStatus) {
      case JobStatus.DISPATCHED:
        updateData.dispatchedAt = changedAt;
        break;
      case JobStatus.ACCEPTED:
        updateData.acceptedAt = changedAt;
        break;
      case JobStatus.SCHEDULED:
        updateData.scheduledAt = changedAt;
        break;
      case JobStatus.IN_PROGRESS:
        updateData.startedAt = changedAt;
        break;
      case JobStatus.COMPLETED:
        updateData.completedAt = changedAt;
        break;
      case JobStatus.CANCELLED:
        updateData.cancelledAt = changedAt;
        break;
    }

    return updateData;
  }

  /**
   * Handle side effects after status change
   */
  private async onStatusChange(
    job: Job,
    oldStatus: JobStatus,
    newStatus: JobStatus,
    userId: string,
    options?: { reason?: string; notes?: string },
  ): Promise<void> {
    // Log the status change
    await this.auditService.log({
      action: AUDIT_ACTIONS.JOB_STATUS_CHANGED,
      actorId: userId,
      actorType: ActorType.USER,
      targetType: 'Job',
      targetId: job.id,
      details: {
        jobNumber: job.jobNumber,
        previousStatus: oldStatus,
        newStatus,
        reason: options?.reason,
      },
    });

    // Trigger notifications based on status change
    switch (newStatus) {
      case JobStatus.DISPATCHED:
        // Notification to available pros will be handled by dispatch service
        this.logger.log(`Job ${job.jobNumber} dispatched - dispatch service will notify pros`);
        break;

      case JobStatus.ACCEPTED:
        // Notify SMB that a pro accepted
        this.logger.log(`Job ${job.jobNumber} accepted - notify SMB`);
        // TODO: Send notification via communications service
        break;

      case JobStatus.SCHEDULED:
        // Notify both parties about scheduled time
        this.logger.log(`Job ${job.jobNumber} scheduled - notify all parties`);
        // TODO: Send notification via communications service
        break;

      case JobStatus.IN_PROGRESS:
        // Notify SMB that work has started
        this.logger.log(`Job ${job.jobNumber} started - notify SMB`);
        // TODO: Send notification via communications service
        break;

      case JobStatus.COMPLETED:
        // Notify SMB that job is complete
        this.logger.log(`Job ${job.jobNumber} completed - notify SMB, trigger payment`);
        // TODO: Send notification and trigger payment flow
        break;

      case JobStatus.CANCELLED:
        // Notify relevant parties about cancellation
        this.logger.log(`Job ${job.jobNumber} cancelled - notify all parties`);
        // TODO: Send notification and handle any refunds
        break;
    }
  }

  /**
   * Get status change history for a job (from audit logs)
   */
  async getStatusHistory(jobId: string): Promise<any[]> {
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        targetType: 'Job',
        targetId: jobId,
        action: {
          in: [
            AUDIT_ACTIONS.JOB_CREATED,
            AUDIT_ACTIONS.JOB_STATUS_CHANGED,
            AUDIT_ACTIONS.JOB_COMPLETED,
            AUDIT_ACTIONS.JOB_CANCELLED,
          ],
        },
      },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      timestamp: log.createdAt,
      actor: log.actor,
      details: log.details,
    }));
  }
}
