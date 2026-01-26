import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { EscalationService } from './escalation.service';

/**
 * Dispatch Processor
 *
 * Handles background processing of dispatch-related tasks:
 * - SLA timeout monitoring
 * - Auto-escalation
 * - Retry logic
 *
 * In production, this would integrate with BullMQ for reliable job processing.
 * For the MVP, it provides a simple interval-based check.
 */
@Injectable()
export class DispatchProcessor implements OnModuleInit {
  private readonly logger = new Logger(DispatchProcessor.name);
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly dispatchService: DispatchService,
    private readonly escalationService: EscalationService,
  ) {}

  onModuleInit() {
    // Start the SLA check interval (every 30 seconds)
    this.startSlaMonitoring();
  }

  /**
   * Start monitoring for SLA timeouts
   */
  private startSlaMonitoring() {
    this.logger.log('Starting SLA monitoring...');

    // Check every 30 seconds for SLA timeouts
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkSlaTimeouts();
      } catch (error) {
        this.logger.error('Error checking SLA timeouts:', error);
      }
    }, 30000);
  }

  /**
   * Check for dispatch attempts that have exceeded their SLA deadline
   */
  private async checkSlaTimeouts() {
    try {
      const timedOutAttempts = await this.dispatchService.getTimedOutAttempts();

      for (const attempt of timedOutAttempts) {
        this.logger.log(`Processing timeout for dispatch attempt ${attempt.id}`);

        try {
          // Mark the attempt as timed out
          await this.dispatchService.processTimeout(attempt.id);

          // Trigger escalation
          await this.escalationService.escalate(attempt.jobId);
        } catch (error) {
          this.logger.error(
            `Error processing timeout for attempt ${attempt.id}:`,
            error,
          );
        }
      }

      if (timedOutAttempts.length > 0) {
        this.logger.log(`Processed ${timedOutAttempts.length} timed out dispatch attempts`);
      }
    } catch (error) {
      this.logger.error('Error in checkSlaTimeouts:', error);
    }
  }

  /**
   * Stop the SLA monitoring (for graceful shutdown)
   */
  stopSlaMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.log('SLA monitoring stopped');
    }
  }
}
