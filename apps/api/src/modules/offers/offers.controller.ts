import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { OfferLeadsService } from './offer-leads.service';
import { OfferComplianceService } from './offer-compliance.service';
import {
  CreateOfferCampaignDto,
  UpdateOfferCampaignDto,
  SubmitLeadDto,
  UpdateLeadStatusDto,
  OfferCampaignResponseDto,
  OfferCampaignsListResponseDto,
  PublicOfferResponseDto,
  OfferLeadResponseDto,
  OfferLeadsListResponseDto,
  LeadSubmissionResponseDto,
  OfferStatsResponseDto,
  OffersQueryDto,
  LeadsQueryDto,
} from './dto/offers.dto';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@trades/shared';

/**
 * OffersController - API endpoints for offer campaign management
 *
 * Feature Flags:
 * - OFFER_CAMPAIGNS_ENABLED: Gates the entire module
 *
 * Endpoints:
 * - Public: View active offers, submit leads
 * - Admin: Full campaign and lead management
 */
@ApiTags('Offers')
@Controller()
export class OffersController {
  constructor(
    private readonly offersService: OffersService,
    private readonly leadsService: OfferLeadsService,
    private readonly complianceService: OfferComplianceService,
  ) {}

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  /**
   * Get public offer by slug (no auth required)
   */
  @Get('offers/:slug')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get public offer',
    description: 'View an active offer by its URL slug. No authentication required.',
  })
  @ApiParam({ name: 'slug', description: 'Offer URL slug' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Offer retrieved successfully',
    type: PublicOfferResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Offer not found, not active, or expired',
  })
  async getPublicOffer(@Param('slug') slug: string): Promise<PublicOfferResponseDto> {
    return this.offersService.getPublicOffer(slug);
  }

  /**
   * Submit lead for an offer (no auth required)
   */
  @Post('offers/:slug/submit')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit lead',
    description: 'Submit contact information for an offer. Captures marketing consent.',
  })
  @ApiParam({ name: 'slug', description: 'Offer URL slug' })
  @ApiBody({ type: SubmitLeadDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Lead submitted successfully',
    type: LeadSubmissionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or consent not provided when required',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Offer not found or not active',
  })
  async submitLead(
    @Param('slug') slug: string,
    @Body() dto: SubmitLeadDto,
  ): Promise<LeadSubmissionResponseDto> {
    return this.leadsService.submitLead(slug, dto);
  }

  // ============================================
  // ADMIN ENDPOINTS - CAMPAIGNS
  // ============================================

  /**
   * List all campaigns (Admin)
   */
  @Get('admin/offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List campaigns',
    description: 'List all offer campaigns with filters. Admin/Operator only.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaigns retrieved successfully',
    type: OfferCampaignsListResponseDto,
  })
  async listCampaigns(@Query() query: OffersQueryDto): Promise<OfferCampaignsListResponseDto> {
    return this.offersService.listCampaigns(query);
  }

  /**
   * Create new campaign (Admin)
   */
  @Post('admin/offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create campaign',
    description: 'Create a new offer campaign. Admin only.',
  })
  @ApiBody({ type: CreateOfferCampaignDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Campaign created successfully',
    type: OfferCampaignResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or slug already taken',
  })
  async createCampaign(
    @Body() dto: CreateOfferCampaignDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<OfferCampaignResponseDto> {
    return this.offersService.createCampaign(dto, user.userId);
  }

  /**
   * Get campaign by ID (Admin)
   */
  @Get('admin/offers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get campaign',
    description: 'Get campaign details by ID.',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign retrieved successfully',
    type: OfferCampaignResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Campaign not found',
  })
  async getCampaign(@Param('id') id: string): Promise<OfferCampaignResponseDto> {
    return this.offersService.getCampaign(id);
  }

  /**
   * Update campaign (Admin)
   */
  @Put('admin/offers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update campaign',
    description: 'Update an offer campaign.',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiBody({ type: UpdateOfferCampaignDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign updated successfully',
    type: OfferCampaignResponseDto,
  })
  async updateCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateOfferCampaignDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<OfferCampaignResponseDto> {
    return this.offersService.updateCampaign(id, dto, user.userId);
  }

  /**
   * Activate campaign (Admin)
   */
  @Put('admin/offers/:id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate campaign',
    description: 'Make a campaign live and accessible to the public.',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign activated successfully',
    type: OfferCampaignResponseDto,
  })
  async activateCampaign(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<OfferCampaignResponseDto> {
    return this.offersService.activateCampaign(id, user.userId);
  }

  /**
   * Pause campaign (Admin)
   */
  @Put('admin/offers/:id/pause')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pause campaign',
    description: 'Temporarily pause an active campaign.',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign paused successfully',
    type: OfferCampaignResponseDto,
  })
  async pauseCampaign(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<OfferCampaignResponseDto> {
    return this.offersService.pauseCampaign(id, user.userId);
  }

  /**
   * Archive campaign (Admin)
   */
  @Put('admin/offers/:id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Archive campaign',
    description: 'Archive a campaign. Cannot be undone.',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign archived successfully',
    type: OfferCampaignResponseDto,
  })
  async archiveCampaign(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<OfferCampaignResponseDto> {
    return this.offersService.archiveCampaign(id, user.userId);
  }

  /**
   * Get campaign stats (Admin)
   */
  @Get('admin/offers/:id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get campaign stats',
    description: 'Get statistics for a campaign.',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Stats retrieved successfully',
    type: OfferStatsResponseDto,
  })
  async getCampaignStats(@Param('id') id: string): Promise<OfferStatsResponseDto> {
    return this.offersService.getCampaignStats(id);
  }

  // ============================================
  // ADMIN ENDPOINTS - LEADS
  // ============================================

  /**
   * Get leads for a campaign (Admin)
   */
  @Get('admin/offers/:id/leads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get campaign leads',
    description: 'List all leads for a campaign with filters.',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Leads retrieved successfully',
    type: OfferLeadsListResponseDto,
  })
  async getCampaignLeads(
    @Param('id') id: string,
    @Query() query: LeadsQueryDto,
  ): Promise<OfferLeadsListResponseDto> {
    return this.leadsService.getLeadsForCampaign(id, query);
  }

  /**
   * Get lead by ID (Admin)
   */
  @Get('admin/leads/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get lead',
    description: 'Get lead details by ID.',
  })
  @ApiParam({ name: 'id', description: 'Lead ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lead retrieved successfully',
    type: OfferLeadResponseDto,
  })
  async getLead(@Param('id') id: string): Promise<OfferLeadResponseDto> {
    return this.leadsService.getLead(id);
  }

  /**
   * Update lead status (Admin)
   */
  @Put('admin/leads/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update lead status',
    description: 'Update the status of a lead.',
  })
  @ApiParam({ name: 'id', description: 'Lead ID' })
  @ApiBody({ type: UpdateLeadStatusDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status updated successfully',
    type: OfferLeadResponseDto,
  })
  async updateLeadStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<OfferLeadResponseDto> {
    return this.leadsService.updateLeadStatus(id, dto, user.userId);
  }

  /**
   * Record follow-up (Admin)
   */
  @Post('admin/leads/:id/follow-up')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record follow-up',
    description: 'Record a follow-up contact attempt.',
  })
  @ApiParam({ name: 'id', description: 'Lead ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Follow-up recorded successfully',
    type: OfferLeadResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Maximum follow-ups reached',
  })
  async recordFollowUp(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @CurrentUser() user: CurrentUserData,
  ): Promise<OfferLeadResponseDto> {
    return this.leadsService.recordFollowUp(id, body.notes ?? '', user.userId);
  }

  /**
   * Get leads requiring follow-up (Admin)
   */
  @Get('admin/leads/follow-up-queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get follow-up queue',
    description: 'Get leads that need follow-up contact.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue retrieved successfully',
    type: [OfferLeadResponseDto],
  })
  async getFollowUpQueue(): Promise<OfferLeadResponseDto[]> {
    return this.leadsService.getLeadsRequiringFollowUp();
  }

  // ============================================
  // ADMIN ENDPOINTS - COMPLIANCE
  // ============================================

  /**
   * Get compliance report (Admin)
   */
  @Get('admin/offers/:id/compliance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get compliance report',
    description: 'Get compliance metrics for a campaign.',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report retrieved successfully',
  })
  async getComplianceReport(@Param('id') id: string) {
    return this.complianceService.getCampaignComplianceReport(id);
  }

  /**
   * Validate campaign compliance (Admin)
   */
  @Get('admin/offers/:id/compliance/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate campaign compliance',
    description: 'Check if campaign configuration is compliant.',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation result',
  })
  async validateCompliance(@Param('id') id: string) {
    return this.complianceService.validateCampaignCompliance(id);
  }

  /**
   * Process opt-out request (Admin)
   */
  @Post('admin/leads/opt-out')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process opt-out',
    description: 'Process a marketing opt-out request for an email address.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Opt-out processed successfully',
  })
  async processOptOut(
    @Body() body: { email: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.complianceService.processOptOut(body.email, user.userId);
  }
}
