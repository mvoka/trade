import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import {
  DocumentFolder,
  CreateJobAttachmentDto,
  CreateVerificationDocumentDto,
  CreatePortfolioItemDto,
  UpdatePortfolioItemDto,
  AttachmentType,
  PortfolioVisibility,
} from './dto/documents.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get presigned upload URL for direct file upload
   */
  async getUploadUrl(
    folder: DocumentFolder,
    filename: string,
    contentType: string,
    userId: string,
  ) {
    // Validate content type for images
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const documentTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (folder.includes('photo') || folder === DocumentFolder.PORTFOLIO) {
      if (!imageTypes.includes(contentType)) {
        throw new BadRequestException('Invalid file type. Only images are allowed.');
      }
    }

    if (folder === DocumentFolder.VERIFICATION) {
      if (!documentTypes.includes(contentType)) {
        throw new BadRequestException('Invalid file type. Only PDF and images are allowed.');
      }
    }

    const result = await this.storageService.getPresignedUploadUrl(
      folder,
      filename,
      contentType,
    );

    this.logger.log(`Generated upload URL for user ${userId} in folder ${folder}`);

    return result;
  }

  // ================================
  // JOB ATTACHMENTS
  // ================================

  /**
   * Create job attachment record after successful upload
   */
  async createJobAttachment(dto: CreateJobAttachmentDto, userId: string) {
    // Verify job exists and user has access
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      include: {
        dispatchAssignment: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Check access: job creator or assigned pro
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { proProfile: true },
    });

    const isJobCreator = job.createdById === userId;
    const isAssignedPro = job.dispatchAssignment?.proProfileId === user?.proProfile?.id;
    const isOperatorOrAdmin = user?.role === 'OPERATOR' || user?.role === 'ADMIN';

    if (!isJobCreator && !isAssignedPro && !isOperatorOrAdmin) {
      throw new ForbiddenException('You do not have access to this job');
    }

    // Create attachment record
    const attachment = await this.prisma.jobAttachment.create({
      data: {
        jobId: dto.jobId,
        type: dto.type as any,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        uploadedById: userId,
      },
    });

    // Audit log
    await this.auditService.log({
      action: 'DOCUMENT_UPLOADED',
      actorId: userId,
      targetType: 'JobAttachment',
      targetId: attachment.id,
      details: {
        jobId: dto.jobId,
        type: dto.type,
        fileName: dto.fileName,
      },
    });

    this.logger.log(`Job attachment created: ${attachment.id} for job ${dto.jobId}`);

    return attachment;
  }

  /**
   * Get all attachments for a job
   */
  async getJobAttachments(jobId: string, userId: string, type?: AttachmentType) {
    // Verify job exists and user has access
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        dispatchAssignment: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Check access
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { proProfile: true },
    });

    const isJobCreator = job.createdById === userId;
    const isAssignedPro = job.dispatchAssignment?.proProfileId === user?.proProfile?.id;
    const isOperatorOrAdmin = user?.role === 'OPERATOR' || user?.role === 'ADMIN';

    if (!isJobCreator && !isAssignedPro && !isOperatorOrAdmin) {
      throw new ForbiddenException('You do not have access to this job');
    }

    const where: any = { jobId };
    if (type) {
      where.type = type;
    }

    const attachments = await this.prisma.jobAttachment.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
    });

    // Log access
    await this.auditService.log({
      action: 'DOCUMENTS_ACCESSED',
      actorId: userId,
      targetType: 'Job',
      targetId: jobId,
      details: { attachmentCount: attachments.length },
    });

    return attachments;
  }

  /**
   * Delete job attachment
   */
  async deleteJobAttachment(attachmentId: string, userId: string) {
    const attachment = await this.prisma.jobAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        job: {
          include: {
            dispatchAssignment: true,
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Check access
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { proProfile: true },
    });

    const isUploader = attachment.uploadedById === userId;
    const isOperatorOrAdmin = user?.role === 'OPERATOR' || user?.role === 'ADMIN';

    if (!isUploader && !isOperatorOrAdmin) {
      throw new ForbiddenException('You cannot delete this attachment');
    }

    // Delete from storage
    try {
      const key = this.extractKeyFromUrl(attachment.fileUrl);
      if (key) {
        await this.storageService.deleteFile(key);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete file from storage: ${error.message}`);
    }

    // Delete record
    await this.prisma.jobAttachment.delete({
      where: { id: attachmentId },
    });

    // Audit log
    await this.auditService.log({
      action: 'DOCUMENT_DELETED',
      actorId: userId,
      targetType: 'JobAttachment',
      targetId: attachmentId,
      details: {
        jobId: attachment.jobId,
        fileName: attachment.fileName,
      },
    });

    this.logger.log(`Job attachment deleted: ${attachmentId}`);

    return { message: 'Attachment deleted successfully' };
  }

  /**
   * Check if job has required photos
   */
  async validateJobPhotos(jobId: string, requireBefore: boolean, requireAfter: boolean) {
    const attachments = await this.prisma.jobAttachment.findMany({
      where: { jobId },
    });

    const hasBeforePhoto = attachments.some((a) => a.type === 'BEFORE_PHOTO');
    const hasAfterPhoto = attachments.some((a) => a.type === 'AFTER_PHOTO');

    const errors: string[] = [];

    if (requireBefore && !hasBeforePhoto) {
      errors.push('At least one before photo is required');
    }

    if (requireAfter && !hasAfterPhoto) {
      errors.push('At least one after photo is required');
    }

    return {
      valid: errors.length === 0,
      hasBeforePhoto,
      hasAfterPhoto,
      errors,
    };
  }

  // ================================
  // VERIFICATION DOCUMENTS
  // ================================

  /**
   * Create verification document
   */
  async createVerificationDocument(dto: CreateVerificationDocumentDto, userId: string) {
    // Verify record exists and user owns it
    const record = await this.prisma.verificationRecord.findUnique({
      where: { id: dto.verificationRecordId },
      include: {
        proProfile: {
          include: { user: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Verification record not found');
    }

    // Check access: pro owner or admin
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isOwner = record.proProfile.userId === userId;
    const isAdmin = user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have access to this verification record');
    }

    // Create document record
    const document = await this.prisma.verificationDocument.create({
      data: {
        verificationRecordId: dto.verificationRecordId,
        documentType: dto.documentType,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
    });

    // Audit log
    await this.auditService.log({
      action: 'VERIFICATION_DOCUMENT_UPLOADED',
      actorId: userId,
      targetType: 'VerificationDocument',
      targetId: document.id,
      details: {
        verificationRecordId: dto.verificationRecordId,
        documentType: dto.documentType,
      },
    });

    this.logger.log(`Verification document created: ${document.id}`);

    return document;
  }

  /**
   * Get verification documents for a pro profile
   */
  async getVerificationDocuments(proProfileId: string, userId: string) {
    // Check access
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile) {
      throw new NotFoundException('Pro profile not found');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isOwner = proProfile.userId === userId;
    const isAdminOrOperator = user?.role === 'ADMIN' || user?.role === 'OPERATOR';

    if (!isOwner && !isAdminOrOperator) {
      throw new ForbiddenException('You do not have access to these documents');
    }

    const records = await this.prisma.verificationRecord.findMany({
      where: { proProfileId },
      include: {
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Audit log
    await this.auditService.log({
      action: 'VERIFICATION_DOCUMENTS_ACCESSED',
      actorId: userId,
      targetType: 'ProProfile',
      targetId: proProfileId,
    });

    return records;
  }

  // ================================
  // PORTFOLIO ITEMS
  // ================================

  /**
   * Create portfolio item
   */
  async createPortfolioItem(dto: CreatePortfolioItemDto, proProfileId: string, userId: string) {
    // Verify pro profile ownership
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile) {
      throw new NotFoundException('Pro profile not found');
    }

    if (proProfile.userId !== userId) {
      throw new ForbiddenException('You can only add to your own portfolio');
    }

    // If job ID provided, verify access
    if (dto.jobId) {
      const job = await this.prisma.job.findUnique({
        where: { id: dto.jobId },
        include: { dispatchAssignment: true },
      });

      if (!job) {
        throw new NotFoundException('Job not found');
      }

      if (job.dispatchAssignment?.proProfileId !== proProfileId) {
        throw new ForbiddenException('You can only add photos from jobs you completed');
      }
    }

    // Get next sort order
    const lastItem = await this.prisma.portfolioItem.findFirst({
      where: { proProfileId },
      orderBy: { sortOrder: 'desc' },
    });

    const portfolioItem = await this.prisma.portfolioItem.create({
      data: {
        proProfileId,
        jobId: dto.jobId,
        title: dto.title,
        description: dto.description,
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType,
        visibility: (dto.visibility as any) || 'PRIVATE',
        sortOrder: (lastItem?.sortOrder || 0) + 1,
      },
    });

    // Audit log
    await this.auditService.log({
      action: 'PORTFOLIO_ITEM_CREATED',
      actorId: userId,
      targetType: 'PortfolioItem',
      targetId: portfolioItem.id,
    });

    this.logger.log(`Portfolio item created: ${portfolioItem.id}`);

    return portfolioItem;
  }

  /**
   * Get portfolio items for a pro
   */
  async getPortfolioItems(
    proProfileId: string,
    userId: string,
    publicOnly: boolean = false,
  ) {
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile) {
      throw new NotFoundException('Pro profile not found');
    }

    const isOwner = proProfile.userId === userId;

    // If not owner and not admin, only show public items with opt-in
    const where: any = { proProfileId };

    if (!isOwner || publicOnly) {
      where.visibility = 'PUBLIC';
      where.optInGranted = true;
    }

    const items = await this.prisma.portfolioItem.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            serviceCategory: {
              select: { name: true },
            },
            completedAt: true,
          },
        },
      },
    });

    return items;
  }

  /**
   * Update portfolio item
   */
  async updatePortfolioItem(itemId: string, dto: UpdatePortfolioItemDto, userId: string) {
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id: itemId },
      include: { proProfile: true },
    });

    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }

    if (item.proProfile.userId !== userId) {
      throw new ForbiddenException('You can only update your own portfolio items');
    }

    const updated = await this.prisma.portfolioItem.update({
      where: { id: itemId },
      data: {
        title: dto.title,
        description: dto.description,
        visibility: dto.visibility as any,
        optInGranted: dto.optInGranted,
        optInAt: dto.optInGranted && !item.optInGranted ? new Date() : undefined,
        sortOrder: dto.sortOrder,
      },
    });

    // Audit log
    await this.auditService.log({
      action: 'PORTFOLIO_ITEM_UPDATED',
      actorId: userId,
      targetType: 'PortfolioItem',
      targetId: itemId,
      details: { changes: dto },
    });

    return updated;
  }

  /**
   * Delete portfolio item
   */
  async deletePortfolioItem(itemId: string, userId: string) {
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id: itemId },
      include: { proProfile: true },
    });

    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }

    if (item.proProfile.userId !== userId) {
      throw new ForbiddenException('You can only delete your own portfolio items');
    }

    // Delete from storage
    try {
      const key = this.extractKeyFromUrl(item.mediaUrl);
      if (key) {
        await this.storageService.deleteFile(key);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete file from storage: ${error.message}`);
    }

    await this.prisma.portfolioItem.delete({
      where: { id: itemId },
    });

    // Audit log
    await this.auditService.log({
      action: 'PORTFOLIO_ITEM_DELETED',
      actorId: userId,
      targetType: 'PortfolioItem',
      targetId: itemId,
    });

    return { message: 'Portfolio item deleted successfully' };
  }

  /**
   * Reorder portfolio items
   */
  async reorderPortfolioItems(
    proProfileId: string,
    itemIds: string[],
    userId: string,
  ) {
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile || proProfile.userId !== userId) {
      throw new ForbiddenException('You can only reorder your own portfolio');
    }

    // Update sort orders
    await Promise.all(
      itemIds.map((id, index) =>
        this.prisma.portfolioItem.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    return { message: 'Portfolio reordered successfully' };
  }

  // ================================
  // HELPERS
  // ================================

  /**
   * Extract storage key from URL
   */
  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/');
      // Remove bucket name from path
      return parts.slice(2).join('/');
    } catch {
      return null;
    }
  }

  /**
   * Get presigned download URL for private files
   */
  async getDownloadUrl(key: string, userId: string) {
    const url = await this.storageService.getPresignedDownloadUrl(key);

    // Audit log
    await this.auditService.log({
      action: 'DOCUMENT_DOWNLOAD_REQUESTED',
      actorId: userId,
      details: { key },
    });

    return { downloadUrl: url };
  }
}
