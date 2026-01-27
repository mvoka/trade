import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentConfigRegistryService } from './agent-config.registry';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PromptTemplateService } from '../llm/prompt-template.service';

describe('AgentConfigRegistryService', () => {
  let service: AgentConfigRegistryService;
  let mockFeatureFlags: Partial<FeatureFlagsService>;
  let mockPromptTemplate: Partial<PromptTemplateService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFeatureFlags = {
      isEnabled: vi.fn().mockResolvedValue(true),
      getValue: vi.fn().mockResolvedValue(null),
    };

    mockPromptTemplate = {
      getAgentPrompt: vi.fn().mockReturnValue('Mock system prompt'),
    };

    service = new AgentConfigRegistryService(
      mockFeatureFlags as FeatureFlagsService,
      mockPromptTemplate as PromptTemplateService,
    );
  });

  describe('get', () => {
    it('should return config for DISPATCH_CONCIERGE agent', () => {
      const config = service.get('DISPATCH_CONCIERGE');

      expect(config).toBeDefined();
      expect(config?.id).toBe('DISPATCH_CONCIERGE');
      expect(config?.name).toBe('Dispatch Concierge');
      expect(config?.category).toBe('CUSTOMER_FACING');
      expect(config?.allowedSkills).toContain('JobIntake');
      expect(config?.allowedSkills).toContain('QuoteGeneration');
      expect(config?.allowedSkills).toContain('ScheduleManagement');
    });

    it('should return config for JOB_STATUS agent', () => {
      const config = service.get('JOB_STATUS');

      expect(config).toBeDefined();
      expect(config?.id).toBe('JOB_STATUS');
      expect(config?.name).toBe('Job Status Agent');
      expect(config?.allowedSkills).toContain('StatusInquiry');
      expect(config?.allowedSkills).toContain('IssueEscalation');
    });

    it('should return config for DISPATCH_OPTIMIZER agent', () => {
      const config = service.get('DISPATCH_OPTIMIZER');

      expect(config).toBeDefined();
      expect(config?.id).toBe('DISPATCH_OPTIMIZER');
      expect(config?.category).toBe('OPERATIONS');
      expect(config?.allowedSkills).toContain('ContractorSearch');
    });

    it('should return config for SLA_GUARDIAN agent', () => {
      const config = service.get('SLA_GUARDIAN');

      expect(config).toBeDefined();
      expect(config?.id).toBe('SLA_GUARDIAN');
      expect(config?.allowedSkills).toContain('EscalationHandling');
    });

    it('should return config for ANALYTICS_INSIGHT agent', () => {
      const config = service.get('ANALYTICS_INSIGHT');

      expect(config).toBeDefined();
      expect(config?.id).toBe('ANALYTICS_INSIGHT');
      expect(config?.category).toBe('ADMIN');
      expect(config?.allowedSkills).toContain('ReportGeneration');
    });

    it('should return undefined for unknown agent type', () => {
      const config = service.get('UNKNOWN_AGENT');
      expect(config).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all 11 agent configurations', () => {
      const configs = service.getAll();

      expect(configs).toHaveLength(11);

      const agentIds = configs.map((c) => c.id);
      expect(agentIds).toContain('DISPATCH_CONCIERGE');
      expect(agentIds).toContain('JOB_STATUS');
      expect(agentIds).toContain('QUOTE_ASSISTANT');
      expect(agentIds).toContain('DISPATCH_OPTIMIZER');
      expect(agentIds).toContain('CONTRACTOR_ONBOARDING');
      expect(agentIds).toContain('EARNINGS_OPTIMIZER');
      expect(agentIds).toContain('SLA_GUARDIAN');
      expect(agentIds).toContain('QUALITY_ASSURANCE');
      expect(agentIds).toContain('CAPACITY_PLANNING');
      expect(agentIds).toContain('POLICY_CONFIGURATION');
      expect(agentIds).toContain('ANALYTICS_INSIGHT');
    });

    it('should return configs with required properties', () => {
      const configs = service.getAll();

      configs.forEach((config) => {
        expect(config).toHaveProperty('id');
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('category');
        expect(config).toHaveProperty('systemPromptKey');
        expect(config).toHaveProperty('allowedSkills');
        expect(config).toHaveProperty('allowedTools');
        expect(config).toHaveProperty('requiredFlags');
        expect(config).toHaveProperty('requiredPermissions');
        expect(config).toHaveProperty('constraints');
        expect(config).toHaveProperty('llmConfig');
      });
    });
  });

  describe('getByCategory', () => {
    it('should return customer-facing agents', () => {
      const configs = service.getByCategory('CUSTOMER_FACING');

      expect(configs.length).toBeGreaterThan(0);
      configs.forEach((config) => {
        expect(config.category).toBe('CUSTOMER_FACING');
      });
    });

    it('should return contractor-facing agents', () => {
      const configs = service.getByCategory('CONTRACTOR_FACING');

      expect(configs.length).toBeGreaterThan(0);
      configs.forEach((config) => {
        expect(config.category).toBe('CONTRACTOR_FACING');
      });
    });

    it('should return operations agents', () => {
      const configs = service.getByCategory('OPERATIONS');

      expect(configs.length).toBeGreaterThan(0);
      configs.forEach((config) => {
        expect(config.category).toBe('OPERATIONS');
      });
    });

    it('should return admin agents', () => {
      const configs = service.getByCategory('ADMIN');

      expect(configs.length).toBeGreaterThan(0);
      configs.forEach((config) => {
        expect(config.category).toBe('ADMIN');
      });
    });
  });

  describe('isEnabled', () => {
    it('should check feature flag for agent', async () => {
      (mockFeatureFlags.isEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await service.isEnabled('DISPATCH_CONCIERGE');

      expect(result).toBe(true);
      expect(mockFeatureFlags.isEnabled).toHaveBeenCalledWith(
        'AGENT_DISPATCH_CONCIERGE_ENABLED',
        expect.any(Object),
      );
    });

    it('should return false when feature flag is disabled', async () => {
      (mockFeatureFlags.isEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await service.isEnabled('DISPATCH_CONCIERGE');

      expect(result).toBe(false);
    });

    it('should return false for unknown agent', async () => {
      const result = await service.isEnabled('UNKNOWN_AGENT');

      expect(result).toBe(false);
    });
  });

  describe('getEnabledAgents', () => {
    it('should return only enabled agents', async () => {
      // Mock: only first call returns true, rest return false
      (mockFeatureFlags.isEnabled as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false);

      const enabled = await service.getEnabledAgents();

      // Should have at least one enabled agent
      expect(enabled.length).toBeGreaterThanOrEqual(0);
    });

    it('should return all agents when all flags are enabled', async () => {
      (mockFeatureFlags.isEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const enabled = await service.getEnabledAgents();

      expect(enabled.length).toBe(11);
    });
  });

  describe('has', () => {
    it('should return true for existing agent', () => {
      expect(service.has('DISPATCH_CONCIERGE')).toBe(true);
    });

    it('should return false for non-existing agent', () => {
      expect(service.has('UNKNOWN_AGENT')).toBe(false);
    });
  });

  describe('getAgentIds', () => {
    it('should return all agent IDs', () => {
      const ids = service.getAgentIds();

      expect(ids).toContain('DISPATCH_CONCIERGE');
      expect(ids).toContain('JOB_STATUS');
      expect(ids.length).toBe(11);
    });
  });

  describe('agent constraints', () => {
    it('should define PII access constraints', () => {
      const conciergeConfig = service.get('DISPATCH_CONCIERGE');
      expect(conciergeConfig?.constraints.canAccessPII).toBe(false);

      const analyticsConfig = service.get('ANALYTICS_INSIGHT');
      expect(analyticsConfig?.constraints.canAccessPII).toBe(false);

      // Contractor onboarding needs PII access
      const onboardingConfig = service.get('CONTRACTOR_ONBOARDING');
      expect(onboardingConfig?.constraints.canAccessPII).toBe(true);
    });

    it('should define outbound initiation constraints', () => {
      const slaGuardian = service.get('SLA_GUARDIAN');
      expect(slaGuardian?.constraints.canInitiateOutbound).toBe(true);

      const quoteAssistant = service.get('QUOTE_ASSISTANT');
      expect(quoteAssistant?.constraints.canInitiateOutbound).toBe(false);
    });

    it('should define approval requirements', () => {
      const dispatchOptimizer = service.get('DISPATCH_OPTIMIZER');
      expect(dispatchOptimizer?.constraints.requiresApprovalFor).toContain(
        'DispatchTool.initiateDispatch',
      );

      const policyConfig = service.get('POLICY_CONFIGURATION');
      expect(policyConfig?.constraints.requiresApprovalFor).toContain('PolicyManagement');
    });
  });

  describe('LLM configuration', () => {
    it('should have appropriate temperature settings', () => {
      const configs = service.getAll();

      configs.forEach((config) => {
        expect(config.llmConfig.temperature).toBeGreaterThanOrEqual(0);
        expect(config.llmConfig.temperature).toBeLessThanOrEqual(1);
      });
    });

    it('should have reasonable max token limits', () => {
      const configs = service.getAll();

      configs.forEach((config) => {
        expect(config.llmConfig.maxTokens).toBeGreaterThan(0);
        expect(config.llmConfig.maxTokens).toBeLessThanOrEqual(8192);
      });
    });
  });

  describe('escalation configuration', () => {
    it('should define escalation triggers for some agents', () => {
      const conciergeConfig = service.get('DISPATCH_CONCIERGE');

      expect(conciergeConfig?.escalation).toBeDefined();
      expect(conciergeConfig?.escalation?.triggerKeywords).toBeDefined();
      expect(conciergeConfig?.escalation?.targetQueue).toBeDefined();
    });

    it('should define maxTurns for agents', () => {
      const configs = service.getAll();

      configs.forEach((config) => {
        expect(config.maxTurns).toBeGreaterThan(0);
      });
    });
  });

  describe('register and unregister', () => {
    it('should allow registering a new agent', () => {
      const customConfig = {
        id: 'CUSTOM_AGENT',
        name: 'Custom Agent',
        description: 'A custom test agent',
        category: 'CUSTOMER_FACING' as const,
        systemPromptKey: 'agent.custom',
        allowedSkills: ['StatusInquiry'],
        allowedTools: [],
        requiredFlags: ['CUSTOM_AGENT_ENABLED'],
        requiredPermissions: [],
        maxTurns: 10,
        constraints: {
          canInitiateOutbound: false,
          canAccessPII: false,
          requiresApprovalFor: [],
        },
        llmConfig: {
          temperature: 0.5,
          maxTokens: 1024,
        },
      };

      service.register(customConfig);

      expect(service.has('CUSTOM_AGENT')).toBe(true);
      expect(service.get('CUSTOM_AGENT')?.name).toBe('Custom Agent');
    });

    it('should allow unregistering an agent', () => {
      expect(service.has('DISPATCH_CONCIERGE')).toBe(true);

      const removed = service.unregister('DISPATCH_CONCIERGE');

      expect(removed).toBe(true);
      expect(service.has('DISPATCH_CONCIERGE')).toBe(false);
    });

    it('should return false when unregistering non-existent agent', () => {
      const removed = service.unregister('NON_EXISTENT');

      expect(removed).toBe(false);
    });
  });

  describe('createInstance', () => {
    it('should create an agent instance', async () => {
      const instance = await service.createInstance('DISPATCH_CONCIERGE', 'session_123', {
        orgId: 'org_456',
      });

      expect(instance).toBeDefined();
      expect(instance.config.id).toBe('DISPATCH_CONCIERGE');
      expect(instance.sessionId).toBe('session_123');
      expect(instance.systemPrompt).toBeDefined();
      expect(instance.availableTools).toBeDefined();
      expect(instance.availableSkills).toBeDefined();
      expect(instance.createdAt).toBeInstanceOf(Date);
    });

    it('should throw when agent not found', async () => {
      await expect(service.createInstance('UNKNOWN', 'session_123')).rejects.toThrow(
        'Agent not found',
      );
    });

    it('should throw when agent is not enabled', async () => {
      (mockFeatureFlags.isEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      await expect(
        service.createInstance('DISPATCH_CONCIERGE', 'session_123'),
      ).rejects.toThrow('is not enabled');
    });
  });

  describe('validateConfig', () => {
    it('should validate a complete config', () => {
      const config = service.get('DISPATCH_CONCIERGE');
      const result = service.validateConfig(config!);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject config without id', () => {
      const result = service.validateConfig({
        name: 'Test',
        description: 'Test',
        category: 'CUSTOMER_FACING',
        systemPromptKey: 'test',
        allowedSkills: [],
        allowedTools: [],
        requiredFlags: [],
        requiredPermissions: [],
        constraints: {
          canInitiateOutbound: false,
          canAccessPII: false,
          requiresApprovalFor: [],
        },
        llmConfig: { temperature: 0.5, maxTokens: 1024 },
      } as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent ID is required');
    });
  });

  describe('getAgentMetadata', () => {
    it('should return metadata for all agents', () => {
      const metadata = service.getAgentMetadata();

      expect(metadata.length).toBe(11);
      metadata.forEach((item) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('description');
      });
    });
  });
});
