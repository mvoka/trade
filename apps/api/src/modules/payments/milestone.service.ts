import { Injectable, Logger } from '@nestjs/common';

/**
 * Milestone status enum
 */
export enum MilestoneStatus {
  PENDING = 'pending',           // Created, awaiting work
  IN_PROGRESS = 'in_progress',   // Work started
  COMPLETED = 'completed',       // Work completed, payment released
  CANCELLED = 'cancelled',       // Milestone cancelled
}

/**
 * Milestone record interface
 */
export interface Milestone {
  id: string;
  jobId: string;
  amount: number;
  description: string;
  status: MilestoneStatus;
  order: number;
  paymentIntentId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * MilestoneService - Milestone-Based Payment Management
 *
 * PHASE 2 STRIPE INTEGRATION PLAN:
 * ================================
 * 1. Milestone Creation:
 *    - Calculate milestone amounts (e.g., deposit, progress, completion)
 *    - Store milestone records in database
 *    - Link to job and escrow records
 *
 * 2. Payment Processing per Milestone:
 *    - Create PaymentIntent for each milestone
 *    - Use manual capture for escrow-style holding
 *    - Link PaymentIntent ID to milestone record
 *
 * 3. Milestone Completion Flow:
 *    ```
 *    // 1. Mark milestone complete in database
 *    // 2. Capture the PaymentIntent
 *    await this.stripe.paymentIntents.capture(milestone.paymentIntentId);
 *
 *    // 3. Transfer to Pro's Connected Account
 *    await this.stripe.transfers.create({
 *      amount: milestone.amount,
 *      currency: 'usd',
 *      destination: proStripeAccountId,
 *      transfer_group: milestone.jobId,
 *      metadata: { milestoneId: milestone.id },
 *    });
 *    ```
 *
 * 4. Database Schema:
 *    - milestones table: id, jobId, amount, description, status, order
 *    - paymentIntentId, completedAt, createdAt, updatedAt
 *
 * 5. Common Milestone Patterns:
 *    - 50/50: Deposit (50%) + Completion (50%)
 *    - 33/33/34: Deposit + Progress + Completion
 *    - Custom: User-defined milestone splits
 *
 * 6. Validation:
 *    - Total milestones must equal job total
 *    - Cannot complete out of order (optional)
 *    - Cannot complete cancelled milestones
 *
 * 7. Edge Cases:
 *    - Job cancellation with partial completion
 *    - Milestone amount adjustments (change orders)
 *    - Dispute handling per milestone
 */
@Injectable()
export class MilestoneService {
  private readonly logger = new Logger(MilestoneService.name);

  // In-memory mock storage (Phase 2: Replace with database)
  private mockMilestones: Map<string, Milestone[]> = new Map();

  /**
   * Create a milestone for a job
   *
   * Phase 2 Implementation:
   * ```
   * // 1. Create milestone record in database
   * const milestone = await this.prisma.milestone.create({
   *   data: {
   *     jobId,
   *     amount,
   *     description,
   *     status: 'pending',
   *     order: existingMilestones.length + 1,
   *   },
   * });
   *
   * // 2. Optionally create PaymentIntent
   * const paymentIntent = await this.paymentsService.createPaymentIntent({
   *   amount,
   *   currency: 'usd',
   *   metadata: { jobId, milestoneId: milestone.id },
   * });
   *
   * // 3. Update milestone with PaymentIntent ID
   * ```
   *
   * @param jobId - The job ID
   * @param amount - Milestone amount in cents
   * @param description - Description of the milestone
   * @returns Created milestone record
   */
  async createMilestone(
    jobId: string,
    amount: number,
    description: string,
  ): Promise<Milestone> {
    this.logger.log(`Creating milestone: jobId=${jobId}, amount=${amount}, description=${description}`);

    // STUB: Create mock milestone
    // Phase 2: Create in database with PaymentIntent
    const existingMilestones = this.mockMilestones.get(jobId) || [];
    const mockId = `milestone_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const milestone: Milestone = {
      id: mockId,
      jobId,
      amount,
      description,
      status: MilestoneStatus.PENDING,
      order: existingMilestones.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    existingMilestones.push(milestone);
    this.mockMilestones.set(jobId, existingMilestones);

    this.logger.log(`Milestone created: ${mockId} for job: ${jobId}`);
    return milestone;
  }

  /**
   * Create multiple milestones for a job at once
   *
   * Phase 2: Batch create in database transaction
   *
   * @param jobId - The job ID
   * @param milestones - Array of milestone definitions
   * @returns Created milestone records
   */
  async createMilestones(
    jobId: string,
    milestones: Array<{ amount: number; description: string }>,
  ): Promise<Milestone[]> {
    this.logger.log(`Creating ${milestones.length} milestones for job: ${jobId}`);

    // STUB: Create mock milestones
    // Phase 2: Batch create in database transaction
    const createdMilestones: Milestone[] = [];

    for (const m of milestones) {
      const milestone = await this.createMilestone(jobId, m.amount, m.description);
      createdMilestones.push(milestone);
    }

    this.logger.log(`Created ${createdMilestones.length} milestones for job: ${jobId}`);
    return createdMilestones;
  }

  /**
   * Mark a milestone as complete and release payment
   *
   * Phase 2 Implementation:
   * ```
   * // 1. Verify milestone can be completed
   * const milestone = await this.prisma.milestone.findUnique({ where: { id } });
   * if (milestone.status !== 'pending' && milestone.status !== 'in_progress') {
   *   throw new BadRequestException('Milestone cannot be completed');
   * }
   *
   * // 2. Capture payment
   * await this.stripe.paymentIntents.capture(milestone.paymentIntentId);
   *
   * // 3. Transfer to pro
   * await this.stripe.transfers.create({
   *   amount: milestone.amount,
   *   currency: 'usd',
   *   destination: proStripeAccountId,
   *   transfer_group: milestone.jobId,
   * });
   *
   * // 4. Update milestone status
   * await this.prisma.milestone.update({
   *   where: { id },
   *   data: { status: 'completed', completedAt: new Date() },
   * });
   * ```
   *
   * @param milestoneId - The milestone ID to complete
   * @returns Updated milestone record
   */
  async completeMilestone(milestoneId: string): Promise<Milestone> {
    this.logger.log(`Completing milestone: ${milestoneId}`);

    // STUB: Update mock milestone
    // Phase 2: Capture payment and transfer to pro
    for (const [jobId, milestones] of this.mockMilestones.entries()) {
      const milestoneIndex = milestones.findIndex((m) => m.id === milestoneId);
      if (milestoneIndex !== -1) {
        const milestone = milestones[milestoneIndex];
        milestone.status = MilestoneStatus.COMPLETED;
        milestone.completedAt = new Date().toISOString();
        milestone.updatedAt = new Date().toISOString();

        this.mockMilestones.set(jobId, milestones);
        this.logger.log(`Milestone completed: ${milestoneId}`);
        return milestone;
      }
    }

    // Return mock if not found (for testing)
    this.logger.debug(`Milestone not found: ${milestoneId}, returning mock completed`);
    return {
      id: milestoneId,
      jobId: 'mock_job',
      amount: 2500,
      description: 'Mock milestone',
      status: MilestoneStatus.COMPLETED,
      order: 1,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get all milestones for a job
   *
   * Phase 2 Implementation:
   * ```
   * const milestones = await this.prisma.milestone.findMany({
   *   where: { jobId },
   *   orderBy: { order: 'asc' },
   * });
   * ```
   *
   * @param jobId - The job ID
   * @returns Array of milestones for the job
   */
  async getMilestones(jobId: string): Promise<Milestone[]> {
    this.logger.log(`Getting milestones for job: ${jobId}`);

    // STUB: Return mock milestones
    // Phase 2: Retrieve from database
    const milestones = this.mockMilestones.get(jobId);

    if (!milestones || milestones.length === 0) {
      this.logger.debug(`No milestones found for job: ${jobId}, returning mock data`);
      // Return sample milestones for testing
      return [
        {
          id: `milestone_mock_1_${jobId}`,
          jobId,
          amount: 2500,
          description: 'Deposit - 50% upfront',
          status: MilestoneStatus.COMPLETED,
          order: 1,
          completedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: `milestone_mock_2_${jobId}`,
          jobId,
          amount: 2500,
          description: 'Completion - 50% upon completion',
          status: MilestoneStatus.PENDING,
          order: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }

    this.logger.log(`Found ${milestones.length} milestones for job: ${jobId}`);
    return milestones;
  }

  /**
   * Update milestone status to in-progress
   *
   * @param milestoneId - The milestone ID
   * @returns Updated milestone record
   */
  async startMilestone(milestoneId: string): Promise<Milestone> {
    this.logger.log(`Starting milestone: ${milestoneId}`);

    // STUB: Update mock milestone status
    // Phase 2: Update in database
    for (const [jobId, milestones] of this.mockMilestones.entries()) {
      const milestoneIndex = milestones.findIndex((m) => m.id === milestoneId);
      if (milestoneIndex !== -1) {
        const milestone = milestones[milestoneIndex];
        milestone.status = MilestoneStatus.IN_PROGRESS;
        milestone.updatedAt = new Date().toISOString();

        this.mockMilestones.set(jobId, milestones);
        this.logger.log(`Milestone started: ${milestoneId}`);
        return milestone;
      }
    }

    // Return mock if not found
    return {
      id: milestoneId,
      jobId: 'mock_job',
      amount: 2500,
      description: 'Mock milestone',
      status: MilestoneStatus.IN_PROGRESS,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Cancel a milestone
   *
   * Phase 2: Cancel associated PaymentIntent, refund if needed
   *
   * @param milestoneId - The milestone ID to cancel
   * @returns Updated milestone record
   */
  async cancelMilestone(milestoneId: string): Promise<Milestone> {
    this.logger.log(`Cancelling milestone: ${milestoneId}`);

    // STUB: Update mock milestone status
    // Phase 2: Cancel PaymentIntent, update database
    for (const [jobId, milestones] of this.mockMilestones.entries()) {
      const milestoneIndex = milestones.findIndex((m) => m.id === milestoneId);
      if (milestoneIndex !== -1) {
        const milestone = milestones[milestoneIndex];
        milestone.status = MilestoneStatus.CANCELLED;
        milestone.updatedAt = new Date().toISOString();

        this.mockMilestones.set(jobId, milestones);
        this.logger.log(`Milestone cancelled: ${milestoneId}`);
        return milestone;
      }
    }

    // Return mock if not found
    return {
      id: milestoneId,
      jobId: 'mock_job',
      amount: 2500,
      description: 'Mock milestone',
      status: MilestoneStatus.CANCELLED,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate milestone summary for a job
   *
   * @param jobId - The job ID
   * @returns Summary of milestone payments
   */
  async getMilestoneSummary(jobId: string): Promise<{
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    completedCount: number;
    totalCount: number;
  }> {
    this.logger.log(`Getting milestone summary for job: ${jobId}`);

    const milestones = await this.getMilestones(jobId);

    const summary = {
      totalAmount: milestones.reduce((sum, m) => sum + m.amount, 0),
      paidAmount: milestones
        .filter((m) => m.status === MilestoneStatus.COMPLETED)
        .reduce((sum, m) => sum + m.amount, 0),
      pendingAmount: milestones
        .filter((m) => m.status === MilestoneStatus.PENDING || m.status === MilestoneStatus.IN_PROGRESS)
        .reduce((sum, m) => sum + m.amount, 0),
      completedCount: milestones.filter((m) => m.status === MilestoneStatus.COMPLETED).length,
      totalCount: milestones.length,
    };

    this.logger.log(`Milestone summary for job ${jobId}: ${summary.completedCount}/${summary.totalCount} complete`);
    return summary;
  }
}
