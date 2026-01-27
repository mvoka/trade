import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import {
  GetUploadUrlDto,
  CreateJobAttachmentDto,
  CreateVerificationDocumentDto,
  CreatePortfolioItemDto,
  UpdatePortfolioItemDto,
  UploadUrlResponseDto,
  JobAttachmentResponseDto,
  VerificationDocumentResponseDto,
  PortfolioItemResponseDto,
  AttachmentType,
} from './dto/documents.dto';

@ApiTags('documents')
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ================================
  // UPLOAD URL
  // ================================

  @Post('upload-url')
  @ApiOperation({ summary: 'Get presigned URL for file upload' })
  @ApiResponse({ status: 200, type: UploadUrlResponseDto })
  async getUploadUrl(
    @Body() dto: GetUploadUrlDto,
    @CurrentUser() user: any,
  ): Promise<UploadUrlResponseDto> {
    return this.documentsService.getUploadUrl(
      dto.folder,
      dto.filename,
      dto.contentType,
      user.sub,
    );
  }

  @Get('download-url')
  @ApiOperation({ summary: 'Get presigned URL for file download' })
  @ApiQuery({ name: 'key', required: true })
  async getDownloadUrl(
    @Query('key') key: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.getDownloadUrl(key, user.sub);
  }

  // ================================
  // JOB ATTACHMENTS
  // ================================

  @Post('job-attachments')
  @ApiOperation({ summary: 'Create job attachment record after upload' })
  @ApiResponse({ status: 201, type: JobAttachmentResponseDto })
  async createJobAttachment(
    @Body() dto: CreateJobAttachmentDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.createJobAttachment(dto, user.sub);
  }

  @Get('jobs/:jobId/attachments')
  @ApiOperation({ summary: 'Get all attachments for a job' })
  @ApiQuery({ name: 'type', required: false, enum: AttachmentType })
  @ApiResponse({ status: 200, type: [JobAttachmentResponseDto] })
  async getJobAttachments(
    @Param('jobId') jobId: string,
    @Query('type') type: AttachmentType | undefined,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.getJobAttachments(jobId, user.sub, type);
  }

  @Delete('job-attachments/:attachmentId')
  @ApiOperation({ summary: 'Delete a job attachment' })
  async deleteJobAttachment(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.deleteJobAttachment(attachmentId, user.sub);
  }

  @Get('jobs/:jobId/validate-photos')
  @ApiOperation({ summary: 'Validate job has required photos' })
  @ApiQuery({ name: 'requireBefore', required: false, type: Boolean })
  @ApiQuery({ name: 'requireAfter', required: false, type: Boolean })
  async validateJobPhotos(
    @Param('jobId') jobId: string,
    @Query('requireBefore') requireBefore?: string,
    @Query('requireAfter') requireAfter?: string,
  ) {
    return this.documentsService.validateJobPhotos(
      jobId,
      requireBefore === 'true',
      requireAfter === 'true',
    );
  }

  // ================================
  // VERIFICATION DOCUMENTS
  // ================================

  @Post('verification')
  @Roles('PRO_USER', 'ADMIN')
  @ApiOperation({ summary: 'Upload verification document' })
  @ApiResponse({ status: 201, type: VerificationDocumentResponseDto })
  async createVerificationDocument(
    @Body() dto: CreateVerificationDocumentDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.createVerificationDocument(dto, user.sub);
  }

  @Get('verification/:proProfileId')
  @Roles('PRO_USER', 'ADMIN', 'OPERATOR')
  @ApiOperation({ summary: 'Get verification documents for a pro profile' })
  async getVerificationDocuments(
    @Param('proProfileId') proProfileId: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.getVerificationDocuments(proProfileId, user.sub);
  }

  // ================================
  // PORTFOLIO
  // ================================

  @Post('portfolio/:proProfileId')
  @Roles('PRO_USER')
  @ApiOperation({ summary: 'Create portfolio item' })
  @ApiResponse({ status: 201, type: PortfolioItemResponseDto })
  async createPortfolioItem(
    @Param('proProfileId') proProfileId: string,
    @Body() dto: CreatePortfolioItemDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.createPortfolioItem(dto, proProfileId, user.sub);
  }

  @Get('portfolio/:proProfileId')
  @ApiOperation({ summary: 'Get portfolio items for a pro' })
  @ApiQuery({ name: 'publicOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [PortfolioItemResponseDto] })
  async getPortfolioItems(
    @Param('proProfileId') proProfileId: string,
    @Query('publicOnly') publicOnly: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.getPortfolioItems(
      proProfileId,
      user.sub,
      publicOnly === 'true',
    );
  }

  @Put('portfolio/:itemId')
  @Roles('PRO_USER')
  @ApiOperation({ summary: 'Update portfolio item' })
  @ApiResponse({ status: 200, type: PortfolioItemResponseDto })
  async updatePortfolioItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePortfolioItemDto,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.updatePortfolioItem(itemId, dto, user.sub);
  }

  @Delete('portfolio/:itemId')
  @Roles('PRO_USER')
  @ApiOperation({ summary: 'Delete portfolio item' })
  async deletePortfolioItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.deletePortfolioItem(itemId, user.sub);
  }

  @Put('portfolio/:proProfileId/reorder')
  @Roles('PRO_USER')
  @ApiOperation({ summary: 'Reorder portfolio items' })
  async reorderPortfolioItems(
    @Param('proProfileId') proProfileId: string,
    @Body() body: { itemIds: string[] },
    @CurrentUser() user: any,
  ) {
    return this.documentsService.reorderPortfolioItems(
      proProfileId,
      body.itemIds,
      user.sub,
    );
  }
}
