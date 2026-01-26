import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActorType } from '../audit/dto/audit.dto';
import { AUDIT_ACTIONS } from '@trades/shared';
import {
  JobQueueQueryDto,
  ManualDispatchDto,
  EscalationOverrideDto,
  InternalNoteDto,
  EscalationOverrideAction,
  JobQueueItemDto,
  JobDetailsResponseDto,
  InternalNoteResponseDto,
  SlaBreachAlertDto,
  EscalatedJobDto,
  DispatchAttemptDto,
  ManualDispatchResponseDto,
  EscalationOverrideResponseDto,
} from './dto/operator.dto';

// Internal note structure stored in JSON
interface InternalNote {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get jobs awaiting action (dispatched, escalated, SLA breaches)
   */
  async getJobQueue(filters: JobQueueQueryDto): Promise<{
    data: JobQueueItemDto[];
    meta: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      status,
      dateFrom,
      dateTo,
      slaBreached,
      escalated,
      serviceCategory,
      urgency,
      search,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    // Build where clause
    const where: any = {};

    // Status filter (can be comma-separated)
    if (status) {
      const statuses = status.split(',').map((s) => s.trim());
      where.status = { in: statuses };
    } else {
      // Default: show actionable jobs
      where.status = { in: ['DISPATCHED', 'ACCEPTED', 'SCHEDULED'] };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Service category filter
    if (serviceCategory) {
      where.serviceCategory = {
        code: serviceCategory,
      };
    }

    // Urgency filter
    if (urgency) {
      where.urgency = urgency;
    }

    // Search filter
    if (search) {
      where.OR = [
        { jobNumber: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { businessName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await this.prisma.job.count({ where });

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // Get jobs with related data
    const jobs = await this.prisma.job.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      include: {
        serviceCategory: true,
        dispatchAttempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
        dispatchAssignment: {
          include: {
            proProfile: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    // Process jobs to determine SLA and escalation status
    const now = new Date();
    let filteredJobs = jobs.map((job) => {
      const lastAttempt = job.dispatchAttempts[0];
      const isSlaBreached = lastAttempt && new Date(lastAttempt.slaDeadline) < now && lastAttempt.status === 'PENDING';
      const isEscalated = job.dispatchAttempts.length > 1 && lastAttempt?.status !== 'ACCEPTED';

      return {
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
        contactName: job.contactName,
        serviceCategory: job.serviceCategory.name,
        urgency: job.urgency,
        serviceCity: job.serviceCity,
        serviceProvince: job.serviceProvince,
        escalated: isEscalated,
        slaBreached: isSlaBreached,
        slaDeadline: lastAttempt?.slaDeadline,
        dispatchAttemptCount: job.dispatchAttempts.length,
        assignedProName: job.dispatchAssignment
          ? `${job.dispatchAssignment.proProfile.user.firstName || ''} ${job.dispatchAssignment.proProfile.user.lastName || ''}`.trim()
          : undefined,
        createdAt: job.createdAt,
        _slaBreached: isSlaBreached,
        _escalated: isEscalated,
      };
    });

    // Apply SLA breach filter if specified
    if (slaBreached !== undefined) {
      filteredJobs = filteredJobs.filter((job) => job._slaBreached === slaBreached);
    }

    // Apply escalation filter if specified
    if (escalated !== undefined) {
      filteredJobs = filteredJobs.filter((job) => job._escalated === escalated);
    }

    // Remove internal flags
    const data = filteredJobs.map(({ _slaBreached, _escalated, ...job }) => job);

    return {
      data,
      meta: {
        page,
        pageSize,
        total: slaBreached !== undefined || escalated !== undefined ? data.length : total,
        totalPages: slaBreached !== undefined || escalated !== undefined ? Math.ceil(data.length / pageSize) : totalPages,
      },
    };
  }

  /**
   * Get full job details with dispatch history
   */
  async getJobDetails(jobId: string): Promise<JobDetailsResponseDto> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        serviceCategory: true,
        dispatchAttempts: {
          orderBy: { attemptNumber: 'asc' },
          include: {
            proProfile: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
            declineReason: true,
          },
        },
        dispatchAssignment: {
          include: {
            proProfile: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    // Parse internal notes from JSON field or empty array
    let internalNotes: InternalNote[] = [];
    if (job.internalNotes) {
      try {
        internalNotes = JSON.parse(job.internalNotes);
      } catch {
        // If parsing fails, treat as a single legacy note
        internalNotes = [];
      }
    }

    const now = new Date();
    const lastAttempt = job.dispatchAttempts[job.dispatchAttempts.length - 1];
    const isSlaBreached = lastAttempt && new Date(lastAttempt.slaDeadline) < now && lastAttempt.status === 'PENDING';
    const isEscalated = job.dispatchAttempts.length > 1 && lastAttempt?.status !== 'ACCEPTED';

    // Build dispatch history
    const dispatchHistory: DispatchAttemptDto[] = job.dispatchAttempts.map((attempt) => ({
      id: attempt.id,
      proProfileId: attempt.proProfileId,
      proName: `${attempt.proProfile.user.firstName || ''} ${attempt.proProfile.user.lastName || ''}`.trim(),
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      declineReason: attempt.declineReason?.label || attempt.declineNotes,
      slaDeadline: attempt.slaDeadline,
      dispatchedAt: attempt.dispatchedAt,
      respondedAt: attempt.respondedAt || undefined,
    }));

    // Build internal notes response
    const notesResponse: InternalNoteResponseDto[] = internalNotes.map((note) => ({
      id: note.id,
      jobId: job.id,
      content: note.content,
      authorId: note.authorId,
      authorName: note.authorName,
      createdAt: new Date(note.createdAt),
    }));

    return {
      id: job.id,
      jobNumber: job.jobNumber,
      status: job.status,
      contactName: job.contactName,
      contactEmail: job.contactEmail || undefined,
      contactPhone: job.contactPhone,
      businessName: job.businessName || undefined,
      serviceCategory: job.serviceCategory.name,
      title: job.title || undefined,
      description: job.description,
      urgency: job.urgency,
      serviceCity: job.serviceCity,
      serviceProvince: job.serviceProvince,
      serviceAddress: [
        job.serviceAddressLine1,
        job.serviceAddressLine2,
        `${job.serviceCity}, ${job.serviceProvince} ${job.servicePostalCode}`,
      ]
        .filter(Boolean)
        .join(', '),
      escalated: isEscalated,
      slaBreached: isSlaBreached,
      slaDeadline: lastAttempt?.slaDeadline,
      dispatchAttemptCount: job.dispatchAttempts.length,
      assignedProId: job.dispatchAssignment?.proProfileId,
      assignedProName: job.dispatchAssignment
        ? `${job.dispatchAssignment.proProfile.user.firstName || ''} ${job.dispatchAssignment.proProfile.user.lastName || ''}`.trim()
        : undefined,
      dispatchedAt: job.dispatchedAt || undefined,
      acceptedAt: job.acceptedAt || undefined,
      scheduledAt: job.scheduledAt || undefined,
      createdAt: job.createdAt,
      dispatchHistory,
      internalNotes: notesResponse,
    };
  }

  /**
   * Manually assign job to a pro
   */
  async manualDispatch(
    jobId: string,
    dto: ManualDispatchDto,
    operatorId: string,
  ): Promise<ManualDispatchResponseDto> {
    const { proProfileId, note } = dto;

    // Get job
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        dispatchAttempts: true,
        dispatchAssignment: true,
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    // Check job is in a dispatchable state
    if (!['DRAFT', 'DISPATCHED'].includes(job.status)) {
      throw new BadRequestException(`Job cannot be dispatched in current status: ${job.status}`);
    }

    // Verify pro exists and is verified
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
    }

    if (proProfile.verificationStatus !== 'APPROVED') {
      throw new BadRequestException('Pro is not verified and cannot be assigned jobs');
    }

    // Calculate next attempt number
    const nextAttemptNumber = job.dispatchAttempts.length + 1;

    // Create dispatch attempt and assignment in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Cancel any pending dispatch attempts
      await tx.dispatchAttempt.updateMany({
        where: {
          jobId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          respondedAt: new Date(),
        },
      });

      // Calculate SLA deadline (5 minutes default for accept)
      const slaDeadline = new Date();
      slaDeadline.setMinutes(slaDeadline.getMinutes() + 5);

      // Create new dispatch attempt
      const dispatchAttempt = await tx.dispatchAttempt.create({
        data: {
          jobId,
          proProfileId,
          attemptNumber: nextAttemptNumber,
          status: 'PENDING',
          slaDeadline,
          ranking: 1000, // Manual dispatch gets high priority
        },
      });

      // Update or create dispatch assignment
      await tx.dispatchAssignment.upsert({
        where: { jobId },
        create: {
          jobId,
          proProfileId,
          assignedBy: operatorId,
          isManual: true,
        },
        update: {
          proProfileId,
          assignedBy: operatorId,
          isManual: true,
          assignedAt: new Date(),
        },
      });

      // Update job status
      await tx.job.update({
        where: { id: jobId },
        data: {
          status: 'DISPATCHED',
          dispatchedAt: new Date(),
          assignedProId: proProfileId,
        },
      });

      // Add internal note if provided
      if (note) {
        const operator = await tx.user.findUnique({
          where: { id: operatorId },
          select: { firstName: true, lastName: true },
        });

        const existingNotes = job.internalNotes ? JSON.parse(job.internalNotes) : [];
        const newNote: InternalNote = {
          id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: `[Manual Dispatch] ${note}`,
          authorId: operatorId,
          authorName: `${operator?.firstName || ''} ${operator?.lastName || ''}`.trim() || 'Operator',
          createdAt: new Date().toISOString(),
        };

        await tx.job.update({
          where: { id: jobId },
          data: {
            internalNotes: JSON.stringify([...existingNotes, newNote]),
          },
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: AUDIT_ACTIONS.DISPATCH_MANUAL_OVERRIDE,
          actorId: operatorId,
          actorType: ActorType.USER,
          targetType: 'Job',
          targetId: jobId,
          details: {
            proProfileId,
            attemptNumber: nextAttemptNumber,
            note: note || null,
          },
        },
      });

      return dispatchAttempt;
    });

    this.logger.log(`Manual dispatch: Job ${jobId} assigned to pro ${proProfileId} by operator ${operatorId}`);

    return {
      success: true,
      message: 'Job manually dispatched successfully',
      dispatchAttemptId: result.id,
      assignedProName: `${proProfile.user.firstName || ''} ${proProfile.user.lastName || ''}`.trim(),
    };
  }

  /**
   * Override escalation step
   */
  async overrideEscalation(
    jobId: string,
    dto: EscalationOverrideDto,
    operatorId: string,
  ): Promise<EscalationOverrideResponseDto> {
    const { step, reason, proProfileId } = dto;

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        dispatchAttempts: {
          orderBy: { attemptNumber: 'desc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    let newStatus: string;
    let message: string;

    await this.prisma.$transaction(async (tx) => {
      // Get operator info for notes
      const operator = await tx.user.findUnique({
        where: { id: operatorId },
        select: { firstName: true, lastName: true },
      });
      const operatorName = `${operator?.firstName || ''} ${operator?.lastName || ''}`.trim() || 'Operator';

      switch (step) {
        case EscalationOverrideAction.RESOLVE:
          // Mark job as resolved/completed from escalation
          newStatus = 'COMPLETED';
          message = 'Escalation resolved and job marked as completed';

          await tx.dispatchAttempt.updateMany({
            where: { jobId, status: 'PENDING' },
            data: { status: 'CANCELLED', respondedAt: new Date() },
          });

          await tx.job.update({
            where: { id: jobId },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          });
          break;

        case EscalationOverrideAction.REASSIGN:
          if (!proProfileId) {
            throw new BadRequestException('Pro profile ID is required for reassignment');
          }

          // Reassign to a different pro
          newStatus = 'DISPATCHED';
          message = 'Job reassigned to new pro';

          const proProfile = await tx.proProfile.findUnique({
            where: { id: proProfileId },
          });

          if (!proProfile) {
            throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
          }

          await tx.dispatchAttempt.updateMany({
            where: { jobId, status: 'PENDING' },
            data: { status: 'CANCELLED', respondedAt: new Date() },
          });

          const nextAttempt = job.dispatchAttempts.length + 1;
          const slaDeadline = new Date();
          slaDeadline.setMinutes(slaDeadline.getMinutes() + 5);

          await tx.dispatchAttempt.create({
            data: {
              jobId,
              proProfileId,
              attemptNumber: nextAttempt,
              status: 'PENDING',
              slaDeadline,
            },
          });

          await tx.dispatchAssignment.upsert({
            where: { jobId },
            create: {
              jobId,
              proProfileId,
              assignedBy: operatorId,
              isManual: true,
            },
            update: {
              proProfileId,
              assignedBy: operatorId,
              isManual: true,
              assignedAt: new Date(),
            },
          });

          await tx.job.update({
            where: { id: jobId },
            data: {
              status: 'DISPATCHED',
              assignedProId: proProfileId,
            },
          });
          break;

        case EscalationOverrideAction.CANCEL:
          // Cancel the job
          newStatus = 'CANCELLED';
          message = 'Job cancelled from escalation';

          await tx.dispatchAttempt.updateMany({
            where: { jobId, status: 'PENDING' },
            data: { status: 'CANCELLED', respondedAt: new Date() },
          });

          await tx.job.update({
            where: { id: jobId },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
            },
          });
          break;

        case EscalationOverrideAction.ESCALATE_FURTHER:
          // Continue escalation to next level
          newStatus = job.status;
          message = 'Escalation continued to next level';
          // This would trigger the escalation service to move to next step
          // For now, just log the action
          break;

        default:
          throw new BadRequestException(`Unknown escalation action: ${step}`);
      }

      // Add internal note
      const existingNotes = job.internalNotes ? JSON.parse(job.internalNotes) : [];
      const newNote: InternalNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: `[Escalation Override: ${step}] ${reason || 'No reason provided'}`,
        authorId: operatorId,
        authorName: operatorName,
        createdAt: new Date().toISOString(),
      };

      await tx.job.update({
        where: { id: jobId },
        data: {
          internalNotes: JSON.stringify([...existingNotes, newNote]),
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: AUDIT_ACTIONS.OPERATOR_INTERVENTION,
          actorId: operatorId,
          actorType: ActorType.USER,
          targetType: 'Job',
          targetId: jobId,
          details: {
            action: step,
            reason: reason || null,
            proProfileId: proProfileId || null,
            previousStatus: job.status,
            newStatus,
          },
        },
      });
    });

    this.logger.log(`Escalation override: Job ${jobId}, action: ${step}, by operator ${operatorId}`);

    return {
      success: true,
      message: message!,
      newStatus: newStatus!,
    };
  }

  /**
   * Add internal note to job
   */
  async addInternalNote(
    jobId: string,
    operatorId: string,
    dto: InternalNoteDto,
  ): Promise<InternalNoteResponseDto> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    const operator = await this.prisma.user.findUnique({
      where: { id: operatorId },
      select: { firstName: true, lastName: true },
    });

    if (!operator) {
      throw new NotFoundException(`Operator with ID ${operatorId} not found`);
    }

    const operatorName = `${operator.firstName || ''} ${operator.lastName || ''}`.trim() || 'Operator';

    // Parse existing notes
    let existingNotes: InternalNote[] = [];
    if (job.internalNotes) {
      try {
        existingNotes = JSON.parse(job.internalNotes);
      } catch {
        existingNotes = [];
      }
    }

    // Create new note
    const newNote: InternalNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: dto.note,
      authorId: operatorId,
      authorName: operatorName,
      createdAt: new Date().toISOString(),
    };

    // Update job with new note
    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: {
          internalNotes: JSON.stringify([...existingNotes, newNote]),
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: AUDIT_ACTIONS.OPERATOR_NOTE_ADDED,
          actorId: operatorId,
          actorType: ActorType.USER,
          targetType: 'Job',
          targetId: jobId,
          details: {
            noteId: newNote.id,
            contentPreview: dto.note.substring(0, 100),
          },
        },
      });
    });

    this.logger.log(`Internal note added to job ${jobId} by operator ${operatorId}`);

    return {
      id: newNote.id,
      jobId,
      content: newNote.content,
      authorId: newNote.authorId,
      authorName: newNote.authorName,
      createdAt: new Date(newNote.createdAt),
    };
  }

  /**
   * Get internal notes for a job
   */
  async getInternalNotes(jobId: string): Promise<InternalNoteResponseDto[]> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, internalNotes: true },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    // Parse internal notes
    let notes: InternalNote[] = [];
    if (job.internalNotes) {
      try {
        notes = JSON.parse(job.internalNotes);
      } catch {
        notes = [];
      }
    }

    return notes.map((note) => ({
      id: note.id,
      jobId: job.id,
      content: note.content,
      authorId: note.authorId,
      authorName: note.authorName,
      createdAt: new Date(note.createdAt),
    }));
  }

  /**
   * Get jobs with SLA breaches
   */
  async getSlaBreachAlerts(): Promise<SlaBreachAlertDto[]> {
    const now = new Date();

    // Get all jobs with pending dispatch attempts past SLA deadline
    const jobs = await this.prisma.job.findMany({
      where: {
        status: { in: ['DISPATCHED', 'ACCEPTED', 'SCHEDULED'] },
        dispatchAttempts: {
          some: {
            status: 'PENDING',
            slaDeadline: { lt: now },
          },
        },
      },
      include: {
        serviceCategory: true,
        dispatchAttempts: {
          where: {
            status: 'PENDING',
            slaDeadline: { lt: now },
          },
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jobs.map((job) => {
      const breachedAttempt = job.dispatchAttempts[0];
      const breachDurationMs = now.getTime() - new Date(breachedAttempt.slaDeadline).getTime();
      const breachDurationMinutes = Math.floor(breachDurationMs / (1000 * 60));

      return {
        jobId: job.id,
        jobNumber: job.jobNumber,
        breachType: 'accept', // SLA type - could be extended
        breachDurationMinutes,
        contactName: job.contactName,
        serviceCategory: job.serviceCategory.name,
        status: job.status,
        dispatchAttemptCount: job.dispatchAttempts.length,
        createdAt: job.createdAt,
      };
    });
  }

  /**
   * Get jobs that have escalated (multiple dispatch attempts without acceptance)
   */
  async getEscalatedJobs(): Promise<EscalatedJobDto[]> {
    // Get jobs with more than 1 dispatch attempt where no attempt was accepted
    const jobs = await this.prisma.job.findMany({
      where: {
        status: { in: ['DISPATCHED'] },
        dispatchAttempts: {
          some: {},
        },
      },
      include: {
        serviceCategory: true,
        dispatchAttempts: {
          orderBy: { attemptNumber: 'desc' },
          include: {
            proProfile: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
            declineReason: true,
          },
        },
        dispatchAssignment: {
          include: {
            proProfile: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter to only include escalated jobs (multiple attempts, none accepted)
    const escalatedJobs = jobs.filter((job) => {
      const hasAccepted = job.dispatchAttempts.some((a) => a.status === 'ACCEPTED');
      return job.dispatchAttempts.length > 1 && !hasAccepted;
    });

    const now = new Date();

    return escalatedJobs.map((job) => {
      const lastAttempt = job.dispatchAttempts[0];
      const isSlaBreached = lastAttempt && new Date(lastAttempt.slaDeadline) < now && lastAttempt.status === 'PENDING';

      return {
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
        contactName: job.contactName,
        serviceCategory: job.serviceCategory.name,
        urgency: job.urgency,
        serviceCity: job.serviceCity,
        serviceProvince: job.serviceProvince,
        escalated: true,
        slaBreached: isSlaBreached,
        slaDeadline: lastAttempt?.slaDeadline,
        dispatchAttemptCount: job.dispatchAttempts.length,
        assignedProName: job.dispatchAssignment
          ? `${job.dispatchAssignment.proProfile.user.firstName || ''} ${job.dispatchAssignment.proProfile.user.lastName || ''}`.trim()
          : undefined,
        createdAt: job.createdAt,
        escalationStep: job.dispatchAttempts.length,
        escalationReason: lastAttempt?.declineReason?.label || lastAttempt?.declineNotes || 'Timeout',
        escalatedAt: lastAttempt?.dispatchedAt || job.createdAt,
        lastDispatchAttempt: lastAttempt
          ? {
              id: lastAttempt.id,
              proProfileId: lastAttempt.proProfileId,
              proName: `${lastAttempt.proProfile.user.firstName || ''} ${lastAttempt.proProfile.user.lastName || ''}`.trim(),
              attemptNumber: lastAttempt.attemptNumber,
              status: lastAttempt.status,
              declineReason: lastAttempt.declineReason?.label || lastAttempt.declineNotes,
              slaDeadline: lastAttempt.slaDeadline,
              dispatchedAt: lastAttempt.dispatchedAt,
              respondedAt: lastAttempt.respondedAt || undefined,
            }
          : undefined,
      };
    });
  }
}
