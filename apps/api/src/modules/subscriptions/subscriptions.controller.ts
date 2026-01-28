import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { SubscriptionsService } from './subscriptions.service';
import { ServicePlansService } from './service-plans.service';
import { OccurrenceSchedulerService } from './occurrence-scheduler.service';
import {
  CreateSubscriptionDto,
  SubscriptionResponseDto,
  PauseSubscriptionDto,
  CancelSubscriptionDto,
  CheckoutSessionResponseDto,
  ServicePlanResponseDto,
  ServicePlansListResponseDto,
  ServicePlansQueryDto,
  OccurrencesListResponseDto,
  OccurrencesQueryDto,
  ServiceOccurrenceResponseDto,
  SkipOccurrenceDto,
  RescheduleOccurrenceDto,
} from './dto/subscriptions.dto';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@trades/shared';

/**
 * SubscriptionsController - API endpoints for subscription management
 *
 * Feature Flags:
 * - SUBSCRIPTIONS_ENABLED: Gates the entire module
 *
 * Endpoints are organized into:
 * - Service Plans (public listing, admin management)
 * - Subscriptions (consumer operations)
 * - Occurrences (schedule management)
 */
@ApiTags('Subscriptions')
@Controller()
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly servicePlansService: ServicePlansService,
    private readonly occurrenceSchedulerService: OccurrenceSchedulerService,
  ) {}

  // ============================================
  // SERVICE PLANS ENDPOINTS
  // ============================================

  /**
   * List available service plans (public)
   */
  @Get('service-plans')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List service plans',
    description: 'List all available service plans. Requires SUBSCRIPTIONS_ENABLED feature flag.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service plans retrieved successfully',
    type: ServicePlansListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Subscriptions feature is not enabled',
  })
  async listServicePlans(
    @Query() query: ServicePlansQueryDto,
  ): Promise<ServicePlansListResponseDto> {
    return this.servicePlansService.listPlans(query);
  }

  /**
   * Get service plan details (public)
   */
  @Get('service-plans/:id')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get service plan',
    description: 'Get details of a specific service plan.',
  })
  @ApiParam({ name: 'id', description: 'Service plan ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service plan retrieved successfully',
    type: ServicePlanResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Service plan not found',
  })
  async getServicePlan(@Param('id') id: string): Promise<ServicePlanResponseDto> {
    return this.servicePlansService.getPlanById(id);
  }

  // ============================================
  // SUBSCRIPTION ENDPOINTS
  // ============================================

  /**
   * Create a new subscription (initiates checkout)
   */
  @Post('subscriptions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create subscription',
    description: 'Create a new subscription. Returns a checkout session for payment.',
  })
  @ApiBody({ type: CreateSubscriptionDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Checkout session created',
    type: CheckoutSessionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or already subscribed',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Consumer profile or service plan not found',
  })
  async createSubscription(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<CheckoutSessionResponseDto> {
    return this.subscriptionsService.createSubscription(user.userId, dto);
  }

  /**
   * Get subscription details
   */
  @Get('subscriptions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get subscription',
    description: 'Get details of a specific subscription.',
  })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription retrieved successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied',
  })
  async getSubscription(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.getSubscription(id, user.userId);
  }

  /**
   * Pause a subscription
   */
  @Put('subscriptions/:id/pause')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pause subscription',
    description: 'Pause an active subscription.',
  })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiBody({ type: PauseSubscriptionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription paused successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Can only pause active subscriptions',
  })
  async pauseSubscription(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: PauseSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.pauseSubscription(id, user.userId, dto);
  }

  /**
   * Resume a paused subscription
   */
  @Put('subscriptions/:id/resume')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resume subscription',
    description: 'Resume a paused subscription.',
  })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription resumed successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Can only resume paused subscriptions',
  })
  async resumeSubscription(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.resumeSubscription(id, user.userId);
  }

  /**
   * Cancel a subscription
   */
  @Delete('subscriptions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel subscription',
    description: 'Cancel a subscription. Can cancel immediately or at end of period.',
  })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiBody({ type: CancelSubscriptionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription cancelled successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Subscription already cancelled',
  })
  async cancelSubscription(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.cancelSubscription(id, user.userId, dto);
  }

  // ============================================
  // OCCURRENCE ENDPOINTS
  // ============================================

  /**
   * Get occurrences for a subscription
   */
  @Get('subscriptions/:id/occurrences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get subscription occurrences',
    description: 'Get scheduled service occurrences for a subscription.',
  })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Occurrences retrieved successfully',
    type: OccurrencesListResponseDto,
  })
  async getOccurrences(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Query() query: OccurrencesQueryDto,
  ): Promise<OccurrencesListResponseDto> {
    // Verify access
    await this.subscriptionsService.getSubscription(id, user.userId);

    return this.occurrenceSchedulerService.getOccurrences(id, query);
  }

  /**
   * Skip an occurrence
   */
  @Put('occurrences/:id/skip')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Skip occurrence',
    description: 'Skip a scheduled service occurrence.',
  })
  @ApiParam({ name: 'id', description: 'Occurrence ID' })
  @ApiBody({ type: SkipOccurrenceDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Occurrence skipped successfully',
    type: ServiceOccurrenceResponseDto,
  })
  async skipOccurrence(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SkipOccurrenceDto,
  ): Promise<ServiceOccurrenceResponseDto> {
    return this.occurrenceSchedulerService.skipOccurrence(id, dto, user.userId);
  }

  /**
   * Reschedule an occurrence
   */
  @Put('occurrences/:id/reschedule')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reschedule occurrence',
    description: 'Reschedule a service occurrence to a new date.',
  })
  @ApiParam({ name: 'id', description: 'Occurrence ID' })
  @ApiBody({ type: RescheduleOccurrenceDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Occurrence rescheduled successfully',
    type: ServiceOccurrenceResponseDto,
  })
  async rescheduleOccurrence(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RescheduleOccurrenceDto,
  ): Promise<ServiceOccurrenceResponseDto> {
    return this.occurrenceSchedulerService.rescheduleOccurrence(id, dto, user.userId);
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  /**
   * Trigger occurrence processing (Admin)
   * P2: This will be replaced by a scheduled BullMQ worker
   */
  @Post('admin/subscriptions/process-occurrences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process scheduled occurrences',
    description: 'Manually trigger job creation from scheduled occurrences. Admin only.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Occurrences processed',
  })
  async processOccurrences(): Promise<{
    processed: number;
    jobsCreated: number;
    errors: string[];
  }> {
    return this.occurrenceSchedulerService.processScheduledOccurrences();
  }
}
