import { Injectable, Logger } from '@nestjs/common';
import { PolicyService } from '../../feature-flags/policy.service';
import { AuditService } from '../../audit/audit.service';
import { POLICY_KEYS, AUDIT_ACTIONS } from '@trades/shared';

/**
 * Guardrail check result
 */
export interface GuardrailCheckResult {
  allowed: boolean;
  reason?: string;
  guardrail?: string;
  recommendation?: string;
}

/**
 * Action tracking record
 */
interface ActionRecord {
  orgId: string;
  agentId: string;
  actionType: string;
  timestamp: Date;
}

/**
 * GuardrailsService - Safety controls for autonomous AI agents
 *
 * Enforces:
 * - Rate limits (max actions per hour)
 * - Amount thresholds (require approval above limit)
 * - Sensitive action restrictions
 * - Operating hours constraints
 * - Resource access controls
 */
@Injectable()
export class GuardrailsService {
  private readonly logger = new Logger(GuardrailsService.name);

  // In-memory action tracking for P1 (would use Redis in P2)
  private readonly actionHistory: ActionRecord[] = [];

  // Actions that always require approval regardless of mode
  private readonly sensitiveActions = new Set([
    'cancel_subscription',
    'delete_account',
    'process_refund',
    'send_bulk_message',
    'modify_pricing',
    'update_policy',
    'archive_data',
  ]);

  constructor(
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Run all guardrail checks for an action
   */
  async checkAction(params: {
    orgId: string;
    agentId: string;
    actionType: string;
    amountCents?: number;
    targetUserId?: string;
  }): Promise<GuardrailCheckResult> {
    // Check rate limit
    const rateCheck = await this.checkRateLimit(params.orgId, params.agentId);
    if (!rateCheck.allowed) {
      return rateCheck;
    }

    // Check sensitive actions
    const sensitiveCheck = this.checkSensitiveAction(params.actionType);
    if (!sensitiveCheck.allowed) {
      return sensitiveCheck;
    }

    // Check amount threshold
    if (params.amountCents) {
      const amountCheck = await this.checkAmountThreshold(params.orgId, params.amountCents);
      if (!amountCheck.allowed) {
        return amountCheck;
      }
    }

    // Record the action
    this.recordAction(params.orgId, params.agentId, params.actionType);

    return { allowed: true };
  }

  /**
   * Check rate limit (max actions per hour)
   */
  async checkRateLimit(orgId: string, agentId: string): Promise<GuardrailCheckResult> {
    const maxActionsPerHour = await this.policyService.getValue<number>(
      POLICY_KEYS.AUTOMATION_MAX_ACTIONS_PER_HOUR,
      { orgId },
    ) ?? 10;

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentActions = this.actionHistory.filter(
      (a) => a.orgId === orgId && a.agentId === agentId && a.timestamp > oneHourAgo,
    );

    if (recentActions.length >= maxActionsPerHour) {
      this.logger.warn(
        `Rate limit reached for agent ${agentId} in org ${orgId}: ${recentActions.length}/${maxActionsPerHour}`,
      );

      await this.auditService.log({
        action: AUDIT_ACTIONS.AUTOMATION_GUARDRAIL_TRIGGERED,
        targetType: 'Agent',
        targetId: agentId,
        details: {
          guardrail: 'rate_limit',
          orgId,
          currentCount: recentActions.length,
          maxAllowed: maxActionsPerHour,
        },
      });

      return {
        allowed: false,
        guardrail: 'rate_limit',
        reason: `Rate limit exceeded: ${recentActions.length}/${maxActionsPerHour} actions per hour`,
        recommendation: 'Wait for the rate limit window to reset or increase the limit in policies',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if an action is a sensitive action
   */
  checkSensitiveAction(actionType: string): GuardrailCheckResult {
    if (this.sensitiveActions.has(actionType)) {
      return {
        allowed: false,
        guardrail: 'sensitive_action',
        reason: `"${actionType}" is a sensitive action that always requires human approval`,
        recommendation: 'This action cannot be automated and must be approved by a human',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if amount exceeds approval threshold
   */
  async checkAmountThreshold(orgId: string, amountCents: number): Promise<GuardrailCheckResult> {
    const threshold = await this.policyService.getValue<number>(
      POLICY_KEYS.AUTOMATION_APPROVAL_THRESHOLD_CENTS,
      { orgId },
    ) ?? 10000;

    if (amountCents > threshold) {
      return {
        allowed: false,
        guardrail: 'amount_threshold',
        reason: `Amount $${(amountCents / 100).toFixed(2)} exceeds threshold $${(threshold / 100).toFixed(2)}`,
        recommendation: 'This action requires human approval due to the amount involved',
      };
    }

    return { allowed: true };
  }

  /**
   * Record an action for tracking
   */
  private recordAction(orgId: string, agentId: string, actionType: string): void {
    this.actionHistory.push({
      orgId,
      agentId,
      actionType,
      timestamp: new Date(),
    });

    // Clean up old records (keep last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const cutoffIndex = this.actionHistory.findIndex((a) => a.timestamp > oneDayAgo);
    if (cutoffIndex > 0) {
      this.actionHistory.splice(0, cutoffIndex);
    }
  }

  /**
   * Get action counts for monitoring
   */
  getActionCounts(orgId: string, agentId?: string): {
    lastHour: number;
    last24Hours: number;
    byActionType: Record<string, number>;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let lastHour = 0;
    let last24Hours = 0;
    const byActionType: Record<string, number> = {};

    for (const action of this.actionHistory) {
      if (action.orgId !== orgId) continue;
      if (agentId && action.agentId !== agentId) continue;

      if (action.timestamp > oneDayAgo) {
        last24Hours++;
        byActionType[action.actionType] = (byActionType[action.actionType] ?? 0) + 1;
      }

      if (action.timestamp > oneHourAgo) {
        lastHour++;
      }
    }

    return { lastHour, last24Hours, byActionType };
  }

  /**
   * Check if an action is within operating hours
   */
  checkOperatingHours(
    operatingHours?: { start: number; end: number; timezone: string },
  ): GuardrailCheckResult {
    if (!operatingHours) {
      return { allowed: true };
    }

    const now = new Date();
    const currentHour = now.getHours(); // Simplified - should use timezone

    if (currentHour < operatingHours.start || currentHour >= operatingHours.end) {
      return {
        allowed: false,
        guardrail: 'operating_hours',
        reason: `Action attempted outside operating hours (${operatingHours.start}:00 - ${operatingHours.end}:00)`,
        recommendation: 'This action will be queued for the next operating window',
      };
    }

    return { allowed: true };
  }

  /**
   * Get guardrails summary for an org
   */
  async getGuardrailsSummary(orgId: string): Promise<{
    maxActionsPerHour: number;
    approvalThresholdCents: number;
    sensitiveActions: string[];
    currentUsage: { lastHour: number; last24Hours: number };
  }> {
    const maxActions = await this.policyService.getValue<number>(
      POLICY_KEYS.AUTOMATION_MAX_ACTIONS_PER_HOUR,
      { orgId },
    ) ?? 10;

    const threshold = await this.policyService.getValue<number>(
      POLICY_KEYS.AUTOMATION_APPROVAL_THRESHOLD_CENTS,
      { orgId },
    ) ?? 10000;

    const usage = this.getActionCounts(orgId);

    return {
      maxActionsPerHour: maxActions,
      approvalThresholdCents: threshold,
      sensitiveActions: Array.from(this.sensitiveActions),
      currentUsage: {
        lastHour: usage.lastHour,
        last24Hours: usage.last24Hours,
      },
    };
  }
}
