import { Injectable, Logger } from '@nestjs/common';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PromptTemplateService } from '../llm/prompt-template.service';
import {
  AgentConfig,
  AgentCategory,
  AgentInstance,
  AgentConfigRegistry as IAgentConfigRegistry,
} from './agent-config.interface';

// ============================================
// DEFAULT AGENT CONFIGURATIONS
// ============================================

const DEFAULT_AGENT_CONFIGS: AgentConfig[] = [
  // ============================================
  // CUSTOMER-FACING AGENTS
  // ============================================
  {
    id: 'DISPATCH_CONCIERGE',
    name: 'Dispatch Concierge',
    description: 'Customer-facing agent for job intake, quotes, and scheduling',
    category: 'CUSTOMER_FACING',
    systemPromptKey: 'agent.dispatch-concierge',
    allowedSkills: ['JobIntake', 'QuoteGeneration', 'ScheduleManagement', 'StatusInquiry'],
    allowedTools: [
      'BookingTool.createBooking',
      'BookingTool.getSlots',
      'CalendarTool.checkAvailability',
      'SmsTool.sendSms',
      'EmailTool.sendEmail',
    ],
    requiredFlags: ['AGENT_DISPATCH_CONCIERGE_ENABLED'],
    requiredPermissions: [],
    maxTurns: 30,
    constraints: {
      canInitiateOutbound: true,
      canAccessPII: false,
      requiresApprovalFor: ['BookingTool.createBooking'],
    },
    llmConfig: {
      temperature: 0.7,
      maxTokens: 2048,
    },
    escalation: {
      triggerKeywords: ['manager', 'supervisor', 'complaint', 'frustrated', 'angry'],
      sentimentThreshold: -0.5,
      targetQueue: 'customer-support',
    },
    metadata: {
      version: '1.0.0',
    },
  },
  {
    id: 'JOB_STATUS',
    name: 'Job Status Agent',
    description: 'Handles job status inquiries and issue escalation',
    category: 'CUSTOMER_FACING',
    systemPromptKey: 'agent.job-status',
    allowedSkills: ['StatusInquiry', 'IssueEscalation'],
    allowedTools: [
      'DispatchTool.checkStatus',
      'SmsTool.sendSms',
      'EmailTool.sendEmail',
    ],
    requiredFlags: ['AGENT_JOB_STATUS_ENABLED'],
    requiredPermissions: [],
    maxTurns: 20,
    constraints: {
      canInitiateOutbound: false,
      canAccessPII: false,
      requiresApprovalFor: [],
    },
    llmConfig: {
      temperature: 0.5,
      maxTokens: 1024,
    },
    escalation: {
      triggerKeywords: ['urgent', 'emergency', 'not coming', 'no show'],
      targetQueue: 'operations',
    },
    metadata: {
      version: '1.0.0',
    },
  },
  {
    id: 'QUOTE_ASSISTANT',
    name: 'Quote Assistant',
    description: 'Generates and explains service quotes',
    category: 'CUSTOMER_FACING',
    systemPromptKey: 'agent.quote-assistant',
    allowedSkills: ['QuoteGeneration', 'JobIntake'],
    allowedTools: [
      'CalendarTool.checkAvailability',
    ],
    requiredFlags: ['AGENT_QUOTE_ASSISTANT_ENABLED'],
    requiredPermissions: [],
    maxTurns: 25,
    constraints: {
      canInitiateOutbound: false,
      canAccessPII: false,
      requiresApprovalFor: [],
    },
    llmConfig: {
      temperature: 0.3,
      maxTokens: 2048,
    },
    metadata: {
      version: '1.0.0',
    },
  },

  // ============================================
  // CONTRACTOR-FACING AGENTS
  // ============================================
  {
    id: 'CONTRACTOR_ONBOARDING',
    name: 'Contractor Onboarding',
    description: 'Guides contractors through onboarding process',
    category: 'CONTRACTOR_FACING',
    systemPromptKey: 'agent.contractor-onboarding',
    allowedSkills: ['DocumentUpload', 'VerificationCheck'],
    allowedTools: [
      'EmailTool.sendEmail',
    ],
    requiredFlags: ['AGENT_CONTRACTOR_ONBOARDING_ENABLED'],
    requiredPermissions: ['contractor:onboard'],
    maxTurns: 40,
    constraints: {
      canInitiateOutbound: true,
      canAccessPII: true, // Needs to verify contractor identity
      requiresApprovalFor: [],
    },
    llmConfig: {
      temperature: 0.5,
      maxTokens: 2048,
    },
    metadata: {
      version: '1.0.0',
    },
  },
  {
    id: 'EARNINGS_OPTIMIZER',
    name: 'Earnings Optimizer',
    description: 'Helps contractors maximize earnings',
    category: 'CONTRACTOR_FACING',
    systemPromptKey: 'agent.earnings-optimizer',
    allowedSkills: ['EarningsTracking', 'AvailabilityManagement'],
    allowedTools: [],
    requiredFlags: ['AGENT_EARNINGS_OPTIMIZER_ENABLED'],
    requiredPermissions: ['contractor:view'],
    maxTurns: 20,
    constraints: {
      canInitiateOutbound: false,
      canAccessPII: false,
      requiresApprovalFor: [],
    },
    llmConfig: {
      temperature: 0.5,
      maxTokens: 1024,
    },
    metadata: {
      version: '1.0.0',
    },
  },

  // ============================================
  // OPERATIONS AGENTS
  // ============================================
  {
    id: 'DISPATCH_OPTIMIZER',
    name: 'Dispatch Optimizer',
    description: 'Optimizes contractor matching and routing',
    category: 'OPERATIONS',
    systemPromptKey: 'agent.dispatch-optimizer',
    allowedSkills: ['ContractorSearch', 'DispatchOverride', 'RouteOptimization'],
    allowedTools: [
      'DispatchTool.initiateDispatch',
      'DispatchTool.checkStatus',
      'CalendarTool.checkAvailability',
    ],
    requiredFlags: ['AGENT_DISPATCH_OPTIMIZER_ENABLED'],
    requiredPermissions: ['dispatch:manage'],
    maxTurns: 30,
    constraints: {
      canInitiateOutbound: true,
      canAccessPII: true,
      requiresApprovalFor: ['DispatchTool.initiateDispatch'],
    },
    llmConfig: {
      temperature: 0.3,
      maxTokens: 2048,
    },
    escalation: {
      triggerKeywords: ['no contractors', 'coverage gap', 'emergency'],
      targetQueue: 'dispatch-management',
    },
    metadata: {
      version: '1.0.0',
    },
  },
  {
    id: 'SLA_GUARDIAN',
    name: 'SLA Guardian',
    description: 'Monitors and enforces SLA compliance',
    category: 'OPERATIONS',
    systemPromptKey: 'agent.sla-guardian',
    allowedSkills: ['SLAMonitoring', 'EscalationHandling'],
    allowedTools: [
      'DispatchTool.checkStatus',
      'SmsTool.sendSms',
      'EmailTool.sendEmail',
      'CallTool.initiateCall',
    ],
    requiredFlags: ['AGENT_SLA_GUARDIAN_ENABLED'],
    requiredPermissions: ['sla:monitor'],
    maxTurns: 20,
    constraints: {
      canInitiateOutbound: true,
      canAccessPII: true,
      requiresApprovalFor: ['CallTool.initiateCall'],
    },
    llmConfig: {
      temperature: 0.2,
      maxTokens: 1024,
    },
    metadata: {
      version: '1.0.0',
    },
  },
  {
    id: 'QUALITY_ASSURANCE',
    name: 'Quality Assurance',
    description: 'Collects feedback and monitors quality',
    category: 'OPERATIONS',
    systemPromptKey: 'agent.quality-assurance',
    allowedSkills: ['FeedbackCollection', 'MetricsAnalysis'],
    allowedTools: [
      'SmsTool.sendSms',
      'EmailTool.sendEmail',
    ],
    requiredFlags: ['AGENT_QA_ENABLED'],
    requiredPermissions: ['quality:manage'],
    maxTurns: 15,
    constraints: {
      canInitiateOutbound: true,
      canAccessPII: false,
      requiresApprovalFor: [],
    },
    llmConfig: {
      temperature: 0.6,
      maxTokens: 1024,
    },
    metadata: {
      version: '1.0.0',
    },
  },

  // ============================================
  // ADMIN AGENTS
  // ============================================
  {
    id: 'CAPACITY_PLANNING',
    name: 'Capacity Planning',
    description: 'Forecasts demand and manages capacity',
    category: 'ADMIN',
    systemPromptKey: 'agent.capacity-planning',
    allowedSkills: ['DemandForecasting', 'GapAnalysis'],
    allowedTools: [],
    requiredFlags: ['AGENT_CAPACITY_PLANNING_ENABLED'],
    requiredPermissions: ['analytics:view', 'capacity:manage'],
    maxTurns: 25,
    constraints: {
      canInitiateOutbound: false,
      canAccessPII: false,
      requiresApprovalFor: [],
    },
    llmConfig: {
      temperature: 0.3,
      maxTokens: 4096,
    },
    metadata: {
      version: '1.0.0',
    },
  },
  {
    id: 'POLICY_CONFIGURATION',
    name: 'Policy Configuration',
    description: 'Manages platform policies and settings',
    category: 'ADMIN',
    systemPromptKey: 'agent.policy-configuration',
    allowedSkills: ['PolicyManagement'],
    allowedTools: [],
    requiredFlags: ['AGENT_POLICY_CONFIG_ENABLED'],
    requiredPermissions: ['policy:manage'],
    maxTurns: 30,
    constraints: {
      canInitiateOutbound: false,
      canAccessPII: false,
      requiresApprovalFor: ['PolicyManagement'], // All policy changes need approval
    },
    llmConfig: {
      temperature: 0.2,
      maxTokens: 2048,
    },
    metadata: {
      version: '1.0.0',
    },
  },
  {
    id: 'ANALYTICS_INSIGHT',
    name: 'Analytics Insight',
    description: 'Provides analytics and reporting',
    category: 'ADMIN',
    systemPromptKey: 'agent.analytics-insight',
    allowedSkills: ['ReportGeneration'],
    allowedTools: [],
    requiredFlags: ['AGENT_ANALYTICS_INSIGHT_ENABLED'],
    requiredPermissions: ['analytics:view'],
    maxTurns: 20,
    constraints: {
      canInitiateOutbound: false,
      canAccessPII: false,
      requiresApprovalFor: [],
    },
    llmConfig: {
      temperature: 0.3,
      maxTokens: 4096,
    },
    metadata: {
      version: '1.0.0',
    },
  },

  // ============================================
  // PHASE 3: MARKETPLACE AGENTS
  // ============================================
  {
    id: 'SUBSCRIPTION_MANAGER',
    name: 'Subscription Manager',
    description: 'Manages subscription lifecycle with configurable automation (ASSIST/AUTO modes)',
    category: 'OPERATIONS',
    systemPromptKey: 'agent.subscription-manager',
    allowedSkills: ['SubscriptionOps', 'ScheduleManagement'],
    allowedTools: [
      'SubscriptionTool.createOccurrenceJob',
      'SubscriptionTool.pause',
      'SubscriptionTool.resume',
      'EmailTool.sendEmail',
      'SmsTool.sendSms',
    ],
    requiredFlags: ['AGENT_SUBSCRIPTION_OPS_ENABLED'],
    requiredPermissions: ['subscription:manage'],
    maxTurns: 25,
    constraints: {
      canInitiateOutbound: true,
      canAccessPII: true,
      requiresApprovalFor: [
        'SubscriptionTool.pause',
        'cancel_subscription',
      ],
    },
    llmConfig: {
      temperature: 0.3,
      maxTokens: 2048,
    },
    escalation: {
      triggerKeywords: ['billing issue', 'charge', 'dispute', 'refund'],
      targetQueue: 'billing-support',
    },
    metadata: {
      version: '1.0.0',
      phase: '3',
      automationDomain: 'scheduling',
    },
  },
  {
    id: 'HOMEOWNER_CONCIERGE',
    name: 'Homeowner Concierge',
    description: 'Customer-facing agent for homeowner booking, subscription management, and inquiries',
    category: 'CUSTOMER_FACING',
    systemPromptKey: 'agent.homeowner-concierge',
    allowedSkills: ['HomeownerConcierge', 'JobIntake', 'ScheduleManagement', 'StatusInquiry'],
    allowedTools: [
      'BookingTool.createBooking',
      'BookingTool.getSlots',
      'CalendarTool.checkAvailability',
      'EmailTool.sendEmail',
    ],
    requiredFlags: ['AGENT_HOMEOWNER_CONCIERGE_ENABLED'],
    requiredPermissions: [],
    maxTurns: 30,
    constraints: {
      canInitiateOutbound: true,
      canAccessPII: false,
      requiresApprovalFor: ['BookingTool.createBooking'],
    },
    llmConfig: {
      temperature: 0.7,
      maxTokens: 2048,
    },
    escalation: {
      triggerKeywords: ['complaint', 'frustrated', 'supervisor', 'refund', 'cancel'],
      sentimentThreshold: -0.5,
      targetQueue: 'customer-support',
    },
    metadata: {
      version: '1.0.0',
      phase: '3',
    },
  },
  {
    id: 'PORTFOLIO_ASSISTANT',
    name: 'Portfolio Assistant',
    description: 'Helps contractors build and manage their public portfolio',
    category: 'CONTRACTOR_FACING',
    systemPromptKey: 'agent.portfolio-assistant',
    allowedSkills: ['PortfolioOps', 'DocumentUpload'],
    allowedTools: [
      'PortfolioTool.addItem',
      'PortfolioTool.requestOptIn',
    ],
    requiredFlags: ['AGENT_PORTFOLIO_OPS_ENABLED'],
    requiredPermissions: ['portfolio:manage'],
    maxTurns: 25,
    constraints: {
      canInitiateOutbound: true, // For opt-in requests
      canAccessPII: false,
      requiresApprovalFor: ['PortfolioTool.requestOptIn'],
    },
    llmConfig: {
      temperature: 0.6,
      maxTokens: 2048,
    },
    metadata: {
      version: '1.0.0',
      phase: '3',
    },
  },
  {
    id: 'OUTREACH_COORDINATOR',
    name: 'Outreach Coordinator',
    description: 'Manages compliant lead generation campaigns and follow-up',
    category: 'OPERATIONS',
    systemPromptKey: 'agent.outreach-coordinator',
    allowedSkills: ['OutreachOps'],
    allowedTools: [
      'OfferTool.createLead',
      'OfferTool.sendFollowUp',
      'EmailTool.sendEmail',
      'SmsTool.sendSms',
    ],
    requiredFlags: ['AGENT_OUTREACH_OPS_ENABLED'],
    requiredPermissions: ['offers:manage'],
    maxTurns: 25,
    constraints: {
      canInitiateOutbound: true,
      canAccessPII: true,
      requiresApprovalFor: [
        'OfferTool.sendFollowUp',
        'SmsTool.sendSms',
      ],
    },
    llmConfig: {
      temperature: 0.4,
      maxTokens: 2048,
    },
    metadata: {
      version: '1.0.0',
      phase: '3',
      automationDomain: 'outreach',
    },
  },
];

// ============================================
// AGENT CONFIG REGISTRY SERVICE
// ============================================

/**
 * AgentConfigRegistryService - Manages agent configurations
 *
 * Provides:
 * - Agent registration and lookup
 * - Feature flag integration
 * - Instance creation for sessions
 */
@Injectable()
export class AgentConfigRegistryService implements IAgentConfigRegistry {
  private readonly logger = new Logger(AgentConfigRegistryService.name);
  private readonly configs = new Map<string, AgentConfig>();

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly promptTemplateService: PromptTemplateService,
  ) {
    this.initializeDefaultConfigs();
    this.logger.log('AgentConfigRegistryService initialized');
  }

  /**
   * Initialize with default agent configurations
   */
  private initializeDefaultConfigs(): void {
    for (const config of DEFAULT_AGENT_CONFIGS) {
      this.register(config);
    }
    this.logger.log(`Registered ${this.configs.size} agent configurations`);
  }

  // ============================================
  // REGISTRATION
  // ============================================

  /**
   * Register an agent configuration
   */
  register(config: AgentConfig): void {
    if (this.configs.has(config.id)) {
      this.logger.warn(`Overwriting existing agent config: ${config.id}`);
    }
    this.configs.set(config.id, config);
    this.logger.debug(`Registered agent: ${config.id}`);
  }

  /**
   * Unregister an agent configuration
   */
  unregister(agentId: string): boolean {
    const removed = this.configs.delete(agentId);
    if (removed) {
      this.logger.debug(`Unregistered agent: ${agentId}`);
    }
    return removed;
  }

  // ============================================
  // LOOKUP
  // ============================================

  /**
   * Get agent configuration by ID
   */
  get(agentId: string): AgentConfig | undefined {
    return this.configs.get(agentId);
  }

  /**
   * Get all agent configurations
   */
  getAll(): AgentConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get agents by category
   */
  getByCategory(category: AgentCategory): AgentConfig[] {
    return Array.from(this.configs.values()).filter(
      (config) => config.category === category,
    );
  }

  /**
   * Get agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Check if agent exists
   */
  has(agentId: string): boolean {
    return this.configs.has(agentId);
  }

  // ============================================
  // FEATURE FLAG INTEGRATION
  // ============================================

  /**
   * Check if an agent is enabled via feature flags
   */
  async isEnabled(agentId: string, context?: { orgId?: string }): Promise<boolean> {
    const config = this.configs.get(agentId);
    if (!config) {
      return false;
    }

    // Check all required flags
    for (const flag of config.requiredFlags) {
      const enabled = await this.featureFlagsService.isEnabled(flag, {
        orgId: context?.orgId,
      });
      if (!enabled) {
        this.logger.debug(`Agent ${agentId} disabled by flag: ${flag}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get all enabled agents for a context
   */
  async getEnabledAgents(context?: { orgId?: string }): Promise<AgentConfig[]> {
    const enabled: AgentConfig[] = [];

    for (const config of this.configs.values()) {
      if (await this.isEnabled(config.id, context)) {
        enabled.push(config);
      }
    }

    return enabled;
  }

  // ============================================
  // INSTANCE CREATION
  // ============================================

  /**
   * Create an agent instance for a session
   */
  async createInstance(
    agentId: string,
    sessionId: string,
    context?: Record<string, unknown>,
  ): Promise<AgentInstance> {
    const config = this.configs.get(agentId);
    if (!config) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Check if enabled
    const enabled = await this.isEnabled(agentId, {
      orgId: context?.orgId as string | undefined,
    });
    if (!enabled) {
      throw new Error(`Agent ${agentId} is not enabled`);
    }

    // Get system prompt
    const systemPrompt = this.promptTemplateService.getAgentPrompt(
      agentId,
      {
        orgName: context?.orgName as string | undefined,
        userName: context?.userName as string | undefined,
        timezone: context?.timezone as string | undefined,
        currentTime: new Date().toISOString(),
        additionalContext: context?.additionalContext as string | undefined,
      },
    );

    // Filter available tools based on permissions
    const availableTools = await this.filterAvailableTools(
      config.allowedTools,
      context,
    );

    // Filter available skills
    const availableSkills = await this.filterAvailableSkills(
      config.allowedSkills,
      context,
    );

    const instance: AgentInstance = {
      config,
      sessionId,
      systemPrompt,
      availableTools,
      availableSkills,
      createdAt: new Date(),
    };

    this.logger.debug(`Created agent instance: ${agentId} for session ${sessionId}`);

    return instance;
  }

  /**
   * Filter tools based on context permissions
   */
  private async filterAvailableTools(
    tools: string[],
    context?: Record<string, unknown>,
  ): Promise<string[]> {
    // For now, return all allowed tools
    // In production, filter based on user permissions and feature flags
    return tools;
  }

  /**
   * Filter skills based on context permissions
   */
  private async filterAvailableSkills(
    skills: string[],
    context?: Record<string, unknown>,
  ): Promise<string[]> {
    // For now, return all allowed skills
    // In production, filter based on user permissions and feature flags
    return skills;
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Get agent metadata for display
   */
  getAgentMetadata(): Array<{
    id: string;
    name: string;
    category: AgentCategory;
    description: string;
  }> {
    return Array.from(this.configs.values()).map((config) => ({
      id: config.id,
      name: config.name,
      category: config.category,
      description: config.description,
    }));
  }

  /**
   * Validate agent configuration
   */
  validateConfig(config: AgentConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.id) {
      errors.push('Agent ID is required');
    }

    if (!config.name) {
      errors.push('Agent name is required');
    }

    if (!config.category) {
      errors.push('Agent category is required');
    }

    if (!config.systemPromptKey) {
      errors.push('System prompt key is required');
    }

    if (!config.constraints) {
      errors.push('Agent constraints are required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
