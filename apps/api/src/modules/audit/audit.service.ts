import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { maskPII, maskSensitiveData } from '@trades/shared';
import {
  CreateAuditLogDto,
  AuditLogQueryDto,
  AuditLogResponseDto,
  PaginatedAuditLogResponseDto,
} from './dto/audit.dto';
import { Prisma } from '@trades/prisma';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry with PII masking applied to details
   */
  async log(logEntry: CreateAuditLogDto): Promise<AuditLogResponseDto> {
    try {
      // Apply PII masking to details if present
      let maskedDetails: Record<string, unknown> | null = null;
      if (logEntry.details) {
        // First mask sensitive data fields (passwords, tokens, etc.)
        maskedDetails = maskSensitiveData(logEntry.details);

        // Then mask any PII in string values (emails, phone numbers)
        maskedDetails = this.maskPIIInObject(maskedDetails);
      }

      const auditLog = await this.prisma.auditLog.create({
        data: {
          action: logEntry.action,
          actorId: logEntry.actorId || null,
          actorType: logEntry.actorType || null,
          targetType: logEntry.targetType || null,
          targetId: logEntry.targetId || null,
          details: maskedDetails as Prisma.InputJsonValue,
          ipAddress: logEntry.ipAddress || null,
          userAgent: logEntry.userAgent || null,
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
      });

      this.logger.debug(
        `Audit log created: ${logEntry.action} by ${logEntry.actorType || 'UNKNOWN'}:${logEntry.actorId || 'N/A'}`,
      );

      return this.mapToResponseDto(auditLog);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Query audit logs with filters and pagination
   */
  async getAuditLogs(query: AuditLogQueryDto): Promise<PaginatedAuditLogResponseDto> {
    const {
      action,
      actorId,
      targetType,
      targetId,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Build where clause
    const where: Prisma.AuditLogWhereInput = {};

    if (action) {
      where.action = action;
    }

    if (actorId) {
      where.actorId = actorId;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    if (targetId) {
      where.targetId = targetId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Build order by clause
    const orderBy: Prisma.AuditLogOrderByWithRelationInput = {};
    const validSortFields = ['createdAt', 'action', 'actorId', 'targetType'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    orderBy[sortField] = sortOrder === 'asc' ? 'asc' : 'desc';

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Execute query with count
    const [auditLogs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy,
        skip,
        take,
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
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: auditLogs.map((log) => this.mapToResponseDto(log)),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get audit logs for a specific entity
   */
  async getAuditLogsByTarget(
    targetType: string,
    targetId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedAuditLogResponseDto> {
    return this.getAuditLogs({
      targetType,
      targetId,
      page,
      pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  /**
   * Get audit logs by actor
   */
  async getAuditLogsByActor(
    actorId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedAuditLogResponseDto> {
    return this.getAuditLogs({
      actorId,
      page,
      pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  /**
   * Get a single audit log by ID
   */
  async getAuditLogById(id: string): Promise<AuditLogResponseDto> {
    const auditLog = await this.prisma.auditLog.findUnique({
      where: { id },
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
    });

    if (!auditLog) {
      throw new NotFoundException(`Audit log with ID ${id} not found`);
    }

    return this.mapToResponseDto(auditLog);
  }

  /**
   * Recursively mask PII in object values
   */
  private maskPIIInObject(obj: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        masked[key] = maskPII(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        masked[key] = this.maskPIIInObject(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        masked[key] = value.map((item) => {
          if (typeof item === 'string') {
            return maskPII(item);
          } else if (typeof item === 'object' && item !== null) {
            return this.maskPIIInObject(item as Record<string, unknown>);
          }
          return item;
        });
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  /**
   * Map Prisma AuditLog to response DTO
   */
  private mapToResponseDto(
    auditLog: Prisma.AuditLogGetPayload<{
      include: {
        actor: {
          select: {
            id: true;
            email: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    }>,
  ): AuditLogResponseDto {
    return {
      id: auditLog.id,
      action: auditLog.action,
      actorId: auditLog.actorId,
      actorType: auditLog.actorType,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      details: auditLog.details as Record<string, unknown> | null,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      createdAt: auditLog.createdAt,
      actor: auditLog.actor
        ? {
            id: auditLog.actor.id,
            email: maskPII(auditLog.actor.email),
            firstName: auditLog.actor.firstName,
            lastName: auditLog.actor.lastName,
          }
        : null,
    };
  }
}
