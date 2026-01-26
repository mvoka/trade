import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
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
import { AuditService } from './audit.service';
import {
  AuditLogQueryDto,
  AuditLogResponseDto,
  PaginatedAuditLogResponseDto,
} from './dto/audit.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@trades/shared';

@ApiTags('Admin - Audit Logs')
@ApiBearerAuth()
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Query audit logs',
    description:
      'Retrieve audit logs with optional filters and pagination. Admin access only.',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    description: 'Filter by action type (e.g., USER_LOGGED_IN, JOB_CREATED)',
    example: 'USER_LOGGED_IN',
  })
  @ApiQuery({
    name: 'actorId',
    required: false,
    description: 'Filter by the ID of the user who performed the action',
  })
  @ApiQuery({
    name: 'targetType',
    required: false,
    description: 'Filter by the type of entity affected (e.g., Job, User)',
    example: 'Job',
  })
  @ApiQuery({
    name: 'targetId',
    required: false,
    description: 'Filter by the ID of the entity affected',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Filter logs from this date (ISO 8601 format)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'Filter logs until this date (ISO 8601 format)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Number of items per page (max 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Field to sort by (createdAt, action, actorId, targetType)',
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order (asc or desc)',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit logs retrieved successfully',
    type: PaginatedAuditLogResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async getAuditLogs(
    @Query() query: AuditLogQueryDto,
  ): Promise<PaginatedAuditLogResponseDto> {
    return this.auditService.getAuditLogs(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get single audit log entry',
    description: 'Retrieve a specific audit log entry by ID. Admin access only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Audit log entry ID',
    example: 'clx1234567890',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit log entry retrieved successfully',
    type: AuditLogResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Audit log entry not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have admin privileges',
  })
  async getAuditLogById(@Param('id') id: string): Promise<AuditLogResponseDto> {
    return this.auditService.getAuditLogById(id);
  }
}
