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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import {
  CreateDeclineReasonDto,
  UpdateDeclineReasonDto,
  DeclineReasonResponseDto,
  CreateJobTemplateDto,
  UpdateJobTemplateDto,
  JobTemplateResponseDto,
  DispatchLogQueryDto,
  PaginatedDispatchLogResponseDto,
  SlaBreachQueryDto,
  SlaBreachReportDto,
  DashboardStatsDto,
} from './dto/admin.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@trades/shared';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============================================
  // DASHBOARD
  // ============================================

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description:
      'Retrieve platform-wide statistics including jobs, pros, bookings, and dispatch metrics. Admin access only.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard statistics retrieved successfully',
    type: DashboardStatsDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async getDashboardStats(): Promise<DashboardStatsDto> {
    return this.adminService.getDashboardStats();
  }

  // ============================================
  // DECLINE REASONS
  // ============================================

  @Get('decline-reasons')
  @ApiOperation({
    summary: 'List all decline reasons',
    description:
      'Retrieve all dispatch decline reasons configured in the system. Admin access only.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Decline reasons retrieved successfully',
    type: [DeclineReasonResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async getDeclineReasons(): Promise<DeclineReasonResponseDto[]> {
    return this.adminService.getDeclineReasons();
  }

  @Post('decline-reasons')
  @ApiOperation({
    summary: 'Create a new decline reason',
    description:
      'Create a new dispatch decline reason. Admin access only.',
  })
  @ApiBody({ type: CreateDeclineReasonDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Decline reason created successfully',
    type: DeclineReasonResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Decline reason with this code already exists',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async createDeclineReason(
    @Body() dto: CreateDeclineReasonDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DeclineReasonResponseDto> {
    return this.adminService.createDeclineReason(dto, user?.id);
  }

  @Put('decline-reasons/:id')
  @ApiOperation({
    summary: 'Update a decline reason',
    description:
      'Update an existing dispatch decline reason. Admin access only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Decline reason ID',
    example: 'clx1234567890',
  })
  @ApiBody({ type: UpdateDeclineReasonDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Decline reason updated successfully',
    type: DeclineReasonResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Decline reason not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async updateDeclineReason(
    @Param('id') id: string,
    @Body() dto: UpdateDeclineReasonDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DeclineReasonResponseDto> {
    return this.adminService.updateDeclineReason(id, dto, user?.id);
  }

  @Delete('decline-reasons/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a decline reason',
    description:
      'Delete a dispatch decline reason. If in use, it will be soft-deleted (deactivated). Admin access only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Decline reason ID',
    example: 'clx1234567890',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Decline reason deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Decline reason not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async deleteDeclineReason(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.adminService.deleteDeclineReason(id, user?.id);
  }

  // ============================================
  // JOB TEMPLATES
  // ============================================

  @Get('job-templates')
  @ApiOperation({
    summary: 'List all job templates',
    description:
      'Retrieve all job templates configured in the system. Admin access only.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job templates retrieved successfully',
    type: [JobTemplateResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async getJobTemplates(): Promise<JobTemplateResponseDto[]> {
    return this.adminService.getJobTemplates();
  }

  @Post('job-templates')
  @ApiOperation({
    summary: 'Create a new job template',
    description:
      'Create a new job template. Admin access only.',
  })
  @ApiBody({ type: CreateJobTemplateDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Job template created successfully',
    type: JobTemplateResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async createJobTemplate(
    @Body() dto: CreateJobTemplateDto,
    @CurrentUser() user: AuthUser,
  ): Promise<JobTemplateResponseDto> {
    return this.adminService.createJobTemplate(dto, user?.id);
  }

  @Put('job-templates/:id')
  @ApiOperation({
    summary: 'Update a job template',
    description:
      'Update an existing job template. Admin access only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Job template ID',
    example: 'clx1234567890',
  })
  @ApiBody({ type: UpdateJobTemplateDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job template updated successfully',
    type: JobTemplateResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job template not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async updateJobTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateJobTemplateDto,
    @CurrentUser() user: AuthUser,
  ): Promise<JobTemplateResponseDto> {
    return this.adminService.updateJobTemplate(id, dto, user?.id);
  }

  @Delete('job-templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a job template',
    description:
      'Delete a job template. Admin access only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Job template ID',
    example: 'clx1234567890',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Job template deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job template not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async deleteJobTemplate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.adminService.deleteJobTemplate(id, user?.id);
  }

  // ============================================
  // DISPATCH LOGS
  // ============================================

  @Get('dispatch-logs')
  @ApiOperation({
    summary: 'Get dispatch attempt logs',
    description:
      'Retrieve dispatch attempt logs with optional filters and pagination. Admin access only.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dispatch logs retrieved successfully',
    type: PaginatedDispatchLogResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async getDispatchLogs(
    @Query() query: DispatchLogQueryDto,
  ): Promise<PaginatedDispatchLogResponseDto> {
    return this.adminService.getDispatchLogs(query);
  }

  // ============================================
  // SLA BREACH REPORT
  // ============================================

  @Get('sla-breaches')
  @ApiOperation({
    summary: 'Get SLA breach report',
    description:
      'Generate a report of SLA breaches within the specified date range. Admin access only.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'SLA breach report generated successfully',
    type: SlaBreachReportDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid date range or filters',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async getSlaBreaches(@Query() query: SlaBreachQueryDto): Promise<SlaBreachReportDto> {
    return this.adminService.getSlaBreaches(query);
  }
}
