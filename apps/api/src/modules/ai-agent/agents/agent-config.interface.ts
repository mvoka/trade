/**
 * Agent Configuration Interfaces
 *
 * Defines the structure for AI agent configurations
 */

// ============================================
// AGENT CATEGORIES
// ============================================

/**
 * Agent category for organization
 */
export type AgentCategory =
  | 'CUSTOMER_FACING'
  | 'CONTRACTOR_FACING'
  | 'OPERATIONS'
  | 'ADMIN';

// ============================================
// AGENT CONSTRAINTS
// ============================================

/**
 * Operational constraints for an agent
 */
export interface AgentConstraints {
  /** Can the agent initiate outbound communications */
  canInitiateOutbound: boolean;

  /** Can the agent access PII data */
  canAccessPII: boolean;

  /** Actions that require human approval */
  requiresApprovalFor: string[];

  /** Maximum monetary amount the agent can authorize */
  maxAuthorizationAmount?: number;

  /** Allowed hours of operation (24h format) */
  operatingHours?: {
    start: number; // e.g., 8 for 8:00 AM
    end: number;   // e.g., 20 for 8:00 PM
    timezone: string;
  };

  /** Regions/locales this agent can serve */
  allowedRegions?: string[];
}

// ============================================
// AGENT CONFIGURATION
// ============================================

/**
 * Complete agent configuration
 */
export interface AgentConfig {
  /** Unique agent identifier */
  id: string;

  /** Human-readable agent name */
  name: string;

  /** Agent description */
  description: string;

  /** Agent category */
  category: AgentCategory;

  /** Key for system prompt template */
  systemPromptKey: string;

  /** Skills this agent can use */
  allowedSkills: string[];

  /** Tools this agent can invoke */
  allowedTools: string[];

  /** Feature flags required for this agent */
  requiredFlags: string[];

  /** Permissions required to interact with this agent */
  requiredPermissions: string[];

  /** Maximum conversation turns before forcing handoff */
  maxTurns?: number;

  /** Operational constraints */
  constraints: AgentConstraints;

  /** LLM configuration overrides */
  llmConfig?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };

  /** Escalation configuration */
  escalation?: {
    /** Keywords that trigger escalation */
    triggerKeywords?: string[];
    /** Sentiment threshold for escalation */
    sentimentThreshold?: number;
    /** Target queue for escalation */
    targetQueue?: string;
  };

  /** Metadata for tracking and analytics */
  metadata?: {
    version: string;
    author?: string;
    lastUpdated?: Date;
    [key: string]: unknown;
  };
}

// ============================================
// AGENT INSTANCE
// ============================================

/**
 * Runtime agent instance with resolved configuration
 */
export interface AgentInstance {
  /** Configuration used */
  config: AgentConfig;

  /** Session ID */
  sessionId: string;

  /** Resolved system prompt */
  systemPrompt: string;

  /** Available tools for this session */
  availableTools: string[];

  /** Available skills for this session */
  availableSkills: string[];

  /** Creation timestamp */
  createdAt: Date;
}

// ============================================
// AGENT REGISTRY INTERFACE
// ============================================

/**
 * Agent configuration registry interface
 */
export interface AgentConfigRegistry {
  /**
   * Register an agent configuration
   */
  register(config: AgentConfig): void;

  /**
   * Get agent configuration by ID
   */
  get(agentId: string): AgentConfig | undefined;

  /**
   * Get all agent configurations
   */
  getAll(): AgentConfig[];

  /**
   * Get agents by category
   */
  getByCategory(category: AgentCategory): AgentConfig[];

  /**
   * Check if an agent is enabled
   */
  isEnabled(agentId: string, context?: { orgId?: string }): Promise<boolean>;

  /**
   * Create an agent instance for a session
   */
  createInstance(
    agentId: string,
    sessionId: string,
    context?: Record<string, unknown>,
  ): Promise<AgentInstance>;
}
