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
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { JobStatusService } from './job-status.service';
import {
  CreateJobDto,
  UpdateJobDto,
  ChangeStatusDto,
  CreateAttachmentDto,
  JobQueryDto,
  CompleteJobDto,
  PresignedUrlRequestDto,
  JobResponseDto,
  JobListResponseDto,
  JobAttachmentResponseDto,
} from './dto/jobs.dto';
import { UserRole, AttachmentType, JobStatus } from '@trades/shared';

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly jobStatusService: JobStatusService,
  ) {}

  // ============================================
  // CREATE JOB
  // ============================================

  @Post()
  @Roles(UserRole.SMB_USER, UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create a new job' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Job created successfully',
    type: JobResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async createJob(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateJobDto,
  ): Promise<JobResponseDto> {
    const job = await this.jobsService.createJob(user.userId, dto);
    return job as unknown as JobResponseDto;
  }

  // ============================================
  // LIST JOBS
  // ============================================

  @Get()
  @ApiOperation({ summary: 'List jobs with role-based filtering' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Jobs retrieved successfully',
    type: JobListResponseDto,
  })
  async listJobs(
    @CurrentUser() user: CurrentUserData,
    @Query() query: JobQueryDto,
  ): Promise<JobListResponseDto> {
    let result;

    switch (user.role) {
      case UserRole.SMB_USER:
        // SMB users see only their own jobs
        result = await this.jobsService.getJobsByUser(user.userId, query);
        break;

      case UserRole.PRO_USER:
        // Pro users see jobs assigned to them
        if (!user.proProfileId) {
          throw new ForbiddenException('Pro profile not found');
        }
        result = await this.jobsService.getJobsByPro(user.proProfileId, query);
        break;

      case UserRole.ADMIN:
      case UserRole.OPERATOR:
        // Admins and operators see all jobs
        result = await this.jobsService.getAllJobs(query);
        break;

      default:
        throw new ForbiddenException('Invalid role');
    }

    return {
      jobs: result.jobs as unknown as JobResponseDto[],
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  // ============================================
  // GET JOB DETAILS
  // ============================================

  @Get(':id')
  @ApiOperation({ summary: 'Get job details by ID' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job details retrieved successfully',
    type: JobResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Job not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async getJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<JobResponseDto> {
    // Check access
    const canAccess = await this.jobsService.canUserAccessJob(
      id,
      user.userId,
      user.role,
      user.proProfileId,
    );

    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this job');
    }

    const job = await this.jobsService.getJob(id);
    return job as unknown as JobResponseDto;
  }

  // ============================================
  // UPDATE JOB
  // ============================================

  @Put(':id')
  @Roles(UserRole.SMB_USER, UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update job details' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job updated successfully',
    type: JobResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Job not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async updateJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<JobResponseDto> {
    // Check access for SMB users
    if (user.role === UserRole.SMB_USER) {
      const canAccess = await this.jobsService.canUserAccessJob(
        id,
        user.userId,
        user.role,
        user.proProfileId,
      );
      if (!canAccess) {
        throw new ForbiddenException('You do not have access to this job');
      }
    }

    const job = await this.jobsService.updateJob(id, dto, user.userId);
    return job as unknown as JobResponseDto;
  }

  // ============================================
  // CHANGE STATUS
  // ============================================

  @Put(':id/status')
  @ApiOperation({ summary: 'Change job status' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job status changed successfully',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid status transition' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Job not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ success: boolean; previousStatus: string; newStatus: string; changedAt: Date }> {
    // Check access
    const canAccess = await this.jobsService.canUserAccessJob(
      id,
      user.userId,
      user.role,
      user.proProfileId,
    );

    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this job');
    }

    const result = await this.jobStatusService.changeStatus(
      id,
      dto.newStatus as JobStatus,
      user.userId,
      {
        reason: dto.reason,
        notes: dto.notes,
        proProfileId: user.proProfileId,
      },
    );

    return {
      success: true,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      changedAt: result.changedAt,
    };
  }

  // ============================================
  // COMPLETE JOB (Pro)
  // ============================================

  @Post(':id/complete')
  @Roles(UserRole.PRO_USER)
  @ApiOperation({ summary: 'Complete a job with after photos (Pro only)' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job completed successfully',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Cannot complete job' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not assigned to this job' })
  async completeJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteJobDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ success: boolean; jobNumber: string; completedAt: Date }> {
    if (!user.proProfileId) {
      throw new ForbiddenException('Pro profile not found');
    }

    const result = await this.jobStatusService.completeJob(
      id,
      dto,
      user.userId,
      user.proProfileId,
    );

    return {
      success: true,
      jobNumber: result.job.jobNumber,
      completedAt: result.changedAt,
    };
  }

  // ============================================
  // ATTACHMENTS
  // ============================================

  @Post(':id/attachments')
  @ApiOperation({ summary: 'Add attachment to job' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Attachment added successfully',
    type: JobAttachmentResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid attachment data' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async addAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAttachmentDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<JobAttachmentResponseDto> {
    // Check access
    const canAccess = await this.jobsService.canUserAccessJob(
      id,
      user.userId,
      user.role,
      user.proProfileId,
    );

    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this job');
    }

    const attachment = await this.jobsService.addAttachment(id, dto, user.userId);
    return attachment as unknown as JobAttachmentResponseDto;
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: 'Get job attachments' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['BEFORE_PHOTO', 'AFTER_PHOTO', 'DOCUMENT', 'OTHER'],
    description: 'Filter by attachment type',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Attachments retrieved successfully',
    type: [JobAttachmentResponseDto],
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async getAttachments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('type') type: AttachmentType | undefined,
    @CurrentUser() user: CurrentUserData,
  ): Promise<JobAttachmentResponseDto[]> {
    // Check access
    const canAccess = await this.jobsService.canUserAccessJob(
      id,
      user.userId,
      user.role,
      user.proProfileId,
    );

    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this job');
    }

    const attachments = await this.jobsService.getAttachments(id, type);
    return attachments as unknown as JobAttachmentResponseDto[];
  }

  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiParam({ name: 'attachmentId', description: 'Attachment ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Attachment deleted successfully' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async deleteAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<void> {
    // Check access
    const canAccess = await this.jobsService.canUserAccessJob(
      id,
      user.userId,
      user.role,
      user.proProfileId,
    );

    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this job');
    }

    await this.jobsService.deleteAttachment(attachmentId, user.userId);
  }

  // ============================================
  // PRESIGNED UPLOAD URL
  // ============================================

  @Post(':id/upload-url')
  @ApiOperation({ summary: 'Get presigned URL for file upload' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Presigned URL generated successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async getUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignedUrlRequestDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    // Check access
    const canAccess = await this.jobsService.canUserAccessJob(
      id,
      user.userId,
      user.role,
      user.proProfileId,
    );

    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this job');
    }

    return this.jobsService.getPresignedUploadUrl(id, dto);
  }

  // ============================================
  // STATUS HISTORY
  // ============================================

  @Get(':id/status-history')
  @ApiOperation({ summary: 'Get job status change history' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status history retrieved successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async getStatusHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<any[]> {
    // Check access
    const canAccess = await this.jobsService.canUserAccessJob(
      id,
      user.userId,
      user.role,
      user.proProfileId,
    );

    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this job');
    }

    return this.jobStatusService.getStatusHistory(id);
  }

  // ============================================
  // VALID TRANSITIONS
  // ============================================

  @Get(':id/valid-transitions')
  @ApiOperation({ summary: 'Get valid status transitions for a job' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Valid transitions retrieved successfully',
  })
  async getValidTransitions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ currentStatus: string; validTransitions: string[] }> {
    // Check access
    const canAccess = await this.jobsService.canUserAccessJob(
      id,
      user.userId,
      user.role,
      user.proProfileId,
    );

    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this job');
    }

    const job = await this.jobsService.getJob(id);
    const validTransitions = this.jobStatusService.getValidTransitions(
      job.status as JobStatus,
    );

    return {
      currentStatus: job.status,
      validTransitions,
    };
  }
}
