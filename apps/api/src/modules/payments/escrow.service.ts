import { Injectable, Logger } from '@nestjs/common';

/**
 * Escrow status enum for tracking fund states
 */
export enum EscrowStatus {
  PENDING = 'pending',       // Awaiting funds
  HELD = 'held',            // Funds secured in escrow
  RELEASED = 'released',    // Funds released to pro
  REFUNDED = 'refunded',    // Funds refunded to customer
  PARTIALLY_REFUNDED = 'partially_refunded', // Partial refund issued
  DISPUTED = 'disputed',    // Under dispute
}

/**
 * Escrow transaction record interface
 */
export interface EscrowTransaction {
  id: string;
  jobId: string;
  paymentIntentId: string;
  amount: number;
  heldAmount: number;
  releasedAmount: number;
  refundedAmount: number;
  status: EscrowStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * EscrowService - Funds Holding and Release Management
 *
 * PHASE 2 STRIPE INTEGRATION PLAN:
 * ================================
 * 1. Escrow implementation using Stripe's manual capture:
 *    - holdFunds: Create PaymentIntent with capture_method: 'manual'
 *    - Authorization holds funds for up to 7 days (Stripe limit)
 *
 * 2. Release flow:
 *    - Capture the authorized PaymentIntent
 *    - Create transfer to Pro's Connected Account
 *    - Use Stripe Connect for marketplace transfers
 *
 * 3. Refund flow:
 *    - Cancel uncaptured PaymentIntent (releases hold immediately)
 *    - Or create refund for captured payments
 *
 * 4. For longer escrow periods (>7 days):
 *    - Consider using Stripe Issuing + virtual cards
 *    - Or implement custom escrow with your own bank account
 *    - Track escrow state in database
 *
 * 5. Database schema additions needed:
 *    - escrow_transactions table
 *    - Track: jobId, paymentIntentId, amount, status, timestamps
 *
 * 6. Stripe Connect transfers for pro payouts:
 *    ```
 *    const transfer = await stripe.transfers.create({
 *      amount: releaseAmount,
 *      currency: 'usd',
 *      destination: proStripeAccountId,
 *      transfer_group: jobId,
 *    });
 *    ```
 *
 * 7. Handle edge cases:
 *    - Partial job completion
 *    - Disputes and chargebacks
 *    - Multiple milestone releases
 */
@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  // In-memory mock storage (Phase 2: Replace with database)
  private mockEscrows: Map<string, EscrowTransaction> = new Map();

  /**
   * Hold funds in escrow for a job
   *
   * Phase 2 Implementation:
   * ```
   * // Create PaymentIntent with manual capture
   * const paymentIntent = await this.stripe.paymentIntents.create({
   *   amount,
   *   currency: 'usd',
   *   capture_method: 'manual',
   *   metadata: { jobId },
   *   transfer_group: jobId, // For Connect transfers
   * });
   *
   * // After customer confirms payment:
   * // The funds are authorized but not captured
   * // Save to database for tracking
   * ```
   *
   * @param jobId - The job ID to associate with escrow
   * @param amount - Amount in cents to hold
   * @returns Escrow transaction record
   */
  async holdFunds(jobId: string, amount: number): Promise<EscrowTransaction> {
    this.logger.log(`Holding funds in escrow: jobId=${jobId}, amount=${amount}`);

    // STUB: Create mock escrow record
    // Phase 2: Create PaymentIntent with manual capture and store in database
    const mockId = `escrow_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const mockPaymentIntentId = `pi_mock_${Date.now()}`;

    const escrow: EscrowTransaction = {
      id: mockId,
      jobId,
      paymentIntentId: mockPaymentIntentId,
      amount,
      heldAmount: amount,
      releasedAmount: 0,
      refundedAmount: 0,
      status: EscrowStatus.HELD,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.mockEscrows.set(jobId, escrow);
    this.logger.log(`Escrow created: ${mockId} for job: ${jobId}`);
    return escrow;
  }

  /**
   * Release escrowed funds to the pro
   *
   * Phase 2 Implementation:
   * ```
   * // 1. Capture the PaymentIntent
   * await this.stripe.paymentIntents.capture(paymentIntentId);
   *
   * // 2. Transfer to Pro's Connected Account
   * const transfer = await this.stripe.transfers.create({
   *   amount: releaseAmount,
   *   currency: 'usd',
   *   destination: proStripeAccountId,
   *   transfer_group: jobId,
   *   metadata: { jobId, escrowId },
   * });
   *
   * // 3. Update escrow record in database
   * ```
   *
   * @param jobId - The job ID to release funds for
   * @returns Updated escrow transaction
   */
  async releaseFunds(jobId: string): Promise<EscrowTransaction> {
    this.logger.log(`Releasing escrow funds for job: ${jobId}`);

    // STUB: Update mock escrow record
    // Phase 2: Capture PaymentIntent and create Transfer
    const escrow = this.mockEscrows.get(jobId);

    if (!escrow) {
      this.logger.warn(`No escrow found for job: ${jobId}, creating mock response`);
      // Return mock for testing even if not found
      return {
        id: `escrow_mock_release_${Date.now()}`,
        jobId,
        paymentIntentId: `pi_mock_${jobId}`,
        amount: 5000,
        heldAmount: 0,
        releasedAmount: 5000,
        refundedAmount: 0,
        status: EscrowStatus.RELEASED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    escrow.releasedAmount = escrow.heldAmount;
    escrow.heldAmount = 0;
    escrow.status = EscrowStatus.RELEASED;
    escrow.updatedAt = new Date().toISOString();

    this.mockEscrows.set(jobId, escrow);
    this.logger.log(`Escrow released: ${escrow.id} for job: ${jobId}`);
    return escrow;
  }

  /**
   * Refund escrowed funds to the customer
   *
   * Phase 2 Implementation:
   * ```
   * // If not yet captured (authorization only):
   * await this.stripe.paymentIntents.cancel(paymentIntentId);
   *
   * // If already captured:
   * const refund = await this.stripe.refunds.create({
   *   payment_intent: paymentIntentId,
   *   amount: refundAmount, // Optional for partial
   * });
   *
   * // Update escrow record in database
   * ```
   *
   * @param jobId - The job ID to refund
   * @param amount - Optional partial refund amount in cents
   * @returns Updated escrow transaction
   */
  async refundToCustomer(jobId: string, amount?: number): Promise<EscrowTransaction> {
    this.logger.log(`Processing escrow refund for job: ${jobId}, amount: ${amount || 'full'}`);

    // STUB: Update mock escrow record
    // Phase 2: Cancel PaymentIntent or create Refund
    const escrow = this.mockEscrows.get(jobId);

    if (!escrow) {
      this.logger.warn(`No escrow found for job: ${jobId}, creating mock response`);
      const refundAmount = amount || 5000;
      return {
        id: `escrow_mock_refund_${Date.now()}`,
        jobId,
        paymentIntentId: `pi_mock_${jobId}`,
        amount: 5000,
        heldAmount: 0,
        releasedAmount: 0,
        refundedAmount: refundAmount,
        status: refundAmount === 5000 ? EscrowStatus.REFUNDED : EscrowStatus.PARTIALLY_REFUNDED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const refundAmount = amount || escrow.heldAmount;
    const isFullRefund = refundAmount >= escrow.heldAmount;

    escrow.refundedAmount += refundAmount;
    escrow.heldAmount = Math.max(0, escrow.heldAmount - refundAmount);
    escrow.status = isFullRefund ? EscrowStatus.REFUNDED : EscrowStatus.PARTIALLY_REFUNDED;
    escrow.updatedAt = new Date().toISOString();

    this.mockEscrows.set(jobId, escrow);
    this.logger.log(`Escrow refunded: ${escrow.id} for job: ${jobId}, amount: ${refundAmount}`);
    return escrow;
  }

  /**
   * Get the current status of an escrow
   *
   * Phase 2 Implementation:
   * ```
   * // Retrieve from database
   * const escrowRecord = await this.prisma.escrowTransaction.findUnique({
   *   where: { jobId },
   * });
   *
   * // Optionally verify with Stripe
   * const paymentIntent = await this.stripe.paymentIntents.retrieve(
   *   escrowRecord.paymentIntentId
   * );
   * ```
   *
   * @param jobId - The job ID to check escrow for
   * @returns Escrow transaction status
   */
  async getEscrowStatus(jobId: string): Promise<EscrowTransaction> {
    this.logger.log(`Getting escrow status for job: ${jobId}`);

    // STUB: Return mock escrow status
    // Phase 2: Retrieve from database
    const escrow = this.mockEscrows.get(jobId);

    if (!escrow) {
      this.logger.debug(`No escrow found for job: ${jobId}, returning mock pending status`);
      return {
        id: `escrow_mock_${jobId}`,
        jobId,
        paymentIntentId: `pi_mock_${jobId}`,
        amount: 5000,
        heldAmount: 5000,
        releasedAmount: 0,
        refundedAmount: 0,
        status: EscrowStatus.HELD,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    this.logger.log(`Escrow status: ${escrow.status} for job: ${jobId}`);
    return escrow;
  }

  /**
   * Mark escrow as disputed
   *
   * Phase 2 Implementation:
   * - Update database status
   * - Potentially freeze funds
   * - Notify admin for manual review
   *
   * @param jobId - The job ID with dispute
   * @param reason - Reason for dispute
   * @returns Updated escrow transaction
   */
  async markDisputed(jobId: string, reason: string): Promise<EscrowTransaction> {
    this.logger.log(`Marking escrow as disputed for job: ${jobId}, reason: ${reason}`);

    // STUB: Update mock escrow status
    // Phase 2: Update database and notify admin
    const escrow = this.mockEscrows.get(jobId);

    if (!escrow) {
      return {
        id: `escrow_mock_disputed_${Date.now()}`,
        jobId,
        paymentIntentId: `pi_mock_${jobId}`,
        amount: 5000,
        heldAmount: 5000,
        releasedAmount: 0,
        refundedAmount: 0,
        status: EscrowStatus.DISPUTED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    escrow.status = EscrowStatus.DISPUTED;
    escrow.updatedAt = new Date().toISOString();

    this.mockEscrows.set(jobId, escrow);
    this.logger.warn(`Escrow disputed: ${escrow.id} for job: ${jobId}`);
    return escrow;
  }
}
