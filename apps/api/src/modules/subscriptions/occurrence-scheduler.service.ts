import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PolicyService } from '../feature-flags/policy.service';
import { AuditService } from '../audit/audit.service';
import { POLICY_KEYS, AUDIT_ACTIONS, DEFAULT_POLICIES } from '@trades/shared';
import {
  ServiceOccurrenceResponseDto,
  OccurrencesListResponseDto,
  OccurrencesQueryDto,
  SkipOccurrenceDto,
  RescheduleOccurrenceDto,
} from './dto/subscriptions.dto';

/**
 * OccurrenceSchedulerService - Manages service occurrences
 *
 * Handles:
 * - Auto-creating jobs from scheduled occurrences (BullMQ worker in P2)
 * - Occurrence listing and management
 * - Skip and reschedule operations
 *
 * Uses SUBSCRIPTION_AUTO_CREATE_JOB_DAYS policy to determine
 * when to auto-create jobs from occurrences.
 */
@Injectable()
export class OccurrenceSchedulerService {
  private readonly logger = new Logger(OccurrenceSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get occurrences for a subscription
   */
  async getOccurrences(
    subscriptionId: string,
    query: OccurrencesQueryDto,
  ): Promise<OccurrencesListResponseDto> {
    const { status, fromDate, toDate, page = 1, pageSize = 20 } = query;

    const where: Record<string, unknown> = {
      subscriptionId,
    };

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.scheduledDate = {};
      if (fromDate) {
        (where.scheduledDate as Record<string, Date>).gte = new Date(fromDate);
      }
      if (toDate) {
        (where.scheduledDate as Record<string, Date>).lte = new Date(toDate);
      }
    }

    const skip = (page - 1) * pageSize;

    const [occurrences, total] = await Promise.all([
      this.prisma.serviceOccurrence.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { scheduledDate: 'asc' },
      }),
      this.prisma.serviceOccurrence.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      occurrences: occurrences.map((occ) => this.mapToResponse(occ)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get a single occurrence by ID
   */
  async getOccurrence(id: string): Promise<ServiceOccurrenceResponseDto> {
    const occurrence = await this.prisma.serviceOccurrence.findUnique({
      where: { id },
    });

    if (!occurrence) {
      throw new Error('Occurrence not found');
    }

    return this.mapToResponse(occurrence);
  }

  /**
   * Skip an occurrence
   */
  async skipOccurrence(
    id: string,
    dto: SkipOccurrenceDto,
    actorId: string,
  ): Promise<ServiceOccurrenceResponseDto> {
    const occurrence = await this.prisma.serviceOccurrence.findUnique({
      where: { id },
    });

    if (!occurrence) {
      throw new Error('Occurrence not found');
    }

    if (occurrence.status !== 'SCHEDULED') {
      throw new Error('Can only skip scheduled occurrences');
    }

    const updated = await this.prisma.serviceOccurrence.update({
      where: { id },
      data: {
        status: 'SKIPPED',
        skipReason: dto.reason,
      },
    });

    // Audit log
    await this.auditService.log({
      action: AUDIT_ACTIONS.SERVICE_OCCURRENCE_SKIPPED,
      actorId,
      targetType: 'ServiceOccurrence',
      targetId: id,
      details: { reason: dto.reason },
    });

    this.logger.log(`Occurrence skipped: ${id}`);

    return this.mapToResponse(updated);
  }

  /**
   * Reschedule an occurrence
   */
  async rescheduleOccurrence(
    id: string,
    dto: RescheduleOccurrenceDto,
    actorId: string,
  ): Promise<ServiceOccurrenceResponseDto> {
    const occurrence = await this.prisma.serviceOccurrence.findUnique({
      where: { id },
    });

    if (!occurrence) {
      throw new Error('Occurrence not found');
    }

    if (occurrence.status !== 'SCHEDULED') {
      throw new Error('Can only reschedule scheduled occurrences');
    }

    const newDate = new Date(dto.newDate);

    if (newDate <= new Date()) {
      throw new Error('New date must be in the future');
    }

    const updated = await this.prisma.serviceOccurrence.update({
      where: { id },
      data: {
        scheduledDate: newDate,
        scheduledTimeSlot: dto.newTimeSlot ?? occurrence.scheduledTimeSlot,
        notes: `Rescheduled from ${occurrence.scheduledDate.toISOString()}`,
      },
    });

    // Audit log
    await this.auditService.log({
      action: 'SERVICE_OCCURRENCE_RESCHEDULED',
      actorId,
      targetType: 'ServiceOccurrence',
      targetId: id,
      details: {
        oldDate: occurrence.scheduledDate,
        newDate,
        newTimeSlot: dto.newTimeSlot,
      },
    });

    this.logger.log(`Occurrence rescheduled: ${id} to ${newDate}`);

    return this.mapToResponse(updated);
  }

  /**
   * Process scheduled occurrences and create jobs
   *
   * P1: Manual trigger
   * P2: BullMQ scheduled worker
   *
   * Creates jobs for occurrences that are within the
   * SUBSCRIPTION_AUTO_CREATE_JOB_DAYS window.
   */
  async processScheduledOccurrences(): Promise<{
    processed: number;
    jobsCreated: number;
    errors: string[];
  }> {
    const daysAhead = await this.policyService.getValue<number>(
      POLICY_KEYS.SUBSCRIPTION_AUTO_CREATE_JOB_DAYS,
      {},
    ) ?? DEFAULT_POLICIES[POLICY_KEYS.SUBSCRIPTION_AUTO_CREATE_JOB_DAYS];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    // Find scheduled occurrences within the window that don't have jobs
    const occurrences = await this.prisma.serviceOccurrence.findMany({
      where: {
        status: 'SCHEDULED',
        jobId: null,
        scheduledDate: {
          lte: cutoffDate,
          gte: new Date(), // Only future occurrences
        },
      },
      include: {
        subscription: {
          include: {
            servicePlan: true,
            consumerProfile: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      take: 100, // Process in batches
    });

    let jobsCreated = 0;
    const errors: string[] = [];

    for (const occurrence of occurrences) {
      try {
        await this.createJobFromOccurrence(occurrence);
        jobsCreated++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Occurrence ${occurrence.id}: ${errorMessage}`);
        this.logger.error(`Failed to create job for occurrence ${occurrence.id}:`, error);
      }
    }

    this.logger.log(
      `Processed ${occurrences.length} occurrences, created ${jobsCreated} jobs, ${errors.length} errors`,
    );

    return {
      processed: occurrences.length,
      jobsCreated,
      errors,
    };
  }

  /**
   * Create a job from a service occurrence
   */
  private async createJobFromOccurrence(occurrence: {
    id: string;
    scheduledDate: Date;
    scheduledTimeSlot: string | null;
    subscription: {
      id: string;
      servicePlan: {
        name: string;
        serviceTemplate: unknown;
        estimatedDurationMins: number | null;
        serviceCategoryId: string | null;
      };
      consumerProfile: {
        userId: string;
        propertyAddressLine1: string | null;
        propertyAddressLine2: string | null;
        propertyCity: string | null;
        propertyProvince: string | null;
        propertyPostalCode: string | null;
        propertyLat: number | null;
        propertyLng: number | null;
        user: {
          id: string;
          firstName: string | null;
          lastName: string | null;
          email: string;
          phone: string | null;
        };
      };
    };
  }): Promise<void> {
    const { subscription } = occurrence;
    const { servicePlan, consumerProfile } = subscription;
    const { user } = consumerProfile;
    const template = servicePlan.serviceTemplate as Record<string, unknown>;

    // Create job from template and subscription data
    const job = await this.prisma.job.create({
      data: {
        createdById: user.id,
        serviceCategoryId: servicePlan.serviceCategoryId ?? '',
        status: 'DRAFT',
        contactName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
        contactEmail: user.email,
        contactPhone: user.phone ?? '',
        serviceAddressLine1: consumerProfile.propertyAddressLine1 ?? '',
        serviceAddressLine2: consumerProfile.propertyAddressLine2,
        serviceCity: consumerProfile.propertyCity ?? '',
        serviceProvince: consumerProfile.propertyProvince ?? '',
        servicePostalCode: consumerProfile.propertyPostalCode ?? '',
        serviceLat: consumerProfile.propertyLat,
        serviceLng: consumerProfile.propertyLng,
        title: (template.title as string) ?? servicePlan.name,
        description: (template.description as string) ?? `Scheduled service from ${servicePlan.name}`,
        preferredDateStart: occurrence.scheduledDate,
        preferredDateEnd: occurrence.scheduledDate,
        estimatedDuration: servicePlan.estimatedDurationMins,
        internalNotes: `Auto-created from subscription ${subscription.id}, occurrence ${occurrence.id}`,
      },
    });

    // Link job to occurrence
    await this.prisma.serviceOccurrence.update({
      where: { id: occurrence.id },
      data: {
        jobId: job.id,
        jobCreatedAt: new Date(),
        status: 'JOB_CREATED',
      },
    });

    // Audit log
    await this.auditService.log({
      action: AUDIT_ACTIONS.SERVICE_OCCURRENCE_CREATED,
      targetType: 'ServiceOccurrence',
      targetId: occurrence.id,
      details: {
        jobId: job.id,
        subscriptionId: subscription.id,
      },
    });

    this.logger.debug(`Created job ${job.id} from occurrence ${occurrence.id}`);
  }

  /**
   * Mark occurrence as completed
   */
  async markCompleted(
    id: string,
    actorId?: string,
  ): Promise<ServiceOccurrenceResponseDto> {
    const occurrence = await this.prisma.serviceOccurrence.findUnique({
      where: { id },
    });

    if (!occurrence) {
      throw new Error('Occurrence not found');
    }

    const updated = await this.prisma.serviceOccurrence.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Audit log
    await this.auditService.log({
      action: AUDIT_ACTIONS.SERVICE_OCCURRENCE_COMPLETED,
      actorId,
      targetType: 'ServiceOccurrence',
      targetId: id,
    });

    this.logger.log(`Occurrence completed: ${id}`);

    return this.mapToResponse(updated);
  }

  /**
   * Get upcoming occurrences for a consumer
   */
  async getUpcomingForConsumer(
    consumerProfileId: string,
    limit: number = 10,
  ): Promise<ServiceOccurrenceResponseDto[]> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        consumerProfileId,
        status: { in: ['ACTIVE', 'TRIAL'] },
      },
      select: { id: true },
    });

    if (subscriptions.length === 0) {
      return [];
    }

    const occurrences = await this.prisma.serviceOccurrence.findMany({
      where: {
        subscriptionId: { in: subscriptions.map((s) => s.id) },
        status: { in: ['SCHEDULED', 'JOB_CREATED'] },
        scheduledDate: { gte: new Date() },
      },
      orderBy: { scheduledDate: 'asc' },
      take: limit,
    });

    return occurrences.map((occ) => this.mapToResponse(occ));
  }

  /**
   * Map database entity to response DTO
   */
  private mapToResponse(occurrence: {
    id: string;
    subscriptionId: string;
    scheduledDate: Date;
    scheduledTimeSlot: string | null;
    occurrenceNumber: number;
    status: string;
    jobId: string | null;
    jobCreatedAt: Date | null;
    completedAt: Date | null;
    skipReason: string | null;
    notes: string | null;
    createdAt: Date;
  }): ServiceOccurrenceResponseDto {
    return {
      id: occurrence.id,
      subscriptionId: occurrence.subscriptionId,
      scheduledDate: occurrence.scheduledDate,
      scheduledTimeSlot: occurrence.scheduledTimeSlot ?? undefined,
      occurrenceNumber: occurrence.occurrenceNumber,
      status: occurrence.status,
      jobId: occurrence.jobId ?? undefined,
      jobCreatedAt: occurrence.jobCreatedAt ?? undefined,
      completedAt: occurrence.completedAt ?? undefined,
      skipReason: occurrence.skipReason ?? undefined,
      notes: occurrence.notes ?? undefined,
      createdAt: occurrence.createdAt,
    };
  }
}
