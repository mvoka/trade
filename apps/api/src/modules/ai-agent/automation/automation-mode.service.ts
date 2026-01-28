import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PolicyService } from '../../feature-flags/policy.service';
import { AuditService } from '../../audit/audit.service';
import { FEATURE_FLAGS, POLICY_KEYS, AUDIT_ACTIONS } from '@trades/shared';

/**
 * Automation modes for AI agents
 */
export enum AutomationMode {
  /** Agent suggests, human executes */
  MANUAL = 'MANUAL',
  /** Agent executes with human approval */
  ASSIST = 'ASSIST',
  /** Agent executes autonomously within guardrails */
  AUTO = 'AUTO',
}

/**
 * Automation mode configuration
 */
export interface AutomationConfig {
  orgId: string;
  schedulingMode: AutomationMode;
  intakeMode: AutomationMode;
  dispatchMode: AutomationMode;
  outreachMode: AutomationMode;
  maxActionsPerHour: number;
  approvalThresholdCents: number;
}

/**
 * AutomationModeService - Manages automation modes for AI agents
 *
 * Feature Flags:
 * - AGENT_ASSIST_MODE_ENABLED: Enables ASSIST mode
 * - AGENT_AUTO_MODE_ENABLED: Enables AUTO mode
 *
 * Provides:
 * - Automation mode resolution per org
 * - Mode validation against feature flags
 * - Configuration management
 */
@Injectable()
export class AutomationModeService {
  private readonly logger = new Logger(AutomationModeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get effective automation mode for an org and domain
   */
  async getEffectiveMode(
    orgId: string,
    domain: 'scheduling' | 'intake' | 'dispatch' | 'outreach',
  ): Promise<AutomationMode> {
    // Get the org's configured mode
    const config = await this.getOrgConfig(orgId);

    const modeMap: Record<string, AutomationMode> = {
      scheduling: config?.schedulingMode as AutomationMode ?? AutomationMode.MANUAL,
      intake: config?.intakeMode as AutomationMode ?? AutomationMode.MANUAL,
      dispatch: config?.dispatchMode as AutomationMode ?? AutomationMode.MANUAL,
      outreach: config?.outreachMode as AutomationMode ?? AutomationMode.MANUAL,
    };

    const requestedMode = modeMap[domain];

    // Validate against feature flags
    return this.validateMode(requestedMode, orgId);
  }

  /**
   * Validate that the requested mode is allowed
   */
  private async validateMode(mode: AutomationMode, orgId: string): Promise<AutomationMode> {
    if (mode === AutomationMode.MANUAL) {
      return AutomationMode.MANUAL;
    }

    if (mode === AutomationMode.ASSIST) {
      const assistEnabled = await this.featureFlagsService.isEnabled(
        FEATURE_FLAGS.AGENT_ASSIST_MODE_ENABLED,
        { orgId },
      );
      if (!assistEnabled) {
        this.logger.debug(`ASSIST mode not enabled for org ${orgId}, falling back to MANUAL`);
        return AutomationMode.MANUAL;
      }
      return AutomationMode.ASSIST;
    }

    if (mode === AutomationMode.AUTO) {
      const autoEnabled = await this.featureFlagsService.isEnabled(
        FEATURE_FLAGS.AGENT_AUTO_MODE_ENABLED,
        { orgId },
      );
      if (!autoEnabled) {
        // Fall back to ASSIST if available
        const assistEnabled = await this.featureFlagsService.isEnabled(
          FEATURE_FLAGS.AGENT_ASSIST_MODE_ENABLED,
          { orgId },
        );
        if (assistEnabled) {
          this.logger.debug(`AUTO mode not enabled for org ${orgId}, falling back to ASSIST`);
          return AutomationMode.ASSIST;
        }
        this.logger.debug(`AUTO/ASSIST modes not enabled for org ${orgId}, falling back to MANUAL`);
        return AutomationMode.MANUAL;
      }
      return AutomationMode.AUTO;
    }

    return AutomationMode.MANUAL;
  }

  /**
   * Get automation configuration for an org
   */
  async getOrgConfig(orgId: string): Promise<AutomationConfig | null> {
    const config = await this.prisma.agentAutomationConfig.findUnique({
      where: { orgId },
    });

    if (!config) {
      return null;
    }

    // Resolve policy values for limits
    const maxActions = await this.policyService.getValue<number>(
      POLICY_KEYS.AUTOMATION_MAX_ACTIONS_PER_HOUR,
      { orgId },
    ) ?? 10;

    const approvalThreshold = await this.policyService.getValue<number>(
      POLICY_KEYS.AUTOMATION_APPROVAL_THRESHOLD_CENTS,
      { orgId },
    ) ?? 10000;

    return {
      orgId: config.orgId,
      schedulingMode: config.schedulingMode as AutomationMode,
      intakeMode: config.intakeMode as AutomationMode,
      dispatchMode: config.dispatchMode as AutomationMode,
      outreachMode: config.outreachMode as AutomationMode,
      maxActionsPerHour: maxActions,
      approvalThresholdCents: approvalThreshold,
    };
  }

  /**
   * Update automation configuration for an org
   */
  async updateOrgConfig(
    orgId: string,
    updates: Partial<Pick<AutomationConfig, 'schedulingMode' | 'intakeMode' | 'dispatchMode' | 'outreachMode'>>,
    actorId: string,
  ): Promise<AutomationConfig> {
    // Validate all modes
    const validatedUpdates: Record<string, string> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        validatedUpdates[key] = await this.validateMode(value as AutomationMode, orgId);
      }
    }

    const config = await this.prisma.agentAutomationConfig.upsert({
      where: { orgId },
      create: {
        orgId,
        schedulingMode: (validatedUpdates.schedulingMode ?? 'MANUAL') as 'MANUAL' | 'ASSIST' | 'AUTO',
        intakeMode: (validatedUpdates.intakeMode ?? 'MANUAL') as 'MANUAL' | 'ASSIST' | 'AUTO',
        dispatchMode: (validatedUpdates.dispatchMode ?? 'MANUAL') as 'MANUAL' | 'ASSIST' | 'AUTO',
        outreachMode: (validatedUpdates.outreachMode ?? 'MANUAL') as 'MANUAL' | 'ASSIST' | 'AUTO',
      },
      update: validatedUpdates,
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.AUTOMATION_CONFIG_UPDATED,
      actorId,
      targetType: 'AgentAutomationConfig',
      targetId: orgId,
      details: { updates: validatedUpdates },
    });

    this.logger.log(`Automation config updated for org ${orgId}`);

    return this.getOrgConfig(orgId) as Promise<AutomationConfig>;
  }

  /**
   * Check if an action requires approval in the current mode
   */
  async requiresApproval(
    orgId: string,
    domain: string,
    actionType: string,
    amountCents?: number,
  ): Promise<{
    requiresApproval: boolean;
    reason?: string;
  }> {
    const mode = await this.getEffectiveMode(orgId, domain as 'scheduling' | 'intake' | 'dispatch' | 'outreach');

    // MANUAL mode always requires approval
    if (mode === AutomationMode.MANUAL) {
      return { requiresApproval: true, reason: 'Manual mode - all actions require approval' };
    }

    // ASSIST mode always requires approval
    if (mode === AutomationMode.ASSIST) {
      return { requiresApproval: true, reason: 'Assist mode - actions require approval' };
    }

    // AUTO mode - check specific conditions
    if (mode === AutomationMode.AUTO) {
      // Check amount threshold
      if (amountCents) {
        const threshold = await this.policyService.getValue<number>(
          POLICY_KEYS.AUTOMATION_APPROVAL_THRESHOLD_CENTS,
          { orgId },
        ) ?? 10000;

        if (amountCents > threshold) {
          return {
            requiresApproval: true,
            reason: `Amount ${amountCents} exceeds approval threshold of ${threshold}`,
          };
        }
      }

      // Sensitive actions always require approval
      const sensitiveActions = ['cancel_subscription', 'delete', 'refund'];
      if (sensitiveActions.some((a) => actionType.includes(a))) {
        return {
          requiresApproval: true,
          reason: `Sensitive action "${actionType}" always requires approval`,
        };
      }

      return { requiresApproval: false };
    }

    return { requiresApproval: true, reason: 'Unknown mode' };
  }
}
