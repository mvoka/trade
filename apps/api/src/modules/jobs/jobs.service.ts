import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { ActorType } from '../audit/dto/audit.dto';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import {
  generateJobNumber,
  AttachmentType,
  FEATURE_FLAGS,
  AUDIT_ACTIONS,
  FILE_UPLOAD,
} from '@trades/shared';
import {
  CreateJobDto,
  UpdateJobDto,
  CreateAttachmentDto,
  JobQueryDto,
  PresignedUrlRequestDto,
} from './dto/jobs.dto';
import { Prisma, Job, JobAttachment } from '@trades/prisma';

export interface JobWithRelations extends Job {
  serviceCategory?: {
    id: string;
    name: string;
    code: string;
  };
  createdBy?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  attachments?: JobAttachment[];
  dispatchAssignment?: {
    id: string;
    proProfileId: string;
    proProfile?: {
      id: string;
      businessName: string | null;
      user: {
        firstName: string | null;
        lastName: string | null;
      };
    };
  };
  bookings?: {
    id: string;
    status: string;
    slotStart: Date | null;
    slotEnd: Date | null;
  }[];
}

export interface PaginatedJobs {
  jobs: JobWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  /**
   * Create a new job
   */
  async createJob(userId: string, dto: CreateJobDto): Promise<JobWithRelations> {
    this.logger.log(`Creating job for user ${userId}`);

    // Validate service category exists
    const serviceCategory = await this.prisma.serviceCategory.findUnique({
      where: { id: dto.serviceCategoryId },
    });

    if (!serviceCategory) {
      throw new BadRequestException('Invalid service category');
    }

    // Check if before photos are required
    const requireBeforePhotos = await this.featureFlagsService.isEnabled(
      FEATURE_FLAGS.REQUIRE_BEFORE_PHOTOS,
      {
        serviceCategoryId: dto.serviceCategoryId,
      },
    );

    if (requireBeforePhotos) {
      if (!dto.beforePhotoKeys || dto.beforePhotoKeys.length < FILE_UPLOAD.MIN_BEFORE_PHOTOS) {
        throw new BadRequestException(
          `At least ${FILE_UPLOAD.MIN_BEFORE_PHOTOS} before photo(s) required`,
        );
      }
      if (dto.beforePhotoKeys.length > FILE_UPLOAD.MAX_BEFORE_PHOTOS) {
        throw new BadRequestException(
          `Maximum ${FILE_UPLOAD.MAX_BEFORE_PHOTOS} before photos allowed`,
        );
      }
    }

    // Generate unique job number
    const jobNumber = generateJobNumber();

    // Create job in transaction
    const job = await this.prisma.$transaction(async (tx) => {
      // Create the job
      const newJob = await tx.job.create({
        data: {
          jobNumber,
          createdById: userId,
          serviceCategoryId: dto.serviceCategoryId,
          contactName: dto.contactName,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          businessName: dto.businessName,
          serviceAddressLine1: dto.serviceAddressLine1,
          serviceAddressLine2: dto.serviceAddressLine2,
          serviceCity: dto.serviceCity,
          serviceProvince: dto.serviceProvince,
          servicePostalCode: dto.servicePostalCode,
          serviceCountry: dto.serviceCountry || 'CA',
          serviceLat: dto.serviceLat,
          serviceLng: dto.serviceLng,
          title: dto.title,
          description: dto.description,
          preferredDateStart: dto.preferredDateStart
            ? new Date(dto.preferredDateStart)
            : undefined,
          preferredDateEnd: dto.preferredDateEnd ? new Date(dto.preferredDateEnd) : undefined,
          urgency: dto.urgency || 'NORMAL',
          estimatedDuration: dto.estimatedDuration,
          internalNotes: dto.internalNotes,
          status: 'DRAFT',
        },
        include: {
          serviceCategory: {
            select: { id: true, name: true, code: true },
          },
          createdBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });

      // Create before photo attachments if provided
      if (dto.beforePhotoKeys && dto.beforePhotoKeys.length > 0) {
        await tx.jobAttachment.createMany({
          data: dto.beforePhotoKeys.map((key) => ({
            jobId: newJob.id,
            type: 'BEFORE_PHOTO' as const,
            fileName: key.split('/').pop() || key,
            fileUrl: this.storageService.getPublicUrl(key),
            uploadedById: userId,
          })),
        });
      }

      return newJob;
    });

    // Log audit event
    await this.auditService.log({
      action: AUDIT_ACTIONS.JOB_CREATED,
      actorId: userId,
      actorType: ActorType.USER,
      targetType: 'Job',
      targetId: job.id,
      details: {
        jobNumber: job.jobNumber,
        serviceCategoryId: dto.serviceCategoryId,
        urgency: dto.urgency,
      },
    });

    // Return job with attachments
    return this.getJob(job.id);
  }

  /**
   * Get a job by ID with all relations
   */
  async getJob(id: string): Promise<JobWithRelations> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        serviceCategory: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        attachments: {
          orderBy: { uploadedAt: 'desc' },
        },
        dispatchAssignment: {
          include: {
            proProfile: {
              select: {
                id: true,
                businessName: true,
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        bookings: {
          select: {
            id: true,
            status: true,
            slotStart: true,
            slotEnd: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        pipelineStage: true,
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job as JobWithRelations;
  }

  /**
   * Get a job by job number
   */
  async getJobByNumber(jobNumber: string): Promise<JobWithRelations> {
    const job = await this.prisma.job.findUnique({
      where: { jobNumber },
      include: {
        serviceCategory: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        attachments: {
          orderBy: { uploadedAt: 'desc' },
        },
        dispatchAssignment: {
          include: {
            proProfile: {
              select: {
                id: true,
                businessName: true,
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
      throw new NotFoundException(`Job with number ${jobNumber} not found`);
    }

    return job as JobWithRelations;
  }

  /**
   * Get jobs created by a user (SMB)
   */
  async getJobsByUser(userId: string, filters: JobQueryDto): Promise<PaginatedJobs> {
    const where = this.buildWhereClause(filters);
    where.createdById = userId;

    return this.getPaginatedJobs(where, filters);
  }

  /**
   * Get jobs assigned to a pro
   */
  async getJobsByPro(proProfileId: string, filters: JobQueryDto): Promise<PaginatedJobs> {
    const where = this.buildWhereClause(filters);
    where.dispatchAssignment = {
      proProfileId,
    };

    return this.getPaginatedJobs(where, filters);
  }

  /**
   * Get all jobs (for operators/admins)
   */
  async getAllJobs(filters: JobQueryDto): Promise<PaginatedJobs> {
    const where = this.buildWhereClause(filters);
    return this.getPaginatedJobs(where, filters);
  }

  /**
   * Update a job
   */
  async updateJob(
    id: string,
    dto: UpdateJobDto,
    userId: string,
  ): Promise<JobWithRelations> {
    const existingJob = await this.getJob(id);

    // Validate service category if being updated
    if (dto.serviceCategoryId && dto.serviceCategoryId !== existingJob.serviceCategoryId) {
      const serviceCategory = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.serviceCategoryId },
      });
      if (!serviceCategory) {
        throw new BadRequestException('Invalid service category');
      }
    }

    // Build update data
    const updateData: Prisma.JobUpdateInput = {};

    if (dto.serviceCategoryId) updateData.serviceCategory = { connect: { id: dto.serviceCategoryId } };
    if (dto.contactName !== undefined) updateData.contactName = dto.contactName;
    if (dto.contactEmail !== undefined) updateData.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined) updateData.contactPhone = dto.contactPhone;
    if (dto.businessName !== undefined) updateData.businessName = dto.businessName;
    if (dto.serviceAddressLine1 !== undefined) updateData.serviceAddressLine1 = dto.serviceAddressLine1;
    if (dto.serviceAddressLine2 !== undefined) updateData.serviceAddressLine2 = dto.serviceAddressLine2;
    if (dto.serviceCity !== undefined) updateData.serviceCity = dto.serviceCity;
    if (dto.serviceProvince !== undefined) updateData.serviceProvince = dto.serviceProvince;
    if (dto.servicePostalCode !== undefined) updateData.servicePostalCode = dto.servicePostalCode;
    if (dto.serviceCountry !== undefined) updateData.serviceCountry = dto.serviceCountry;
    if (dto.serviceLat !== undefined) updateData.serviceLat = dto.serviceLat;
    if (dto.serviceLng !== undefined) updateData.serviceLng = dto.serviceLng;
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.preferredDateStart !== undefined) {
      updateData.preferredDateStart = dto.preferredDateStart
        ? new Date(dto.preferredDateStart)
        : null;
    }
    if (dto.preferredDateEnd !== undefined) {
      updateData.preferredDateEnd = dto.preferredDateEnd
        ? new Date(dto.preferredDateEnd)
        : null;
    }
    if (dto.urgency !== undefined) updateData.urgency = dto.urgency;
    if (dto.estimatedDuration !== undefined) updateData.estimatedDuration = dto.estimatedDuration;
    if (dto.internalNotes !== undefined) updateData.internalNotes = dto.internalNotes;
    if (dto.pipelineStageId !== undefined) {
      updateData.pipelineStage = dto.pipelineStageId
        ? { connect: { id: dto.pipelineStageId } }
        : { disconnect: true };
    }

    const updatedJob = await this.prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        serviceCategory: {
          select: { id: true, name: true, code: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        attachments: true,
      },
    });

    // Log audit event
    await this.auditService.log({
      action: AUDIT_ACTIONS.JOB_UPDATED,
      actorId: userId,
      actorType: ActorType.USER,
      targetType: 'Job',
      targetId: id,
      details: {
        jobNumber: existingJob.jobNumber,
        updatedFields: Object.keys(dto),
      },
    });

    return updatedJob as JobWithRelations;
  }

  /**
   * Add an attachment to a job
   */
  async addAttachment(
    jobId: string,
    dto: CreateAttachmentDto,
    userId: string,
  ): Promise<JobAttachment> {
    const job = await this.getJob(jobId);

    // Validate attachment limits based on type
    const existingAttachments = await this.prisma.jobAttachment.count({
      where: { jobId, type: dto.type },
    });

    if (dto.type === 'BEFORE_PHOTO' && existingAttachments >= FILE_UPLOAD.MAX_BEFORE_PHOTOS) {
      throw new BadRequestException(
        `Maximum ${FILE_UPLOAD.MAX_BEFORE_PHOTOS} before photos allowed`,
      );
    }

    if (dto.type === 'AFTER_PHOTO' && existingAttachments >= FILE_UPLOAD.MAX_AFTER_PHOTOS) {
      throw new BadRequestException(
        `Maximum ${FILE_UPLOAD.MAX_AFTER_PHOTOS} after photos allowed`,
      );
    }

    const attachment = await this.prisma.jobAttachment.create({
      data: {
        jobId,
        type: dto.type,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        uploadedById: userId,
      },
    });

    this.logger.log(`Added ${dto.type} attachment to job ${job.jobNumber}`);

    return attachment;
  }

  /**
   * Get attachments for a job, optionally filtered by type
   */
  async getAttachments(jobId: string, type?: AttachmentType): Promise<JobAttachment[]> {
    const where: Prisma.JobAttachmentWhereInput = { jobId };

    if (type) {
      where.type = type;
    }

    return this.prisma.jobAttachment.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId: string, userId: string): Promise<void> {
    const attachment = await this.prisma.jobAttachment.findUnique({
      where: { id: attachmentId },
      include: { job: true },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Delete from storage if possible
    try {
      const key = attachment.fileUrl.split('/').slice(-2).join('/');
      await this.storageService.deleteFile(key);
    } catch (error) {
      this.logger.warn(`Failed to delete file from storage: ${error}`);
    }

    await this.prisma.jobAttachment.delete({
      where: { id: attachmentId },
    });

    this.logger.log(`Deleted attachment ${attachmentId} from job ${attachment.jobId}`);
  }

  /**
   * Get a presigned URL for file upload
   */
  async getPresignedUploadUrl(
    jobId: string,
    dto: PresignedUrlRequestDto,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    const job = await this.getJob(jobId);

    const folder = `jobs/${job.id}/${dto.type.toLowerCase()}`;

    return this.storageService.getPresignedUploadUrl(folder, dto.fileName, dto.contentType);
  }

  /**
   * Check if user can access a job
   */
  async canUserAccessJob(
    jobId: string,
    userId: string,
    userRole: string,
    proProfileId?: string,
  ): Promise<boolean> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        dispatchAssignment: true,
      },
    });

    if (!job) {
      return false;
    }

    // Admin and operators can access all jobs
    if (userRole === 'ADMIN' || userRole === 'OPERATOR') {
      return true;
    }

    // SMB users can access their own jobs
    if (userRole === 'SMB_USER' && job.createdById === userId) {
      return true;
    }

    // Pro users can access jobs assigned to them
    if (
      userRole === 'PRO_USER' &&
      proProfileId &&
      job.dispatchAssignment?.proProfileId === proProfileId
    ) {
      return true;
    }

    return false;
  }

  /**
   * Build Prisma where clause from query filters
   */
  private buildWhereClause(filters: JobQueryDto): Prisma.JobWhereInput {
    const where: Prisma.JobWhereInput = {};

    // Status filter
    if (filters.status) {
      where.status = filters.status;
    } else if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses };
    }

    // Service category filter
    if (filters.serviceCategoryId) {
      where.serviceCategoryId = filters.serviceCategoryId;
    }

    // Urgency filter
    if (filters.urgency) {
      where.urgency = filters.urgency;
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }

    // Search filter
    if (filters.search) {
      where.OR = [
        { contactName: { contains: filters.search, mode: 'insensitive' } },
        { businessName: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { jobNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Assigned pro filter
    if (filters.assignedProId) {
      where.dispatchAssignment = { proProfileId: filters.assignedProId };
    }

    // Pipeline stage filter
    if (filters.pipelineStageId) {
      where.pipelineStageId = filters.pipelineStageId;
    }

    // Unassigned only filter
    if (filters.unassignedOnly) {
      where.dispatchAssignment = null;
    }

    return where;
  }

  /**
   * Get paginated jobs with common includes
   */
  private async getPaginatedJobs(
    where: Prisma.JobWhereInput,
    filters: JobQueryDto,
  ): Promise<PaginatedJobs> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const orderBy: Prisma.JobOrderByWithRelationInput = {};
    const sortField = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';

    // Handle nested sort fields
    if (sortField.includes('.')) {
      const [relation, field] = sortField.split('.');
      (orderBy as any)[relation] = { [field]: sortOrder };
    } else {
      (orderBy as any)[sortField] = sortOrder;
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: {
          serviceCategory: {
            select: { id: true, name: true, code: true },
          },
          createdBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          attachments: {
            take: 5,
            orderBy: { uploadedAt: 'desc' },
          },
          dispatchAssignment: {
            include: {
              proProfile: {
                select: {
                  id: true,
                  businessName: true,
                  user: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
          },
          pipelineStage: true,
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      jobs: jobs as JobWithRelations[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
