import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';

import { LeadsService } from './leads.service';
import {
  WebLeadDto,
  WebhookLeadDto,
  EmailLeadDto,
  LeadQueryDto,
  ConvertLeadDto,
  LeadSubmitResponseDto,
  LeadNormalizedResponseDto,
  LeadConvertResponseDto,
  PaginatedLeadsResponseDto,
} from './dto/leads.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole, LeadStatus } from '@trades/shared';
import { ConfigService } from '@nestjs/config';

@ApiTags('Leads')
@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================
  // PUBLIC ENDPOINTS (Rate Limited)
  // ============================================

  @Post('web')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit web form lead',
    description: 'Submit a lead from a web form. Public endpoint with rate limiting.',
  })
  @ApiResponse({
    status: 201,
    description: 'Lead submitted successfully',
    type: LeadSubmitResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid lead data',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - rate limit exceeded',
  })
  async submitWebLead(
    @Body() dto: WebLeadDto,
    @Req() req: Request,
  ): Promise<LeadSubmitResponseDto> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.headers['user-agent'];

    return this.leadsService.submitWebLead(dto, ipAddress, userAgent);
  }

  @Post('webhook')
  @SkipThrottle() // Webhooks have their own auth mechanism
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit webhook lead',
    description:
      'Submit a lead from an external webhook source. Requires API key authentication via X-API-Key header.',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API key for webhook authentication',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook lead received successfully',
    type: LeadSubmitResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing API key',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid payload',
  })
  async submitWebhookLead(
    @Body() dto: WebhookLeadDto,
    @Headers('x-api-key') apiKey: string,
    @Req() req: Request,
  ): Promise<LeadSubmitResponseDto> {
    // Validate API key
    const validApiKey = this.configService.get<string>('WEBHOOK_API_KEY');
    if (!apiKey || apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    const ipAddress = this.getClientIp(req);
    const userAgent = req.headers['user-agent'];

    return this.leadsService.submitWebhookLead(
      dto,
      dto.source,
      ipAddress,
      userAgent,
    );
  }

  @Post('email')
  @Public()
  @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 requests per minute for email webhooks
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit email webhook lead (stub)',
    description:
      'Submit a lead from an email parsing webhook. This is a stub endpoint for future email integration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email lead received',
    type: LeadSubmitResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - rate limit exceeded',
  })
  async submitEmailLead(
    @Body() dto: EmailLeadDto,
    @Req() req: Request,
  ): Promise<LeadSubmitResponseDto> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.headers['user-agent'];

    return this.leadsService.submitEmailLead(dto, ipAddress, userAgent);
  }

  // ============================================
  // PROTECTED ENDPOINTS (Admin/Operator)
  // ============================================

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List leads',
    description: 'Query leads with filters and pagination. Requires Admin or Operator role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of leads',
    type: PaginatedLeadsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Operator role required',
  })
  async getLeads(@Query() query: LeadQueryDto): Promise<PaginatedLeadsResponseDto> {
    return this.leadsService.getLeads(query);
  }

  @Get('status/:status')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get leads by status',
    description: 'Get all leads with a specific status. Requires Admin or Operator role.',
  })
  @ApiParam({
    name: 'status',
    description: 'Lead status to filter by',
    enum: LeadStatus,
  })
  @ApiResponse({
    status: 200,
    description: 'List of leads with the specified status',
    type: [LeadNormalizedResponseDto],
  })
  async getLeadsByStatus(
    @Param('status') status: LeadStatus,
  ): Promise<LeadNormalizedResponseDto[]> {
    return this.leadsService.getLeadsByStatus(status);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get lead details',
    description: 'Get detailed information about a specific lead. Requires Admin or Operator role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Lead ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Lead details',
    type: LeadNormalizedResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Lead not found',
  })
  async getLead(@Param('id') id: string): Promise<LeadNormalizedResponseDto> {
    return this.leadsService.getLead(id);
  }

  @Post(':id/convert')
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Convert lead to job',
    description:
      'Convert a normalized lead into a job. Requires Operator or Admin role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Lead ID to convert',
    type: String,
  })
  @ApiBody({
    type: ConvertLeadDto,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Lead successfully converted to job',
    type: LeadConvertResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid lead or missing required data',
  })
  @ApiResponse({
    status: 404,
    description: 'Lead not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Lead already converted',
  })
  async convertToJob(
    @Param('id') id: string,
    @Body() dto: ConvertLeadDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<LeadConvertResponseDto> {
    return this.leadsService.convertToJob(id, user.userId, dto);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private getClientIp(req: Request): string | undefined {
    // Check for forwarded IP (behind proxy/load balancer)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    // Check for real IP header (Cloudflare, etc.)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to connection remote address
    return req.ip || req.socket?.remoteAddress;
  }
}
