import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  LlmGateway,
  LlmProvider,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmMessage,
  LlmToolDefinition,
  LlmToolCall,
  StreamEvent,
  ContentBlock,
  TokenUsage,
  StopReason,
  LlmGatewayConfig,
} from './llm-gateway.interface';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';

// ============================================
// CLAUDE PROVIDER
// ============================================

/**
 * Claude (Anthropic) LLM Provider
 */
class ClaudeProvider implements LlmProvider {
  readonly name = 'claude';
  private client: Anthropic | null = null;
  private readonly logger = new Logger(ClaudeProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly modelId: string,
    private readonly defaultMaxTokens: number = 4096,
    private readonly defaultTemperature: number = 0.7,
  ) {
    if (this.apiKey) {
      this.client = new Anthropic({ apiKey: this.apiKey });
      this.logger.log(`Claude provider initialized with model: ${this.modelId}`);
    } else {
      this.logger.warn('Claude provider not initialized: missing API key');
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    if (!this.client) {
      throw new Error('Claude provider not available');
    }

    const startTime = Date.now();

    try {
      // Convert messages to Anthropic format
      const anthropicMessages = this.convertMessages(request.messages);

      // Build request params
      const params: Anthropic.MessageCreateParams = {
        model: request.model || this.modelId,
        max_tokens: request.maxTokens || this.defaultMaxTokens,
        messages: anthropicMessages,
      };

      // Add system prompt if provided
      if (request.systemPrompt) {
        params.system = request.systemPrompt;
      }

      // Add temperature if provided
      if (request.temperature !== undefined) {
        params.temperature = request.temperature;
      } else {
        params.temperature = this.defaultTemperature;
      }

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        params.tools = this.convertTools(request.tools);
      }

      // Add stop sequences if provided
      if (request.stopSequences && request.stopSequences.length > 0) {
        params.stop_sequences = request.stopSequences;
      }

      // Make the API call
      const response = await this.client.messages.create(params);

      // Convert response
      return this.convertResponse(response, startTime);
    } catch (error) {
      this.logger.error('Claude completion failed:', error);
      throw error;
    }
  }

  async *stream(request: LlmCompletionRequest): AsyncIterable<StreamEvent> {
    if (!this.client) {
      throw new Error('Claude provider not available');
    }

    try {
      // Convert messages to Anthropic format
      const anthropicMessages = this.convertMessages(request.messages);

      // Build request params
      const params: Anthropic.MessageCreateParams = {
        model: request.model || this.modelId,
        max_tokens: request.maxTokens || this.defaultMaxTokens,
        messages: anthropicMessages,
        stream: true,
      };

      if (request.systemPrompt) {
        params.system = request.systemPrompt;
      }

      if (request.temperature !== undefined) {
        params.temperature = request.temperature;
      }

      if (request.tools && request.tools.length > 0) {
        params.tools = this.convertTools(request.tools);
      }

      // Stream the response
      const stream = this.client.messages.stream(params);

      for await (const event of stream) {
        yield this.convertStreamEvent(event);
      }
    } catch (error) {
      this.logger.error('Claude stream failed:', error);
      yield {
        type: 'error',
        error: {
          type: 'stream_error',
          message: error instanceof Error ? error.message : 'Stream failed',
        },
      };
    }
  }

  private convertMessages(messages: LlmMessage[]): Anthropic.MessageParam[] {
    return messages
      .filter((m) => m.role !== 'system') // System messages handled separately
      .map((message) => {
        if (typeof message.content === 'string') {
          return {
            role: message.role as 'user' | 'assistant',
            content: message.content,
          };
        }

        // Handle content blocks - convert to format expected by Anthropic API
        const contentBlocks = message.content.map((block) => {
          if (block.type === 'text') {
            return { type: 'text' as const, text: block.text };
          }
          if (block.type === 'tool_use') {
            return {
              type: 'tool_use' as const,
              id: block.id,
              name: block.name,
              input: block.input,
            };
          }
          if (block.type === 'tool_result') {
            return {
              type: 'tool_result' as const,
              tool_use_id: block.tool_use_id,
              content: block.content,
              is_error: block.is_error,
            };
          }
          return { type: 'text' as const, text: '' };
        });

        return {
          role: message.role as 'user' | 'assistant',
          content: contentBlocks as Anthropic.MessageParam['content'],
        };
      });
  }

  private convertTools(tools: LlmToolDefinition[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
    }));
  }

  private convertResponse(
    response: Anthropic.Message,
    startTime: number,
  ): LlmCompletionResponse {
    // Extract text content
    let textContent = '';
    const contentBlocks: ContentBlock[] = [];
    const toolCalls: LlmToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
        contentBlocks.push({ type: 'text', text: block.text });
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
        contentBlocks.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    // Map stop reason
    const stopReasonMap: Record<string, StopReason> = {
      end_turn: 'end_turn',
      max_tokens: 'max_tokens',
      stop_sequence: 'stop_sequence',
      tool_use: 'tool_use',
    };

    return {
      id: response.id,
      model: response.model,
      content: textContent,
      contentBlocks,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: stopReasonMap[response.stop_reason || 'end_turn'] || 'end_turn',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        cacheReadTokens: (response.usage as any).cache_read_input_tokens,
        cacheCreationTokens: (response.usage as any).cache_creation_input_tokens,
      },
      metadata: {
        latencyMs: Date.now() - startTime,
        provider: 'claude',
      },
    };
  }

  private convertStreamEvent(event: any): StreamEvent {
    // Map Anthropic stream events to our interface
    if (event.type === 'content_block_delta') {
      if (event.delta?.type === 'text_delta') {
        return {
          type: 'content_block_delta',
          index: event.index,
          delta: {
            type: 'text_delta',
            text: event.delta.text,
          },
        };
      }
      if (event.delta?.type === 'input_json_delta') {
        return {
          type: 'content_block_delta',
          index: event.index,
          delta: {
            type: 'input_json_delta',
            partial_json: event.delta.partial_json,
          },
        };
      }
    }

    return { type: event.type };
  }
}

// ============================================
// LLM GATEWAY SERVICE
// ============================================

/**
 * LlmGatewayService - Central service for LLM interactions
 *
 * Provides:
 * - Provider abstraction (Claude primary, OpenAI fallback)
 * - Automatic failover
 * - Token usage tracking
 * - Streaming support
 * - Rate limit handling
 */
@Injectable()
export class LlmGatewayService implements LlmGateway, OnModuleInit {
  private readonly logger = new Logger(LlmGatewayService.name);
  private primaryProvider: LlmProvider | null = null;
  private fallbackProvider: LlmProvider | null = null;
  private config: LlmGatewayConfig;
  private currentProvider: string = 'none';

  // Token estimation (rough approximation)
  private readonly CHARS_PER_TOKEN = 4;

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
  ) {
    // Load configuration from environment
    this.config = this.loadConfig();
  }

  async onModuleInit() {
    await this.initializeProviders();
  }

  private loadConfig(): LlmGatewayConfig {
    return {
      primary: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        modelId: process.env.CLAUDE_MODEL_ID || 'claude-sonnet-4-20250514',
        defaultMaxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096', 10),
        defaultTemperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
        timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '60000', 10),
        maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3', 10),
      },
      fallback: {
        apiKey: process.env.OPENAI_API_KEY || '',
        modelId: process.env.OPENAI_MODEL_ID || 'gpt-4-turbo',
        defaultMaxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096', 10),
        defaultTemperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
      },
      fallbackEnabled: process.env.LLM_FALLBACK_ENABLED === 'true',
      streamingEnabled: process.env.LLM_STREAMING_ENABLED !== 'false',
      cachingEnabled: process.env.LLM_CACHING_ENABLED === 'true',
      cacheTtlSeconds: parseInt(process.env.LLM_CACHE_TTL_SECONDS || '3600', 10),
    };
  }

  private async initializeProviders() {
    // Check if LLM is enabled
    const llmEnabled = await this.featureFlagsService.isEnabled('LLM_CLAUDE_ENABLED', {});
    if (!llmEnabled) {
      this.logger.warn('LLM is disabled by feature flag');
      return;
    }

    // Initialize Claude provider
    if (this.config.primary.apiKey) {
      this.primaryProvider = new ClaudeProvider(
        this.config.primary.apiKey,
        this.config.primary.modelId,
        this.config.primary.defaultMaxTokens,
        this.config.primary.defaultTemperature,
      );
      this.currentProvider = 'claude';
      this.logger.log('Claude provider initialized as primary');
    }

    // Initialize OpenAI fallback (stub for now)
    if (this.config.fallbackEnabled && this.config.fallback?.apiKey) {
      // TODO: Implement OpenAI provider
      this.logger.log('OpenAI fallback configured (not yet implemented)');
    }

    if (!this.primaryProvider) {
      this.logger.warn('No LLM provider available - API key not configured');
    }
  }

  /**
   * Send a completion request
   */
  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const startTime = Date.now();

    try {
      // Try primary provider
      if (this.primaryProvider?.isAvailable()) {
        const response = await this.primaryProvider.complete(request);
        this.logUsage(request, response);
        return response;
      }

      // Try fallback provider
      if (this.config.fallbackEnabled && this.fallbackProvider?.isAvailable()) {
        this.logger.warn('Primary provider unavailable, using fallback');
        const response = await this.fallbackProvider.complete(request);
        this.logUsage(request, response);
        return response;
      }

      throw new Error('No LLM provider available');
    } catch (error) {
      this.logger.error('LLM completion failed:', error);

      // Try fallback on error
      if (this.config.fallbackEnabled && this.fallbackProvider?.isAvailable() && this.primaryProvider?.isAvailable()) {
        this.logger.warn('Primary provider failed, attempting fallback');
        try {
          const response = await this.fallbackProvider.complete(request);
          this.logUsage(request, response);
          return response;
        } catch (fallbackError) {
          this.logger.error('Fallback provider also failed:', fallbackError);
        }
      }

      throw error;
    }
  }

  /**
   * Stream a completion request
   */
  async *stream(request: LlmCompletionRequest): AsyncIterable<StreamEvent> {
    if (!this.config.streamingEnabled) {
      throw new Error('Streaming is disabled');
    }

    // Check feature flag for streaming
    const streamingEnabled = await this.featureFlagsService.isEnabled('LLM_STREAMING_ENABLED', {});
    if (!streamingEnabled) {
      throw new Error('Streaming is disabled by feature flag');
    }

    if (this.primaryProvider?.isAvailable() && 'stream' in this.primaryProvider) {
      yield* (this.primaryProvider as any).stream(request);
      return;
    }

    throw new Error('Streaming not available');
  }

  /**
   * Estimate token count for messages
   */
  estimateTokens(messages: LlmMessage[]): number {
    let totalChars = 0;

    for (const message of messages) {
      if (typeof message.content === 'string') {
        totalChars += message.content.length;
      } else {
        for (const block of message.content) {
          if (block.type === 'text') {
            totalChars += block.text.length;
          } else if (block.type === 'tool_result') {
            totalChars += block.content.length;
          }
        }
      }
    }

    return Math.ceil(totalChars / this.CHARS_PER_TOKEN);
  }

  /**
   * Check gateway health
   */
  async isHealthy(): Promise<boolean> {
    return (
      (this.primaryProvider?.isAvailable() ?? false) ||
      (this.fallbackProvider?.isAvailable() ?? false)
    );
  }

  /**
   * Get current provider name
   */
  getCurrentProvider(): string {
    return this.currentProvider;
  }

  /**
   * Convert tool definitions for LLM
   * Helper for orchestrator to format tools
   */
  formatToolsForLlm(tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>): LlmToolDefinition[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as any,
    }));
  }

  /**
   * Log token usage for monitoring
   */
  private logUsage(request: LlmCompletionRequest, response: LlmCompletionResponse) {
    this.logger.debug('LLM usage', {
      sessionId: request.metadata?.sessionId,
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.metadata?.latencyMs,
      hasToolCalls: (response.toolCalls?.length ?? 0) > 0,
    });
  }
}
