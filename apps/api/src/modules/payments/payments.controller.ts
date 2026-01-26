import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Headers,
  RawBodyRequest,
  Req,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentIntentDto,
  CapturePaymentDto,
  RefundPaymentDto,
  PaymentIntentResponseDto,
  PaymentStatusResponseDto,
  RefundResponseDto,
  WebhookResponseDto,
} from './dto/payments.dto';

/**
 * PaymentsController - Payment Processing API Endpoints
 *
 * PHASE 2 STRIPE INTEGRATION PLAN:
 * ================================
 * 1. Add authentication guards:
 *    - @UseGuards(JwtAuthGuard) for protected endpoints
 *    - Role-based access (SMB_USER can create payments, PRO_USER can view)
 *
 * 2. Webhook endpoint security:
 *    - Verify Stripe signature using stripe.webhooks.constructEvent()
 *    - Use @RawBody() decorator to get raw request body
 *    - Store webhook secret in environment
 *
 * 3. Rate limiting:
 *    - Add @Throttle() decorator for payment endpoints
 *    - Prevent abuse of payment creation
 *
 * 4. Idempotency:
 *    - Accept Idempotency-Key header
 *    - Pass to Stripe API for safe retries
 *
 * 5. Error handling:
 *    - Map Stripe errors to appropriate HTTP status codes
 *    - StripeCardError -> 402 Payment Required
 *    - StripeInvalidRequestError -> 400 Bad Request
 *    - StripeRateLimitError -> 429 Too Many Requests
 *
 * 6. Audit logging:
 *    - Log all payment operations with user context
 *    - Store payment events for compliance
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Create a new payment intent
   *
   * Phase 2:
   * - Add @UseGuards(JwtAuthGuard)
   * - Extract user ID from JWT for metadata
   * - Add idempotency key support
   */
  @Post('intent')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a payment intent',
    description: 'Creates a new Stripe payment intent for processing a payment. Returns a client secret for frontend payment confirmation.',
  })
  @ApiBody({ type: CreatePaymentIntentDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Payment intent created successfully',
    type: PaymentIntentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid payment parameters',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponseDto> {
    this.logger.log(`POST /payments/intent - Creating payment intent`);
    return this.paymentsService.createPaymentIntent(dto);
  }

  /**
   * Capture an authorized payment
   *
   * Phase 2:
   * - Add @UseGuards(JwtAuthGuard, RolesGuard)
   * - Verify user has permission to capture this payment
   */
  @Post('capture/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Capture a payment',
    description: 'Captures a previously authorized payment. Use for escrow-style payments where funds are held before capture.',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment intent ID to capture',
    example: 'pi_mock_abc123',
  })
  @ApiBody({ type: CapturePaymentDto, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment captured successfully',
    type: PaymentStatusResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payment intent not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Payment cannot be captured (already captured, cancelled, etc.)',
  })
  async capturePayment(
    @Param('id') id: string,
    @Body() dto?: CapturePaymentDto,
  ): Promise<PaymentStatusResponseDto> {
    this.logger.log(`POST /payments/capture/${id} - Capturing payment`);
    return this.paymentsService.capturePayment(id, dto);
  }

  /**
   * Refund a payment
   *
   * Phase 2:
   * - Add @UseGuards(JwtAuthGuard, RolesGuard)
   * - Only allow admins or original payment creator to refund
   * - Log refund reason for compliance
   */
  @Post('refund/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Refund a payment',
    description: 'Initiates a full or partial refund for a captured payment.',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment intent ID to refund',
    example: 'pi_mock_abc123',
  })
  @ApiBody({ type: RefundPaymentDto, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refund processed successfully',
    type: RefundResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payment intent not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Payment cannot be refunded (not captured, already refunded, etc.)',
  })
  async refundPayment(
    @Param('id') id: string,
    @Body() dto?: RefundPaymentDto,
  ): Promise<RefundResponseDto> {
    this.logger.log(`POST /payments/refund/${id} - Processing refund`);
    return this.paymentsService.refundPayment(id, dto);
  }

  /**
   * Get payment status
   *
   * Phase 2:
   * - Add @UseGuards(JwtAuthGuard)
   * - Verify user has access to view this payment
   */
  @Get(':id/status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payment status',
    description: 'Retrieves the current status of a payment intent.',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment intent ID',
    example: 'pi_mock_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment status retrieved successfully',
    type: PaymentStatusResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Payment intent not found',
  })
  async getPaymentStatus(
    @Param('id') id: string,
  ): Promise<PaymentStatusResponseDto> {
    this.logger.log(`GET /payments/${id}/status - Getting payment status`);
    return this.paymentsService.getPaymentStatus(id);
  }

  /**
   * Handle Stripe webhook events
   *
   * Phase 2 Implementation:
   * ```
   * @Post('webhook')
   * async handleWebhook(
   *   @Headers('stripe-signature') signature: string,
   *   @Req() request: RawBodyRequest<Request>,
   * ) {
   *   const rawBody = request.rawBody;
   *
   *   try {
   *     const event = this.stripe.webhooks.constructEvent(
   *       rawBody,
   *       signature,
   *       config.STRIPE_WEBHOOK_SECRET
   *     );
   *     return this.paymentsService.handleWebhook(event.type, event.data.object);
   *   } catch (err) {
   *     this.logger.error(`Webhook signature verification failed: ${err.message}`);
   *     throw new BadRequestException('Invalid webhook signature');
   *   }
   * }
   * ```
   *
   * IMPORTANT: This endpoint must:
   * - NOT have authentication guards (Stripe calls it directly)
   * - Verify the Stripe signature
   * - Return 200 quickly to acknowledge receipt
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle Stripe webhook',
    description: 'Receives and processes Stripe webhook events. This endpoint is called by Stripe and should not be called directly.',
  })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature for verification',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook received and processed',
    type: WebhookResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid webhook signature or payload',
  })
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
    @Body() body: { type: string; data: { object: Record<string, unknown> } },
  ): Promise<WebhookResponseDto> {
    this.logger.log(`POST /payments/webhook - Received webhook event: ${body.type}`);

    // STUB: In Phase 2, verify signature using rawBody
    // const rawBody = request.rawBody;
    // const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (!signature) {
      this.logger.warn('Webhook received without signature - accepting for development');
    }

    return this.paymentsService.handleWebhook(body.type, body.data?.object || {});
  }

  /**
   * Create Stripe Connect onboarding link for a Pro
   *
   * Phase 2:
   * - Add @UseGuards(JwtAuthGuard, RolesGuard)
   * - Only PRO_USER role can access
   * - Extract proProfileId from JWT
   */
  @Post('connect/onboard')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start Stripe Connect onboarding',
    description: 'Creates a Stripe Connected Account for a Pro and returns the onboarding URL.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Connected account created, onboarding URL provided',
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', example: 'acct_mock_abc123' },
        onboardingUrl: { type: 'string', example: 'https://connect.stripe.com/setup/mock/acct_mock_abc123' },
        status: { type: 'string', example: 'pending' },
      },
    },
  })
  async createConnectedAccount(
    @Body() body: { proProfileId: string },
  ): Promise<{ accountId: string; onboardingUrl: string; status: string }> {
    this.logger.log(`POST /payments/connect/onboard - Creating connected account for pro: ${body.proProfileId}`);
    return this.paymentsService.createConnectedAccount(body.proProfileId);
  }

  /**
   * Get Stripe Connect account status for a Pro
   *
   * Phase 2:
   * - Add @UseGuards(JwtAuthGuard)
   * - PRO_USER can view own status, ADMIN can view any
   */
  @Get('connect/status/:proProfileId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Stripe Connect account status',
    description: 'Retrieves the status of a Pro\'s Stripe Connected Account.',
  })
  @ApiParam({
    name: 'proProfileId',
    description: 'Pro profile ID',
    example: 'pro_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account status retrieved',
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', example: 'acct_mock_abc123' },
        chargesEnabled: { type: 'boolean', example: true },
        payoutsEnabled: { type: 'boolean', example: true },
        detailsSubmitted: { type: 'boolean', example: true },
        status: { type: 'string', example: 'active' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pro profile or connected account not found',
  })
  async getConnectedAccountStatus(
    @Param('proProfileId') proProfileId: string,
  ): Promise<{
    accountId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    status: string;
  }> {
    this.logger.log(`GET /payments/connect/status/${proProfileId} - Getting account status`);
    return this.paymentsService.getAccountStatus(proProfileId);
  }
}
