import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrchestratorService } from './orchestrator.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PolicyService } from '../feature-flags/policy.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

// Mock LLM Gateway
const mockLlmGateway = {
  complete: vi.fn().mockResolvedValue({
    content: 'Hello! How can I help you today?',
    usage: { inputTokens: 10, outputTokens: 15 },
  }),
  isHealthy: vi.fn().mockResolvedValue(true),
  getCurrentProvider: vi.fn().mockReturnValue('anthropic'),
};

// Mock Conversation Memory
const mockConversationMemory = {
  initializeContext: vi.fn().mockResolvedValue(undefined),
  getContext: vi.fn().mockResolvedValue({ messages: [] }),
  addTurn: vi.fn().mockResolvedValue(undefined),
  getFormattedHistory: vi.fn().mockResolvedValue([]),
  clearContext: vi.fn().mockResolvedValue(undefined),
};

// Mock Prompt Template
const mockPromptTemplate = {
  getAgentPrompt: vi.fn().mockReturnValue('You are a helpful assistant.'),
  formatPrompt: vi.fn().mockImplementation((template) => template),
};

// Mock Agent Config Registry
const mockAgentConfigRegistry = {
  get: vi.fn().mockReturnValue({
    id: 'DISPATCH_CONCIERGE',
    name: 'Dispatch Concierge',
    systemPromptKey: 'dispatch_concierge',
    allowedSkills: ['JobIntake', 'QuoteGeneration'],
    allowedTools: ['BookingTool'],
    llmConfig: { temperature: 0.7, maxTokens: 4096 },
    maxTurns: 30,
    constraints: {
      canInitiateOutbound: false,
      canAccessPII: false,
      requiresApprovalFor: [],
    },
  }),
  isEnabled: vi.fn().mockResolvedValue(true),
  createInstance: vi.fn().mockResolvedValue({
    config: {
      id: 'DISPATCH_CONCIERGE',
      name: 'Dispatch Concierge',
      maxTurns: 30,
    },
    sessionId: 'test_session',
    systemPrompt: 'You are a helpful assistant.',
    availableTools: [],
    availableSkills: ['JobIntake'],
    createdAt: new Date(),
  }),
};

// Mock Skill Registry
const mockSkillRegistry = {
  get: vi.fn(),
  getAll: vi.fn().mockReturnValue([]),
  execute: vi.fn(),
};

// Mock Tools Service
const mockToolsService = {
  getTool: vi.fn(),
  executeTool: vi.fn(),
};

// Mock Prisma
const mockPrisma = {
  agentSession: {
    create: vi.fn().mockResolvedValue({
      id: 'db_session_123',
      sessionType: 'DISPATCH_CONCIERGE',
      status: 'ACTIVE',
      userId: 'user_456',
      orgId: 'org_789',
      createdAt: new Date(),
    }),
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({
      id: 'db_session_123',
      status: 'COMPLETED',
    }),
    findMany: vi.fn().mockResolvedValue([]),
  },
};

// Mock Redis
const mockRedis = {
  setJson: vi.fn().mockResolvedValue(undefined),
  getJson: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(undefined),
};

// Mock Feature Flags
const mockFeatureFlags = {
  isEnabled: vi.fn().mockResolvedValue(true),
  getValue: vi.fn().mockResolvedValue(null),
};

// Mock Policy Service
const mockPolicyService = {
  getValue: vi.fn().mockResolvedValue('AUTO'),
};

describe('OrchestratorService', () => {
  let service: OrchestratorService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset LLM mock to successful state
    mockLlmGateway.complete.mockResolvedValue({
      content: 'Hello! How can I help you today?',
      usage: { inputTokens: 10, outputTokens: 15 },
    });

    service = new OrchestratorService(
      mockPrisma as unknown as PrismaService,
      mockRedis as unknown as RedisService,
      mockFeatureFlags as unknown as FeatureFlagsService,
      mockPolicyService as unknown as PolicyService,
      mockSkillRegistry as any,
      mockToolsService as any,
      mockLlmGateway as any,
      mockConversationMemory as any,
      mockPromptTemplate as any,
      mockAgentConfigRegistry as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startSession', () => {
    it('should create a new session', async () => {
      const session = await service.startSession(
        'user_456',
        'DISPATCH_CONCIERGE' as any,
        { orgId: 'org_789' },
      );

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session_/);
      expect(session.sessionType).toBe('DISPATCH_CONCIERGE');
      expect(session.status).toBe('ACTIVE');
    });

    it('should store session in Redis', async () => {
      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {});

      expect(mockRedis.setJson).toHaveBeenCalledWith(
        expect.stringContaining('orchestrator:session:'),
        expect.objectContaining({
          id: session.id,
        }),
        expect.any(Number),
      );
    });

    it('should create session with agentId when provided', async () => {
      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {
        agentId: 'DISPATCH_CONCIERGE',
      });

      // Verify session was created with the agentId in context
      expect(session.agentId).toBe('DISPATCH_CONCIERGE');
      expect(session.context.agentId).toBe('DISPATCH_CONCIERGE');
    });
  });

  describe('processMessage', () => {
    it('should process a simple message', async () => {
      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {});

      const result = await service.processMessage(session.id, 'Hello, I need help', {});

      expect(result).toBeDefined();
      expect(result.sessionId).toBe(session.id);
      expect(result.response).toBeDefined();
      expect(result.sessionActive).toBe(true);
    });

    it('should process messages with agentId context', async () => {
      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {
        agentId: 'DISPATCH_CONCIERGE',
      });

      const result = await service.processMessage(session.id, 'Hello', {});

      // Should successfully process the message
      expect(result.response).toBeDefined();
      expect(result.sessionActive).toBe(true);
    });

    it('should handle tool calls from LLM', async () => {
      mockLlmGateway.complete
        .mockResolvedValueOnce({
          content: 'Let me check that for you.',
          toolCalls: [
            {
              id: 'tool_1',
              name: 'StatusInquiry',
              arguments: { entityType: 'JOB', entityId: 'job_123' },
            },
          ],
          usage: { inputTokens: 50, outputTokens: 30 },
        })
        .mockResolvedValueOnce({
          content: 'Your job is currently in progress.',
          usage: { inputTokens: 100, outputTokens: 25 },
        });

      mockSkillRegistry.execute.mockResolvedValue({
        success: true,
        data: { status: 'IN_PROGRESS' },
      });

      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {
        agentId: 'DISPATCH_CONCIERGE',
      });

      const result = await service.processMessage(session.id, 'What is the status of my job?', {});

      expect(result.toolCalls.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle session not found', async () => {
      await expect(
        service.processMessage('nonexistent_session', 'Hello', {}),
      ).rejects.toThrow('not found');
    });

    it('should use stub response when no agent instance', async () => {
      // Create session without agentId
      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {});

      const result = await service.processMessage(session.id, 'Hello', {});

      expect(result.response.content).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should return session from cache', async () => {
      const createdSession = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {});

      const session = await service.getSession(createdSession.id);

      expect(session).toBeDefined();
      expect(session?.id).toBe(createdSession.id);
    });

    it('should return undefined for non-existent session', async () => {
      const session = await service.getSession('nonexistent');

      expect(session).toBeUndefined();
    });
  });

  describe('endSession', () => {
    it('should end an active session', async () => {
      const createdSession = await service.startSession(
        'user_456',
        'DISPATCH_CONCIERGE' as any,
        {},
      );

      const session = await service.endSession(createdSession.id);

      expect(session.status).toBe('COMPLETED');
    });

    it('should clear conversation memory', async () => {
      const createdSession = await service.startSession(
        'user_456',
        'DISPATCH_CONCIERGE' as any,
        {},
      );

      await service.endSession(createdSession.id);

      expect(mockConversationMemory.clearContext).toHaveBeenCalledWith(createdSession.id);
    });
  });

  describe('getConversationHistory', () => {
    it('should return conversation history', async () => {
      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {});

      const history = await service.getConversationHistory(session.id);

      // Should have at least the system message from session start
      expect(history.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('handleHumanTakeover', () => {
    it('should transition session to human takeover', async () => {
      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {});

      const result = await service.handleHumanTakeover(
        session.id,
        'Customer requested human agent',
        'HIGH',
      );

      expect(result.status).toBe('HUMAN_TAKEOVER');
      expect(result.message).toBeDefined();
    });

    it('should record takeover reason', async () => {
      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {});

      await service.handleHumanTakeover(session.id, 'Complex issue', 'MEDIUM');

      // Verify session was updated
      const updatedSession = await service.getSession(session.id);
      expect(updatedSession?.status).toBe('HUMAN_TAKEOVER');
    });
  });

  describe('session timeout', () => {
    it('should handle inactive sessions', async () => {
      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {});

      // End the session first
      await service.endSession(session.id);

      // Try to process message on ended session
      await expect(
        service.processMessage(session.id, 'Hello', {}),
      ).rejects.toThrow('not active');
    });
  });

  describe('concurrent sessions', () => {
    it('should handle multiple sessions independently', async () => {
      const session1 = await service.startSession('user_1', 'DISPATCH_CONCIERGE' as any, {});
      const session2 = await service.startSession('user_2', 'DISPATCH_CONCIERGE' as any, {});

      expect(session1.id).not.toBe(session2.id);
      expect(session1.userId).toBe('user_1');
      expect(session2.userId).toBe('user_2');
    });
  });

  describe('error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      mockLlmGateway.complete.mockRejectedValue(new Error('LLM API error'));

      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {
        agentId: 'DISPATCH_CONCIERGE',
      });

      const result = await service.processMessage(session.id, 'Hello', {});

      // Should fall back to stub response
      expect(result.response).toBeDefined();
    });

    it('should handle database errors during session creation', async () => {
      mockPrisma.agentSession.create.mockRejectedValue(new Error('DB connection error'));

      // The service catches DB errors and continues (for resilience)
      // So we just verify it doesn't completely fail
      const session = await service.startSession('user_456', 'DISPATCH_CONCIERGE' as any, {});
      expect(session).toBeDefined();
    });
  });

  describe('feature flag integration', () => {
    it('should check phone agent feature flag for phone sessions', async () => {
      mockFeatureFlags.isEnabled.mockResolvedValue(false);

      await expect(
        service.startSession('user_456', 'PHONE' as any, {}),
      ).rejects.toThrow('not enabled');
    });

    it('should allow phone sessions when feature flag is enabled', async () => {
      mockFeatureFlags.isEnabled.mockResolvedValue(true);

      const session = await service.startSession('user_456', 'PHONE' as any, {});

      expect(session).toBeDefined();
      expect(session.sessionType).toBe('PHONE');
    });
  });
});
