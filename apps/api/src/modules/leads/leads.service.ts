import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActorType } from '../audit/dto/audit.dto';
import {
  LeadNormalizationService,
  NormalizedLead,
} from './lead-normalization.service';
import {
  WebLeadDto,
  WebhookLeadDto,
  EmailLeadDto,
  LeadQueryDto,
  ConvertLeadDto,
  LeadNormalizedResponseDto,
  LeadSubmitResponseDto,
  LeadConvertResponseDto,
  PaginatedLeadsResponseDto,
} from './dto/leads.dto';
import { LeadSource, LeadStatus, generateJobNumber } from '@trades/shared';
import { Prisma } from '@trades/prisma';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly normalizationService: LeadNormalizationService,
  ) {}

  /**
   * Handle web form lead submission
   */
  async submitWebLead(
    dto: WebLeadDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LeadSubmitResponseDto> {
    this.logger.log('Processing web form lead submission');

    // Store raw lead
    const rawLead = await this.prisma.leadRaw.create({
      data: {
        source: LeadSource.WEB_FORM,
        rawPayload: dto as unknown as Prisma.InputJsonValue,
        ipAddress,
        userAgent,
        receivedAt: new Date(),
      },
    });

    // Process immediately for web form leads
    const normalizedLead = await this.processLead(rawLead.id);

    await this.auditService.log({
      action: 'LEAD_SUBMITTED',
      actorType: ActorType.SYSTEM,
      targetType: 'LeadRaw',
      targetId: rawLead.id,
      details: {
        source: LeadSource.WEB_FORM,
        status: normalizedLead.status,
      },
      ipAddress,
      userAgent,
    });

    return {
      id: rawLead.id,
      message: 'Lead submitted successfully',
      normalizedLeadId: normalizedLead.id,
    };
  }

  /**
   * Handle webhook lead submission
   */
  async submitWebhookLead(
    dto: WebhookLeadDto,
    sourceIdentifier: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LeadSubmitResponseDto> {
    this.logger.log(`Processing webhook lead from source: ${sourceIdentifier}`);

    // Merge source identifier into payload for normalization
    const enrichedPayload = {
      ...dto.payload,
      webhookSource: sourceIdentifier,
    };

    // Store raw lead
    const rawLead = await this.prisma.leadRaw.create({
      data: {
        source: LeadSource.WEBHOOK,
        rawPayload: enrichedPayload as Prisma.InputJsonValue,
        ipAddress,
        userAgent,
        receivedAt: new Date(),
      },
    });

    // Process immediately
    const normalizedLead = await this.processLead(rawLead.id);

    await this.auditService.log({
      action: 'LEAD_SUBMITTED',
      actorType: ActorType.SYSTEM,
      targetType: 'LeadRaw',
      targetId: rawLead.id,
      details: {
        source: LeadSource.WEBHOOK,
        webhookSource: sourceIdentifier,
        status: normalizedLead.status,
      },
      ipAddress,
      userAgent,
    });

    return {
      id: rawLead.id,
      message: 'Webhook lead received successfully',
      normalizedLeadId: normalizedLead.id,
    };
  }

  /**
   * Handle email webhook lead submission (stub for future implementation)
   */
  async submitEmailLead(
    dto: EmailLeadDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LeadSubmitResponseDto> {
    this.logger.log('Processing email lead submission (stub)');

    // Store raw lead for later processing
    const rawLead = await this.prisma.leadRaw.create({
      data: {
        source: LeadSource.EMAIL,
        rawPayload: dto.payload as Prisma.InputJsonValue,
        ipAddress,
        userAgent,
        receivedAt: new Date(),
      },
    });

    // Note: Email leads may require async processing due to parsing complexity
    // For now, attempt immediate processing
    try {
      const normalizedLead = await this.processLead(rawLead.id);

      await this.auditService.log({
        action: 'LEAD_SUBMITTED',
        actorType: ActorType.SYSTEM,
        targetType: 'LeadRaw',
        targetId: rawLead.id,
        details: {
          source: LeadSource.EMAIL,
          status: normalizedLead.status,
        },
        ipAddress,
        userAgent,
      });

      return {
        id: rawLead.id,
        message: 'Email lead received and processed',
        normalizedLeadId: normalizedLead.id,
      };
    } catch (error) {
      this.logger.warn(`Email lead processing deferred: ${error.message}`);

      await this.auditService.log({
        action: 'LEAD_SUBMITTED',
        actorType: ActorType.SYSTEM,
        targetType: 'LeadRaw',
        targetId: rawLead.id,
        details: {
          source: LeadSource.EMAIL,
          status: 'PENDING_PROCESSING',
          error: error.message,
        },
        ipAddress,
        userAgent,
      });

      return {
        id: rawLead.id,
        message: 'Email lead received and queued for processing',
      };
    }
  }

  /**
   * Process a raw lead: normalize, validate, and check for duplicates
   */
  async processLead(leadRawId: string): Promise<LeadNormalizedResponseDto> {
    this.logger.debug(`Processing raw lead: ${leadRawId}`);

    // Fetch raw lead
    const rawLead = await this.prisma.leadRaw.findUnique({
      where: { id: leadRawId },
    });

    if (!rawLead) {
      throw new NotFoundException(`Raw lead not found: ${leadRawId}`);
    }

    // Check if already processed
    const existingNormalized = await this.prisma.leadNormalized.findUnique({
      where: { leadRawId },
    });

    if (existingNormalized) {
      this.logger.debug(`Lead already processed: ${existingNormalized.id}`);
      return this.mapToNormalizedResponse(existingNormalized);
    }

    // Normalize the raw payload
    const normalized = this.normalizationService.normalize(
      rawLead.rawPayload as Record<string, unknown>,
      rawLead.source as LeadSource,
    );

    // Validate normalized data
    const validationResult = this.normalizationService.validate(normalized);

    if (!validationResult.isValid) {
      // Create normalized lead with INVALID status
      const invalidLead = await this.prisma.leadNormalized.create({
        data: {
          leadRaw: { connect: { id: leadRawId } },
          status: LeadStatus.INVALID,
          ...this.mapNormalizedToData(normalized),
        },
      });

      // Update raw lead processedAt
      await this.prisma.leadRaw.update({
        where: { id: leadRawId },
        data: { processedAt: new Date() },
      });

      await this.auditService.log({
        action: 'LEAD_INVALID',
        actorType: ActorType.SYSTEM,
        targetType: 'LeadNormalized',
        targetId: invalidLead.id,
        details: {
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        },
      });

      return this.mapToNormalizedResponse(invalidLead);
    }

    // Check for duplicates
    const duplicateCheck =
      await this.normalizationService.detectDuplicate(normalized);

    let status: LeadStatus = LeadStatus.NORMALIZED;
    let duplicateOfId: string | undefined;

    if (duplicateCheck.isDuplicate) {
      status = LeadStatus.DUPLICATE;
      duplicateOfId = duplicateCheck.duplicateOfId;
      this.logger.debug(`Lead marked as duplicate of: ${duplicateOfId}`);
    }

    // Create normalized lead
    const normalizedLead = await this.prisma.leadNormalized.create({
      data: {
        leadRaw: { connect: { id: leadRawId } },
        status,
        fingerprint: duplicateCheck.fingerprint || null,
        duplicateOfId: duplicateOfId || null,
        ...this.mapNormalizedToData(normalized),
      },
    });

    // Update raw lead processedAt
    await this.prisma.leadRaw.update({
      where: { id: leadRawId },
      data: { processedAt: new Date() },
    });

    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      this.logger.debug(
        `Lead ${normalizedLead.id} warnings: ${validationResult.warnings.join(', ')}`,
      );
    }

    await this.auditService.log({
      action: status === LeadStatus.DUPLICATE ? 'LEAD_DUPLICATE' : 'LEAD_NORMALIZED',
      actorType: ActorType.SYSTEM,
      targetType: 'LeadNormalized',
      targetId: normalizedLead.id,
      details: {
        status,
        duplicateOfId,
        warnings: validationResult.warnings,
      },
    });

    return this.mapToNormalizedResponse(normalizedLead);
  }

  /**
   * Convert a normalized lead to a job
   */
  async convertToJob(
    leadNormalizedId: string,
    userId: string,
    dto?: ConvertLeadDto,
  ): Promise<LeadConvertResponseDto> {
    this.logger.log(`Converting lead to job: ${leadNormalizedId}`);

    // Fetch normalized lead
    const lead = await this.prisma.leadNormalized.findUnique({
      where: { id: leadNormalizedId },
    });

    if (!lead) {
      throw new NotFoundException(`Normalized lead not found: ${leadNormalizedId}`);
    }

    // Check if already converted
    if (lead.convertedToJobId) {
      throw new ConflictException(
        `Lead already converted to job: ${lead.convertedToJobId}`,
      );
    }

    // Check status
    if (lead.status === LeadStatus.INVALID) {
      throw new BadRequestException('Cannot convert an invalid lead');
    }

    if (lead.status === LeadStatus.DUPLICATE) {
      throw new BadRequestException(
        'Cannot convert a duplicate lead. Convert the original lead instead.',
      );
    }

    // Resolve service category
    let serviceCategoryId = dto?.serviceCategoryId;
    if (!serviceCategoryId && lead.serviceCategory) {
      // Try to find service category by code
      const category = await this.prisma.serviceCategory.findFirst({
        where: {
          code: lead.serviceCategory,
          isActive: true,
        },
      });
      serviceCategoryId = category?.id;
    }

    if (!serviceCategoryId) {
      throw new BadRequestException(
        'Service category is required. Please specify a serviceCategoryId.',
      );
    }

    // Parse service address components if full address exists
    const addressParts = this.parseServiceAddress(lead.serviceAddress);

    // Generate job number
    const jobNumber = generateJobNumber();

    // Create job in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the job
      const job = await tx.job.create({
        data: {
          jobNumber,
          createdById: userId,
          serviceCategoryId,
          status: 'DRAFT',
          contactName: lead.contactName || 'Unknown',
          contactEmail: lead.contactEmail,
          contactPhone: lead.contactPhone || '',
          businessName: lead.businessName,
          serviceAddressLine1: addressParts.line1 || lead.serviceAddress || '',
          serviceAddressLine2: addressParts.line2,
          serviceCity: addressParts.city || '',
          serviceProvince: addressParts.province || '',
          servicePostalCode: addressParts.postalCode || '',
          serviceCountry: 'CA',
          serviceLat: lead.serviceLat,
          serviceLng: lead.serviceLng,
          title: dto?.title,
          description: lead.description || '',
          preferredDateStart: lead.preferredDateStart,
          preferredDateEnd: lead.preferredDateEnd,
          urgency: lead.urgency || 'NORMAL',
          internalNotes: dto?.internalNotes,
        },
      });

      // Update lead with conversion info
      await tx.leadNormalized.update({
        where: { id: leadNormalizedId },
        data: {
          status: LeadStatus.CONVERTED,
          convertedToJobId: job.id,
          convertedAt: new Date(),
        },
      });

      return job;
    });

    await this.auditService.log({
      action: 'LEAD_CONVERTED',
      actorId: userId,
      actorType: ActorType.USER,
      targetType: 'LeadNormalized',
      targetId: leadNormalizedId,
      details: {
        jobId: result.id,
        jobNumber: result.jobNumber,
      },
    });

    return {
      leadId: leadNormalizedId,
      jobId: result.id,
      jobNumber: result.jobNumber,
      message: 'Lead successfully converted to job',
    };
  }

  /**
   * Get a lead by ID
   */
  async getLead(id: string): Promise<LeadNormalizedResponseDto> {
    const lead = await this.prisma.leadNormalized.findUnique({
      where: { id },
      include: {
        leadRaw: true,
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead not found: ${id}`);
    }

    return this.mapToNormalizedResponse(lead);
  }

  /**
   * Query leads with filters and pagination
   */
  async getLeads(query: LeadQueryDto): Promise<PaginatedLeadsResponseDto> {
    const {
      status,
      source,
      serviceCategory,
      contactEmail,
      contactPhone,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Build where clause
    const where: Prisma.LeadNormalizedWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (source) {
      where.leadRaw = {
        source,
      };
    }

    if (serviceCategory) {
      where.serviceCategory = serviceCategory;
    }

    if (contactEmail) {
      where.contactEmail = {
        contains: contactEmail,
        mode: 'insensitive',
      };
    }

    if (contactPhone) {
      where.contactPhone = {
        contains: contactPhone.replace(/\D/g, ''),
      };
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

    // Build order by
    const validSortFields = [
      'createdAt',
      'updatedAt',
      'status',
      'contactName',
      'serviceCategory',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: Prisma.LeadNormalizedOrderByWithRelationInput = {
      [sortField]: sortOrder === 'asc' ? 'asc' : 'desc',
    };

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Execute query with count
    const [leads, total] = await Promise.all([
      this.prisma.leadNormalized.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          leadRaw: true,
        },
      }),
      this.prisma.leadNormalized.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: leads.map((lead) => this.mapToNormalizedResponse(lead)),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get leads by status
   */
  async getLeadsByStatus(status: LeadStatus): Promise<LeadNormalizedResponseDto[]> {
    const leads = await this.prisma.leadNormalized.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: {
        leadRaw: true,
      },
    });

    return leads.map((lead) => this.mapToNormalizedResponse(lead));
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private mapNormalizedToData(normalized: NormalizedLead): Prisma.LeadNormalizedCreateInput {
    return {
      contactName: normalized.contactName,
      contactEmail: normalized.contactEmail,
      contactPhone: normalized.contactPhone,
      businessName: normalized.businessName,
      serviceAddress: normalized.serviceAddress,
      serviceLat: normalized.serviceLat,
      serviceLng: normalized.serviceLng,
      serviceCategory: normalized.serviceCategory,
      description: normalized.description,
      preferredDateStart: normalized.preferredDateStart,
      preferredDateEnd: normalized.preferredDateEnd,
      urgency: normalized.urgency,
    };
  }

  private mapToNormalizedResponse(
    lead: Prisma.LeadNormalizedGetPayload<{ include?: { leadRaw?: boolean } }>,
  ): LeadNormalizedResponseDto {
    return {
      id: lead.id,
      leadRawId: lead.leadRawId,
      status: lead.status as LeadStatus,
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone,
      businessName: lead.businessName,
      serviceAddress: lead.serviceAddress,
      serviceLat: lead.serviceLat,
      serviceLng: lead.serviceLng,
      serviceCategory: lead.serviceCategory,
      description: lead.description,
      preferredDateStart: lead.preferredDateStart,
      preferredDateEnd: lead.preferredDateEnd,
      urgency: lead.urgency,
      fingerprint: lead.fingerprint,
      duplicateOfId: lead.duplicateOfId,
      convertedToJobId: lead.convertedToJobId,
      convertedAt: lead.convertedAt,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      leadRaw: (lead as any).leadRaw
        ? {
            id: (lead as any).leadRaw.id,
            source: (lead as any).leadRaw.source as LeadSource,
            rawPayload: (lead as any).leadRaw.rawPayload as Record<string, unknown>,
            ipAddress: (lead as any).leadRaw.ipAddress,
            userAgent: (lead as any).leadRaw.userAgent,
            receivedAt: (lead as any).leadRaw.receivedAt,
            processedAt: (lead as any).leadRaw.processedAt,
            createdAt: (lead as any).leadRaw.createdAt,
          }
        : null,
    };
  }

  private parseServiceAddress(address?: string | null): {
    line1?: string;
    line2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  } {
    if (!address) {
      return {};
    }

    // Simple parsing - this could be enhanced with a proper address parser
    const parts = address.split(',').map((p) => p.trim());

    if (parts.length === 0) {
      return { line1: address };
    }

    // Try to extract postal code (Canadian format: A1A 1A1)
    const postalCodeMatch = address.match(/[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d/);
    const postalCode = postalCodeMatch ? postalCodeMatch[0] : undefined;

    // Try to extract province (2-letter code)
    const provinceMatch = address.match(
      /\b(ON|QC|BC|AB|MB|SK|NS|NB|NL|PE|NT|YT|NU)\b/i,
    );
    const province = provinceMatch ? provinceMatch[0].toUpperCase() : undefined;

    return {
      line1: parts[0],
      line2: parts.length > 3 ? parts[1] : undefined,
      city: parts.length > 2 ? parts[parts.length - 3] : parts[1],
      province,
      postalCode,
    };
  }
}
