import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { ActorType } from '../audit/dto/audit.dto';
import { VerificationStatus, AUDIT_ACTIONS } from '@trades/shared';
import { Prisma } from '@trades/prisma';
import {
  UploadDocumentDto,
  VerificationQueryDto,
  VerificationRecordResponseDto,
  VerificationStatusResponseDto,
  VerificationChecklistItemDto,
  ExpiringDocumentResponseDto,
  PaginatedVerificationRecordsDto,
} from './dto/verification.dto';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Submit a new verification request for a pro profile
   */
  async submitVerification(proProfileId: string): Promise<VerificationRecordResponseDto> {
    // Verify the pro profile exists
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
    }

    // Check if there's already a pending verification
    const existingPending = await this.prisma.verificationRecord.findFirst({
      where: {
        proProfileId,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      throw new ConflictException(
        'A verification request is already pending. Please wait for it to be reviewed.',
      );
    }

    // Create the verification record
    const verificationRecord = await this.prisma.verificationRecord.create({
      data: {
        proProfileId,
        status: 'PENDING',
        submittedAt: new Date(),
      },
      include: {
        documents: true,
        proProfile: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Verification submitted for pro profile: ${proProfileId}`);

    return this.mapToResponseDto(verificationRecord);
  }

  /**
   * Upload a document to a verification record
   */
  async uploadDocument(
    verificationRecordId: string,
    dto: UploadDocumentDto,
  ): Promise<VerificationRecordResponseDto> {
    // Verify the record exists and is pending
    const record = await this.prisma.verificationRecord.findUnique({
      where: { id: verificationRecordId },
    });

    if (!record) {
      throw new NotFoundException(
        `Verification record with ID ${verificationRecordId} not found`,
      );
    }

    if (record.status !== 'PENDING') {
      throw new BadRequestException(
        'Cannot upload documents to a verification that is not pending',
      );
    }

    // Check if document type already exists for this record
    const existingDocument = await this.prisma.verificationDocument.findFirst({
      where: {
        verificationRecordId,
        documentType: dto.documentType,
      },
    });

    if (existingDocument) {
      // Update existing document
      await this.prisma.verificationDocument.update({
        where: { id: existingDocument.id },
        data: {
          fileName: dto.fileName,
          fileUrl: dto.fileUrl,
          fileSize: dto.fileSize || null,
          mimeType: dto.mimeType || null,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          status: 'PENDING',
          reviewNotes: null,
          uploadedAt: new Date(),
        },
      });

      this.logger.log(
        `Document ${dto.documentType} updated for verification: ${verificationRecordId}`,
      );
    } else {
      // Create new document
      await this.prisma.verificationDocument.create({
        data: {
          verificationRecordId,
          documentType: dto.documentType,
          fileName: dto.fileName,
          fileUrl: dto.fileUrl,
          fileSize: dto.fileSize || null,
          mimeType: dto.mimeType || null,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          status: 'PENDING',
          uploadedAt: new Date(),
        },
      });

      this.logger.log(
        `Document ${dto.documentType} uploaded to verification: ${verificationRecordId}`,
      );
    }

    // Return updated record with documents
    const updatedRecord = await this.prisma.verificationRecord.findUnique({
      where: { id: verificationRecordId },
      include: {
        documents: true,
        proProfile: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return this.mapToResponseDto(updatedRecord!);
  }

  /**
   * Get the current verification status for a pro profile
   */
  async getVerificationStatus(proProfileId: string): Promise<VerificationStatusResponseDto> {
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      include: {
        verificationRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            documents: true,
          },
        },
      },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
    }

    const currentRecord = proProfile.verificationRecords[0] || null;

    return {
      status: proProfile.verificationStatus,
      currentRecord: currentRecord
        ? this.mapToResponseDto({
            ...currentRecord,
            proProfile: null,
          })
        : null,
      totalDocuments: currentRecord?.documents?.length || 0,
      verifiedAt: proProfile.verifiedAt,
    };
  }

  /**
   * Get a verification record by ID with all documents
   */
  async getVerificationRecord(id: string): Promise<VerificationRecordResponseDto> {
    const record = await this.prisma.verificationRecord.findUnique({
      where: { id },
      include: {
        documents: true,
        proProfile: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Verification record with ID ${id} not found`);
    }

    return this.mapToResponseDto(record);
  }

  /**
   * Get all pending verifications (Admin)
   */
  async getPendingVerifications(
    query: VerificationQueryDto,
  ): Promise<PaginatedVerificationRecordsDto> {
    const { status, page = 1, pageSize = 20, sortBy = 'submittedAt', sortOrder = 'desc' } = query;

    // Build where clause
    const where: Prisma.VerificationRecordWhereInput = {};
    if (status) {
      where.status = status as any;
    } else {
      // Default to PENDING for admin view
      where.status = 'PENDING';
    }

    // Build order by clause
    const validSortFields = ['submittedAt', 'createdAt', 'status'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'submittedAt';
    const orderBy: Prisma.VerificationRecordOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Execute query with count
    const [records, total] = await Promise.all([
      this.prisma.verificationRecord.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          documents: true,
          proProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.verificationRecord.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: records.map((record) => this.mapToResponseDto(record)),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  /**
   * Approve a verification record (Admin)
   */
  async approveVerification(
    recordId: string,
    adminId: string,
    notes?: string,
  ): Promise<VerificationRecordResponseDto> {
    const record = await this.prisma.verificationRecord.findUnique({
      where: { id: recordId },
      include: {
        proProfile: true,
        documents: true,
      },
    });

    if (!record) {
      throw new NotFoundException(`Verification record with ID ${recordId} not found`);
    }

    if (record.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot approve verification with status: ${record.status}`,
      );
    }

    // Update the verification record
    const updatedRecord = await this.prisma.verificationRecord.update({
      where: { id: recordId },
      data: {
        status: 'APPROVED',
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNotes: notes || null,
      },
      include: {
        documents: true,
        proProfile: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Update all documents to approved
    await this.prisma.verificationDocument.updateMany({
      where: { verificationRecordId: recordId },
      data: { status: 'APPROVED' },
    });

    // Update the pro profile verification status
    await this.prisma.proProfile.update({
      where: { id: record.proProfileId },
      data: {
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    // Log audit
    await this.auditService.log({
      action: AUDIT_ACTIONS.PRO_VERIFIED,
      actorId: adminId,
      actorType: ActorType.USER,
      targetType: 'VerificationRecord',
      targetId: recordId,
      details: {
        proProfileId: record.proProfileId,
        notes,
        documentsCount: record.documents.length,
      },
    });

    this.logger.log(`Verification ${recordId} approved by admin ${adminId}`);

    return this.mapToResponseDto(updatedRecord);
  }

  /**
   * Deny a verification record (Admin)
   */
  async denyVerification(
    recordId: string,
    adminId: string,
    notes: string,
  ): Promise<VerificationRecordResponseDto> {
    const record = await this.prisma.verificationRecord.findUnique({
      where: { id: recordId },
      include: {
        proProfile: true,
        documents: true,
      },
    });

    if (!record) {
      throw new NotFoundException(`Verification record with ID ${recordId} not found`);
    }

    if (record.status !== 'PENDING') {
      throw new BadRequestException(`Cannot deny verification with status: ${record.status}`);
    }

    // Update the verification record
    const updatedRecord = await this.prisma.verificationRecord.update({
      where: { id: recordId },
      data: {
        status: 'DENIED',
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
      include: {
        documents: true,
        proProfile: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Update all documents to denied
    await this.prisma.verificationDocument.updateMany({
      where: { verificationRecordId: recordId },
      data: { status: 'DENIED' },
    });

    // Update the pro profile verification status
    await this.prisma.proProfile.update({
      where: { id: record.proProfileId },
      data: {
        verificationStatus: 'DENIED',
      },
    });

    // Log audit
    await this.auditService.log({
      action: AUDIT_ACTIONS.PRO_VERIFICATION_DENIED,
      actorId: adminId,
      actorType: ActorType.USER,
      targetType: 'VerificationRecord',
      targetId: recordId,
      details: {
        proProfileId: record.proProfileId,
        notes,
        documentsCount: record.documents.length,
      },
    });

    this.logger.log(`Verification ${recordId} denied by admin ${adminId}`);

    return this.mapToResponseDto(updatedRecord);
  }

  /**
   * Get the verification checklist for a service category
   */
  async getVerificationChecklist(
    serviceCategoryId: string,
  ): Promise<VerificationChecklistItemDto[]> {
    // Verify the service category exists
    const serviceCategory = await this.prisma.serviceCategory.findUnique({
      where: { id: serviceCategoryId },
    });

    if (!serviceCategory) {
      throw new NotFoundException(
        `Service category with ID ${serviceCategoryId} not found`,
      );
    }

    const checklistItems = await this.prisma.verificationChecklist.findMany({
      where: {
        serviceCategoryId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return checklistItems.map((item) => ({
      id: item.id,
      documentType: item.documentType,
      name: item.name,
      description: item.description,
      isRequired: item.isRequired,
      expiryRequired: item.expiryRequired,
      sortOrder: item.sortOrder,
    }));
  }

  /**
   * Check for documents expiring within the specified number of days
   */
  async checkExpiringDocuments(daysAhead: number): Promise<ExpiringDocumentResponseDto[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const expiringDocuments = await this.prisma.verificationDocument.findMany({
      where: {
        expiryDate: {
          gte: now,
          lte: futureDate,
        },
        status: 'APPROVED',
        verificationRecord: {
          status: 'APPROVED',
        },
      },
      include: {
        verificationRecord: {
          include: {
            proProfile: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    return expiringDocuments.map((doc) => {
      const daysUntilExpiry = Math.ceil(
        (doc.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        documentId: doc.id,
        documentType: doc.documentType,
        expiryDate: doc.expiryDate!,
        daysUntilExpiry,
        verificationRecordId: doc.verificationRecordId,
        proProfile: {
          id: doc.verificationRecord.proProfile.id,
          businessName: doc.verificationRecord.proProfile.businessName,
          user: {
            id: doc.verificationRecord.proProfile.user.id,
            email: doc.verificationRecord.proProfile.user.email,
            firstName: doc.verificationRecord.proProfile.user.firstName,
            lastName: doc.verificationRecord.proProfile.user.lastName,
          },
        },
      };
    });
  }

  /**
   * Map database record to response DTO
   */
  private mapToResponseDto(record: {
    id: string;
    proProfileId: string;
    status: string;
    reviewedById: string | null;
    reviewedAt: Date | null;
    reviewNotes: string | null;
    submittedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    documents?: Array<{
      id: string;
      documentType: string;
      fileName: string;
      fileUrl: string;
      fileSize: number | null;
      mimeType: string | null;
      expiryDate: Date | null;
      status: string;
      reviewNotes: string | null;
      uploadedAt: Date;
      createdAt: Date;
      updatedAt: Date;
    }>;
    proProfile?: {
      id: string;
      businessName: string | null;
      user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      };
    } | null;
  }): VerificationRecordResponseDto {
    return {
      id: record.id,
      proProfileId: record.proProfileId,
      status: record.status,
      reviewedById: record.reviewedById,
      reviewedAt: record.reviewedAt,
      reviewNotes: record.reviewNotes,
      submittedAt: record.submittedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      documents: record.documents?.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        expiryDate: doc.expiryDate,
        status: doc.status,
        reviewNotes: doc.reviewNotes,
        uploadedAt: doc.uploadedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
      proProfile: record.proProfile
        ? {
            id: record.proProfile.id,
            businessName: record.proProfile.businessName,
            user: {
              id: record.proProfile.user.id,
              email: record.proProfile.user.email,
              firstName: record.proProfile.user.firstName,
              lastName: record.proProfile.user.lastName,
            },
          }
        : undefined,
    };
  }
}
