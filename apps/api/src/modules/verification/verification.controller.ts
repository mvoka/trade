import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@trades/shared';
import {
  UploadDocumentDto,
  ApproveVerificationDto,
  DenyVerificationDto,
  VerificationQueryDto,
  ExpiringDocumentsQueryDto,
  VerificationRecordResponseDto,
  VerificationStatusResponseDto,
  VerificationChecklistItemDto,
  ExpiringDocumentResponseDto,
  PaginatedVerificationRecordsDto,
  MessageResponseDto,
} from './dto/verification.dto';

@ApiTags('Verification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  // ============================================
  // PRO USER ENDPOINTS
  // ============================================

  @Post('verification/submit')
  @Roles(UserRole.PRO_USER)
  @ApiOperation({
    summary: 'Submit for verification',
    description: 'Creates a new verification request for the current pro user.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Verification request submitted successfully',
    type: VerificationRecordResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'A verification request is already pending',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pro profile not found',
  })
  async submitVerification(
    @CurrentUser() user: CurrentUserData,
  ): Promise<VerificationRecordResponseDto> {
    if (!user.proProfileId) {
      throw new Error('Pro profile ID not found for current user');
    }
    return this.verificationService.submitVerification(user.proProfileId);
  }

  @Post('verification/documents')
  @Roles(UserRole.PRO_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload verification document',
    description:
      'Upload a document to the current pending verification request. If a document of the same type exists, it will be replaced.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Document uploaded successfully',
    type: VerificationRecordResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot upload to non-pending verification',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Verification record not found',
  })
  async uploadDocument(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UploadDocumentDto,
  ): Promise<VerificationRecordResponseDto> {
    if (!user.proProfileId) {
      throw new Error('Pro profile ID not found for current user');
    }

    // Get the current pending verification record
    const status = await this.verificationService.getVerificationStatus(user.proProfileId);

    if (!status.currentRecord || status.currentRecord.status !== 'PENDING') {
      throw new Error('No pending verification found. Please submit a verification request first.');
    }

    return this.verificationService.uploadDocument(status.currentRecord.id, dto);
  }

  @Get('verification/status')
  @Roles(UserRole.PRO_USER)
  @ApiOperation({
    summary: 'Get current verification status',
    description: 'Returns the current verification status for the authenticated pro user.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification status retrieved successfully',
    type: VerificationStatusResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pro profile not found',
  })
  async getVerificationStatus(
    @CurrentUser() user: CurrentUserData,
  ): Promise<VerificationStatusResponseDto> {
    if (!user.proProfileId) {
      throw new Error('Pro profile ID not found for current user');
    }
    return this.verificationService.getVerificationStatus(user.proProfileId);
  }

  @Get('verification/checklist/:categoryId')
  @Roles(UserRole.PRO_USER, UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'Get verification checklist',
    description:
      'Returns the list of required documents for a specific service category.',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Service category ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Checklist retrieved successfully',
    type: [VerificationChecklistItemDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Service category not found',
  })
  async getVerificationChecklist(
    @Param('categoryId') categoryId: string,
  ): Promise<VerificationChecklistItemDto[]> {
    return this.verificationService.getVerificationChecklist(categoryId);
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  @Get('admin/verification/pending')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'List pending verifications',
    description:
      'Returns a paginated list of verification requests. Defaults to pending status.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'DENIED', 'EXPIRED'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending verifications retrieved successfully',
    type: PaginatedVerificationRecordsDto,
  })
  async getPendingVerifications(
    @Query() query: VerificationQueryDto,
  ): Promise<PaginatedVerificationRecordsDto> {
    return this.verificationService.getPendingVerifications(query);
  }

  @Get('admin/verification/expiring')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'Get expiring documents',
    description:
      'Returns a list of approved documents that are expiring within the specified number of days.',
  })
  @ApiQuery({
    name: 'daysAhead',
    required: true,
    type: Number,
    description: 'Number of days ahead to check for expiring documents',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Expiring documents retrieved successfully',
    type: [ExpiringDocumentResponseDto],
  })
  async getExpiringDocuments(
    @Query() query: ExpiringDocumentsQueryDto,
  ): Promise<ExpiringDocumentResponseDto[]> {
    return this.verificationService.checkExpiringDocuments(query.daysAhead);
  }

  @Get('admin/verification/:id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'Get verification details',
    description:
      'Returns the full details of a verification record including all uploaded documents.',
  })
  @ApiParam({
    name: 'id',
    description: 'Verification record ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification record retrieved successfully',
    type: VerificationRecordResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Verification record not found',
  })
  async getVerificationRecord(
    @Param('id') id: string,
  ): Promise<VerificationRecordResponseDto> {
    return this.verificationService.getVerificationRecord(id);
  }

  @Post('admin/verification/:id/approve')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve verification',
    description:
      'Approves a pending verification request. Updates the pro profile status to APPROVED.',
  })
  @ApiParam({
    name: 'id',
    description: 'Verification record ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification approved successfully',
    type: VerificationRecordResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot approve non-pending verification',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Verification record not found',
  })
  async approveVerification(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ApproveVerificationDto,
  ): Promise<VerificationRecordResponseDto> {
    return this.verificationService.approveVerification(id, user.userId, dto.notes);
  }

  @Post('admin/verification/:id/deny')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deny verification',
    description:
      'Denies a pending verification request with a reason. Updates the pro profile status to DENIED.',
  })
  @ApiParam({
    name: 'id',
    description: 'Verification record ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification denied successfully',
    type: VerificationRecordResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot deny non-pending verification or missing notes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Verification record not found',
  })
  async denyVerification(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: DenyVerificationDto,
  ): Promise<VerificationRecordResponseDto> {
    return this.verificationService.denyVerification(id, user.userId, dto.notes);
  }
}
