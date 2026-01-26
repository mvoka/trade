import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OperatorService } from './operator.service';
import {
  JobQueueQueryDto,
  ManualDispatchDto,
  EscalationOverrideDto,
  InternalNoteDto,
  PaginatedJobQueueResponseDto,
  JobDetailsResponseDto,
  InternalNoteResponseDto,
  SlaBreachAlertDto,
  EscalatedJobDto,
  ManualDispatchResponseDto,
  EscalationOverrideResponseDto,
} from './dto/operator.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@trades/shared';

@ApiTags('Operator')
@ApiBearerAuth()
@Controller('operator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.ADMIN)
export class OperatorController {
  constructor(private readonly operatorService: OperatorService) {}

  /**
   * Get job queue with filters
   */
  @Get('queue')
  @ApiOperation({
    summary: 'Get job queue',
    description: 'Get jobs awaiting action with optional filters for status, date range, SLA breaches, and escalations.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job queue retrieved successfully',
    type: PaginatedJobQueueResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async getJobQueue(
    @Query() query: JobQueueQueryDto,
  ): Promise<PaginatedJobQueueResponseDto> {
    return this.operatorService.getJobQueue(query);
  }

  /**
   * Get job details
   */
  @Get('jobs/:id')
  @ApiOperation({
    summary: 'Get job details',
    description: 'Get full job details including dispatch history and internal notes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Job ID',
    example: 'clx1234567890',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job details retrieved successfully',
    type: JobDetailsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async getJobDetails(@Param('id') jobId: string): Promise<JobDetailsResponseDto> {
    return this.operatorService.getJobDetails(jobId);
  }

  /**
   * Manual dispatch job to pro
   */
  @Post('jobs/:id/dispatch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manual dispatch',
    description: 'Manually assign a job to a specific pro. Cancels any pending dispatch attempts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Job ID',
    example: 'clx1234567890',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job dispatched successfully',
    type: ManualDispatchResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request or job cannot be dispatched',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job or pro not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async manualDispatch(
    @Param('id') jobId: string,
    @Body() dto: ManualDispatchDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ManualDispatchResponseDto> {
    return this.operatorService.manualDispatch(jobId, dto, user.userId);
  }

  /**
   * Override escalation
   */
  @Post('jobs/:id/escalation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Override escalation',
    description: 'Override the current escalation step for a job. Can resolve, reassign, cancel, or escalate further.',
  })
  @ApiParam({
    name: 'id',
    description: 'Job ID',
    example: 'clx1234567890',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Escalation overridden successfully',
    type: EscalationOverrideResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request or missing required fields',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async overrideEscalation(
    @Param('id') jobId: string,
    @Body() dto: EscalationOverrideDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<EscalationOverrideResponseDto> {
    return this.operatorService.overrideEscalation(jobId, dto, user.userId);
  }

  /**
   * Add internal note to job
   */
  @Post('jobs/:id/notes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add internal note',
    description: 'Add an internal note to a job. Notes are only visible to operators and admins.',
  })
  @ApiParam({
    name: 'id',
    description: 'Job ID',
    example: 'clx1234567890',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Note added successfully',
    type: InternalNoteResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async addInternalNote(
    @Param('id') jobId: string,
    @Body() dto: InternalNoteDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<InternalNoteResponseDto> {
    return this.operatorService.addInternalNote(jobId, user.userId, dto);
  }

  /**
   * Get internal notes for a job
   */
  @Get('jobs/:id/notes')
  @ApiOperation({
    summary: 'Get internal notes',
    description: 'Get all internal notes for a job.',
  })
  @ApiParam({
    name: 'id',
    description: 'Job ID',
    example: 'clx1234567890',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notes retrieved successfully',
    type: [InternalNoteResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async getInternalNotes(
    @Param('id') jobId: string,
  ): Promise<InternalNoteResponseDto[]> {
    return this.operatorService.getInternalNotes(jobId);
  }

  /**
   * Get SLA breach alerts
   */
  @Get('sla-breaches')
  @ApiOperation({
    summary: 'Get SLA breach alerts',
    description: 'Get all jobs with SLA breaches. These are jobs where the dispatch response deadline has passed.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'SLA breach alerts retrieved successfully',
    type: [SlaBreachAlertDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async getSlaBreachAlerts(): Promise<SlaBreachAlertDto[]> {
    return this.operatorService.getSlaBreachAlerts();
  }

  /**
   * Get escalated jobs
   */
  @Get('escalations')
  @ApiOperation({
    summary: 'Get escalated jobs',
    description: 'Get all jobs that have escalated. These are jobs with multiple dispatch attempts where no pro has accepted.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Escalated jobs retrieved successfully',
    type: [EscalatedJobDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async getEscalatedJobs(): Promise<EscalatedJobDto[]> {
    return this.operatorService.getEscalatedJobs();
  }
}
