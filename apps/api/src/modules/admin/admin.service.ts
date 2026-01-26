import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '@trades/shared';
import { Prisma } from '@trades/prisma';
import {
  CreateDeclineReasonDto,
  UpdateDeclineReasonDto,
  DeclineReasonResponseDto,
  CreateJobTemplateDto,
  UpdateJobTemplateDto,
  JobTemplateResponseDto,
  DispatchLogQueryDto,
  DispatchLogResponseDto,
  PaginatedDispatchLogResponseDto,
  SlaBreachQueryDto,
  SlaBreachReportDto,
  SlaBreachItemDto,
  DashboardStatsDto,
} from './dto/admin.dto';
import { ActorType } from '../audit/dto/audit.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ============================================
  // DASHBOARD STATS
  // ============================================

  /**
   * Get platform dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStatsDto> {
    this.logger.debug('Fetching dashboard statistics');

    // Run all queries in parallel for performance
    const [
      jobStats,
      proStats,
      bookingStats,
      dispatchStats,
      userStats,
    ] = await Promise.all([
      this.getJobStats(),
      this.getProStats(),
      this.getBookingStats(),
      this.getDispatchStats(),
      this.getUserStats(),
    ]);

    return {
      jobs: jobStats,
      pros: proStats,
      bookings: bookingStats,
      dispatch: dispatchStats,
      users: userStats,
      generatedAt: new Date(),
    };
  }

  private async getJobStats() {
    const [
      total,
      draft,
      dispatched,
      accepted,
      scheduled,
      inProgress,
      completed,
      cancelled,
    ] = await Promise.all([
      this.prisma.job.count(),
      this.prisma.job.count({ where: { status: 'DRAFT' } }),
      this.prisma.job.count({ where: { status: 'DISPATCHED' } }),
      this.prisma.job.count({ where: { status: 'ACCEPTED' } }),
      this.prisma.job.count({ where: { status: 'SCHEDULED' } }),
      this.prisma.job.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.job.count({ where: { status: 'COMPLETED' } }),
      this.prisma.job.count({ where: { status: 'CANCELLED' } }),
    ]);

    return {
      total,
      draft,
      dispatched,
      accepted,
      scheduled,
      inProgress,
      completed,
      cancelled,
    };
  }

  private async getProStats() {
    const [total, verified, pending, denied, active] = await Promise.all([
      this.prisma.proProfile.count(),
      this.prisma.proProfile.count({ where: { verificationStatus: 'APPROVED' } }),
      this.prisma.proProfile.count({ where: { verificationStatus: 'PENDING' } }),
      this.prisma.proProfile.count({ where: { verificationStatus: 'DENIED' } }),
      this.prisma.proProfile.count({
        where: { verificationStatus: 'APPROVED', isActive: true },
      }),
    ]);

    return { total, verified, pending, denied, active };
  }

  private async getBookingStats() {
    const [
      total,
      pendingConfirmation,
      confirmed,
      completed,
      cancelled,
      noShow,
    ] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'PENDING_CONFIRMATION' } }),
      this.prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
      this.prisma.booking.count({ where: { status: 'CANCELLED' } }),
      this.prisma.booking.count({ where: { status: 'NO_SHOW' } }),
    ]);

    return {
      total,
      pendingConfirmation,
      confirmed,
      completed,
      cancelled,
      noShow,
    };
  }

  private async getDispatchStats() {
    const [totalAttempts, accepted, declined, timeout] = await Promise.all([
      this.prisma.dispatchAttempt.count(),
      this.prisma.dispatchAttempt.count({ where: { status: 'ACCEPTED' } }),
      this.prisma.dispatchAttempt.count({ where: { status: 'DECLINED' } }),
      this.prisma.dispatchAttempt.count({ where: { status: 'TIMEOUT' } }),
    ]);

    // Calculate rates
    const acceptedRate = totalAttempts > 0 ? (accepted / totalAttempts) * 100 : 0;
    const declinedRate = totalAttempts > 0 ? (declined / totalAttempts) * 100 : 0;
    const timeoutRate = totalAttempts > 0 ? (timeout / totalAttempts) * 100 : 0;

    // Calculate average response time for responded attempts
    const respondedAttempts = await this.prisma.dispatchAttempt.findMany({
      where: {
        respondedAt: { not: null },
      },
      select: {
        dispatchedAt: true,
        respondedAt: true,
      },
    });

    let avgResponseMinutes = 0;
    if (respondedAttempts.length > 0) {
      const totalMinutes = respondedAttempts.reduce((sum, attempt) => {
        const diffMs = attempt.respondedAt!.getTime() - attempt.dispatchedAt.getTime();
        return sum + diffMs / 60000; // Convert to minutes
      }, 0);
      avgResponseMinutes = totalMinutes / respondedAttempts.length;
    }

    return {
      totalAttempts,
      acceptedRate: Math.round(acceptedRate * 10) / 10,
      declinedRate: Math.round(declinedRate * 10) / 10,
      timeoutRate: Math.round(timeoutRate * 10) / 10,
      avgResponseMinutes: Math.round(avgResponseMinutes * 10) / 10,
    };
  }

  private async getUserStats() {
    const [totalUsers, smbUsers, proUsers, admins, operators] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'SMB_USER' } }),
      this.prisma.user.count({ where: { role: 'PRO_USER' } }),
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count({ where: { role: 'OPERATOR' } }),
    ]);

    return { totalUsers, smbUsers, proUsers, admins, operators };
  }

  // ============================================
  // DECLINE REASONS
  // ============================================

  /**
   * Get all decline reasons
   */
  async getDeclineReasons(): Promise<DeclineReasonResponseDto[]> {
    const reasons = await this.prisma.declineReason.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });

    return reasons;
  }

  /**
   * Create a new decline reason
   */
  async createDeclineReason(
    dto: CreateDeclineReasonDto,
    actorId?: string,
  ): Promise<DeclineReasonResponseDto> {
    // Check for duplicate code
    const existing = await this.prisma.declineReason.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`Decline reason with code '${dto.code}' already exists`);
    }

    const declineReason = await this.prisma.declineReason.create({
      data: {
        code: dto.code,
        label: dto.label,
        description: dto.description || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    // Log audit event
    await this.auditService.log({
      action: AUDIT_ACTIONS.DECLINE_REASON_CREATED,
      actorId,
      actorType: ActorType.USER,
      targetType: 'DeclineReason',
      targetId: declineReason.id,
      details: { code: dto.code, label: dto.label },
    });

    this.logger.log(`Created decline reason: ${dto.code}`);

    return declineReason;
  }

  /**
   * Update an existing decline reason
   */
  async updateDeclineReason(
    id: string,
    dto: UpdateDeclineReasonDto,
    actorId?: string,
  ): Promise<DeclineReasonResponseDto> {
    // Check if exists
    const existing = await this.prisma.declineReason.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Decline reason with ID '${id}' not found`);
    }

    const declineReason = await this.prisma.declineReason.update({
      where: { id },
      data: {
        label: dto.label,
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });

    // Log audit event
    await this.auditService.log({
      action: AUDIT_ACTIONS.DECLINE_REASON_UPDATED,
      actorId,
      actorType: ActorType.USER,
      targetType: 'DeclineReason',
      targetId: declineReason.id,
      details: { changes: dto },
    });

    this.logger.log(`Updated decline reason: ${existing.code}`);

    return declineReason;
  }

  /**
   * Delete a decline reason
   */
  async deleteDeclineReason(id: string, actorId?: string): Promise<void> {
    // Check if exists
    const existing = await this.prisma.declineReason.findUnique({
      where: { id },
      include: { _count: { select: { dispatchAttempts: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`Decline reason with ID '${id}' not found`);
    }

    // If in use, soft delete by setting isActive to false
    if (existing._count.dispatchAttempts > 0) {
      await this.prisma.declineReason.update({
        where: { id },
        data: { isActive: false },
      });
      this.logger.log(
        `Soft deleted decline reason ${existing.code} (in use by ${existing._count.dispatchAttempts} attempts)`,
      );
    } else {
      await this.prisma.declineReason.delete({ where: { id } });
      this.logger.log(`Deleted decline reason: ${existing.code}`);
    }

    // Log audit event (using DECLINE_REASON_UPDATED for soft delete tracking)
    await this.auditService.log({
      action: AUDIT_ACTIONS.DECLINE_REASON_UPDATED,
      actorId,
      actorType: ActorType.USER,
      targetType: 'DeclineReason',
      targetId: id,
      details: {
        action: 'deleted',
        code: existing.code,
        softDelete: existing._count.dispatchAttempts > 0,
      },
    });
  }

  // ============================================
  // JOB TEMPLATES
  // ============================================

  /**
   * Get all job templates
   */
  async getJobTemplates(): Promise<JobTemplateResponseDto[]> {
    const templates = await this.prisma.jobTemplate.findMany({
      orderBy: [{ name: 'asc' }],
    });

    return templates.map((t) => ({
      ...t,
      templateContent: t.templateContent as Record<string, unknown>,
    }));
  }

  /**
   * Create a new job template
   */
  async createJobTemplate(
    dto: CreateJobTemplateDto,
    actorId?: string,
  ): Promise<JobTemplateResponseDto> {
    const template = await this.prisma.jobTemplate.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        categoryCode: dto.categoryCode || null,
        templateContent: dto.templateContent as Prisma.InputJsonValue,
        estimatedDuration: dto.estimatedDuration || null,
        isActive: dto.isActive ?? true,
      },
    });

    // Log audit event
    await this.auditService.log({
      action: 'JOB_TEMPLATE_CREATED',
      actorId,
      actorType: ActorType.USER,
      targetType: 'JobTemplate',
      targetId: template.id,
      details: { name: dto.name, categoryCode: dto.categoryCode },
    });

    this.logger.log(`Created job template: ${dto.name}`);

    return {
      ...template,
      templateContent: template.templateContent as Record<string, unknown>,
    };
  }

  /**
   * Update an existing job template
   */
  async updateJobTemplate(
    id: string,
    dto: UpdateJobTemplateDto,
    actorId?: string,
  ): Promise<JobTemplateResponseDto> {
    // Check if exists
    const existing = await this.prisma.jobTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Job template with ID '${id}' not found`);
    }

    const template = await this.prisma.jobTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        categoryCode: dto.categoryCode,
        templateContent: dto.templateContent as Prisma.InputJsonValue,
        estimatedDuration: dto.estimatedDuration,
        isActive: dto.isActive,
      },
    });

    // Log audit event
    await this.auditService.log({
      action: 'JOB_TEMPLATE_UPDATED',
      actorId,
      actorType: ActorType.USER,
      targetType: 'JobTemplate',
      targetId: template.id,
      details: { changes: dto },
    });

    this.logger.log(`Updated job template: ${existing.name}`);

    return {
      ...template,
      templateContent: template.templateContent as Record<string, unknown>,
    };
  }

  /**
   * Delete a job template
   */
  async deleteJobTemplate(id: string, actorId?: string): Promise<void> {
    // Check if exists
    const existing = await this.prisma.jobTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Job template with ID '${id}' not found`);
    }

    await this.prisma.jobTemplate.delete({ where: { id } });

    // Log audit event
    await this.auditService.log({
      action: 'JOB_TEMPLATE_DELETED',
      actorId,
      actorType: ActorType.USER,
      targetType: 'JobTemplate',
      targetId: id,
      details: { name: existing.name },
    });

    this.logger.log(`Deleted job template: ${existing.name}`);
  }

  // ============================================
  // DISPATCH LOGS
  // ============================================

  /**
   * Get dispatch attempt logs with filters and pagination
   */
  async getDispatchLogs(
    query: DispatchLogQueryDto,
  ): Promise<PaginatedDispatchLogResponseDto> {
    const {
      jobId,
      proProfileId,
      status,
      declineReasonId,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 20,
      sortBy = 'dispatchedAt',
      sortOrder = 'desc',
    } = query;

    // Build where clause
    const where: Prisma.DispatchAttemptWhereInput = {};

    if (jobId) {
      where.jobId = jobId;
    }

    if (proProfileId) {
      where.proProfileId = proProfileId;
    }

    if (status) {
      where.status = status as Prisma.EnumDispatchAttemptStatusFilter;
    }

    if (declineReasonId) {
      where.declineReasonId = declineReasonId;
    }

    if (dateFrom || dateTo) {
      where.dispatchedAt = {};
      if (dateFrom) {
        where.dispatchedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.dispatchedAt.lte = new Date(dateTo);
      }
    }

    // Build order by clause
    const validSortFields = [
      'dispatchedAt',
      'respondedAt',
      'attemptNumber',
      'status',
      'createdAt',
    ] as const;
    const sortField = validSortFields.includes(sortBy as typeof validSortFields[number])
      ? sortBy as typeof validSortFields[number]
      : 'dispatchedAt';
    const orderBy: Prisma.DispatchAttemptOrderByWithRelationInput = {
      [sortField]: sortOrder === 'asc' ? 'asc' : 'desc',
    };

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Execute query with count
    const [dispatchLogs, total] = await Promise.all([
      this.prisma.dispatchAttempt.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          job: {
            select: {
              id: true,
              jobNumber: true,
              title: true,
              status: true,
            },
          },
          proProfile: {
            select: {
              id: true,
              businessName: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          declineReason: {
            select: {
              id: true,
              code: true,
              label: true,
            },
          },
        },
      }),
      this.prisma.dispatchAttempt.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: dispatchLogs.map((log) => this.mapToDispatchLogResponse(log)),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  private mapToDispatchLogResponse(
    log: Prisma.DispatchAttemptGetPayload<{
      include: {
        job: {
          select: {
            id: true;
            jobNumber: true;
            title: true;
            status: true;
          };
        };
        proProfile: {
          select: {
            id: true;
            businessName: true;
            user: {
              select: {
                id: true;
                firstName: true;
                lastName: true;
              };
            };
          };
        };
        declineReason: {
          select: {
            id: true;
            code: true;
            label: true;
          };
        };
      };
    }>,
  ): DispatchLogResponseDto {
    return {
      id: log.id,
      jobId: log.jobId,
      proProfileId: log.proProfileId,
      attemptNumber: log.attemptNumber,
      status: log.status,
      declineReasonId: log.declineReasonId,
      declineNotes: log.declineNotes,
      dispatchedAt: log.dispatchedAt,
      respondedAt: log.respondedAt,
      slaDeadline: log.slaDeadline,
      ranking: log.ranking,
      distance: log.distance,
      createdAt: log.createdAt,
      job: log.job,
      proProfile: log.proProfile,
      declineReason: log.declineReason,
    };
  }

  // ============================================
  // SLA BREACH REPORT
  // ============================================

  /**
   * Get SLA breach report for date range
   */
  async getSlaBreaches(query: SlaBreachQueryDto): Promise<SlaBreachReportDto> {
    const { dateFrom, dateTo, serviceCategoryId, regionId } = query;

    const dateFromObj = new Date(dateFrom);
    const dateToObj = new Date(dateTo);

    // Build where clause for dispatch attempts that breached SLA
    const where: Prisma.DispatchAttemptWhereInput = {
      dispatchedAt: {
        gte: dateFromObj,
        lte: dateToObj,
      },
      OR: [
        // Timeout status means SLA was breached
        { status: 'TIMEOUT' },
        // Or responded after deadline
        {
          respondedAt: { not: null },
          // This requires custom logic to check if respondedAt > slaDeadline
        },
      ],
    };

    // Add service category filter if provided
    if (serviceCategoryId) {
      where.job = {
        serviceCategoryId,
      };
    }

    // Add region filter if provided
    if (regionId) {
      where.proProfile = {
        regionId,
      };
    }

    // Get total attempts in period
    const totalAttemptsWhere: Prisma.DispatchAttemptWhereInput = {
      dispatchedAt: {
        gte: dateFromObj,
        lte: dateToObj,
      },
    };
    if (serviceCategoryId) {
      totalAttemptsWhere.job = { serviceCategoryId };
    }
    if (regionId) {
      totalAttemptsWhere.proProfile = { regionId };
    }

    const totalDispatchAttempts = await this.prisma.dispatchAttempt.count({
      where: totalAttemptsWhere,
    });

    // Get all potential breaches (timeout or late response)
    const potentialBreaches = await this.prisma.dispatchAttempt.findMany({
      where: {
        dispatchedAt: {
          gte: dateFromObj,
          lte: dateToObj,
        },
        ...(serviceCategoryId && { job: { serviceCategoryId } }),
        ...(regionId && { proProfile: { regionId } }),
      },
      include: {
        job: {
          select: {
            id: true,
            jobNumber: true,
          },
        },
        proProfile: {
          select: {
            id: true,
            businessName: true,
          },
        },
      },
    });

    // Filter to actual breaches and calculate breach details
    const breaches: SlaBreachItemDto[] = [];

    for (const attempt of potentialBreaches) {
      let isBreached = false;
      let breachMinutes = 0;

      if (attempt.status === 'TIMEOUT') {
        isBreached = true;
        // Calculate breach from deadline to now or when status changed
        const endTime = attempt.respondedAt || new Date();
        breachMinutes = Math.round(
          (endTime.getTime() - attempt.slaDeadline.getTime()) / 60000,
        );
      } else if (
        attempt.respondedAt &&
        attempt.respondedAt > attempt.slaDeadline
      ) {
        isBreached = true;
        breachMinutes = Math.round(
          (attempt.respondedAt.getTime() - attempt.slaDeadline.getTime()) / 60000,
        );
      }

      if (isBreached && breachMinutes > 0) {
        breaches.push({
          id: attempt.id,
          jobId: attempt.jobId,
          jobNumber: attempt.job.jobNumber,
          proProfileId: attempt.proProfileId,
          proBusinessName: attempt.proProfile.businessName,
          dispatchedAt: attempt.dispatchedAt,
          slaDeadline: attempt.slaDeadline,
          respondedAt: attempt.respondedAt,
          breachMinutes,
          status: attempt.status,
        });
      }
    }

    // Calculate statistics
    const totalBreaches = breaches.length;
    const breachRate =
      totalDispatchAttempts > 0
        ? (totalBreaches / totalDispatchAttempts) * 100
        : 0;
    const avgBreachMinutes =
      totalBreaches > 0
        ? breaches.reduce((sum, b) => sum + b.breachMinutes, 0) / totalBreaches
        : 0;

    return {
      dateFrom: dateFromObj,
      dateTo: dateToObj,
      totalDispatchAttempts,
      totalBreaches,
      breachRate: Math.round(breachRate * 100) / 100,
      avgBreachMinutes: Math.round(avgBreachMinutes * 10) / 10,
      breaches: breaches.sort((a, b) => b.breachMinutes - a.breachMinutes),
    };
  }
}
