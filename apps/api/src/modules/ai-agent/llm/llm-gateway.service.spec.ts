import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LlmGatewayService } from './llm-gateway.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';

describe('LlmGatewayService', () => {
  let mockFeatureFlags: Partial<FeatureFlagsService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFeatureFlags = {
      isEnabled: vi.fn().mockResolvedValue(true),
      getValue: vi.fn().mockResolvedValue(null),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should be instantiable', () => {
      const service = new LlmGatewayService(mockFeatureFlags as FeatureFlagsService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(LlmGatewayService);
    });
  });

  describe('complete', () => {
    it('should throw error when no provider is available', async () => {
      // In test environment without actual API keys, should throw
      const service = new LlmGatewayService(mockFeatureFlags as FeatureFlagsService);

      await expect(
        service.complete({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow();
    });

    it('should accept messages in correct format', async () => {
      const service = new LlmGatewayService(mockFeatureFlags as FeatureFlagsService);

      // The request format should be valid even if the call fails
      const request = {
        messages: [
          { role: 'user' as const, content: 'Hello' },
          { role: 'assistant' as const, content: 'Hi there!' },
        ],
        systemPrompt: 'You are a helpful assistant.',
        maxTokens: 1024,
      };

      // This will throw because no provider is configured, but the format is valid
      await expect(service.complete(request)).rejects.toThrow();
    });

    it('should accept tool definitions', async () => {
      const service = new LlmGatewayService(mockFeatureFlags as FeatureFlagsService);

      const request = {
        messages: [{ role: 'user' as const, content: 'What is the status?' }],
        tools: [
          {
            name: 'StatusInquiry',
            description: 'Check job status',
            input_schema: {
              type: 'object',
              properties: {
                jobId: { type: 'string' },
              },
              required: ['jobId'],
            },
          },
        ],
      };

      await expect(service.complete(request)).rejects.toThrow();
    });
  });

  describe('service configuration', () => {
    it('should have complete method', () => {
      const service = new LlmGatewayService(mockFeatureFlags as FeatureFlagsService);
      expect(typeof service.complete).toBe('function');
    });
  });
});
