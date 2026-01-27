/**
 * LLM Gateway Interface Definitions
 *
 * Provides provider-agnostic interfaces for LLM integration.
 * Supports Claude (primary) and OpenAI (fallback) providers.
 */

// ============================================
// MESSAGE TYPES
// ============================================

/**
 * Role for conversation messages
 */
export type LlmMessageRole = 'user' | 'assistant' | 'system';

/**
 * Content block types
 */
export type ContentBlockType = 'text' | 'tool_use' | 'tool_result';

/**
 * Text content block
 */
export interface TextContentBlock {
  type: 'text';
  text: string;
}

/**
 * Tool use content block (when LLM wants to call a tool)
 */
export interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result content block (response from tool execution)
 */
export interface ToolResultContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/**
 * Union of all content block types
 */
export type ContentBlock = TextContentBlock | ToolUseContentBlock | ToolResultContentBlock;

/**
 * Conversation message
 */
export interface LlmMessage {
  role: LlmMessageRole;
  content: string | ContentBlock[];
}

// ============================================
// TOOL DEFINITIONS
// ============================================

/**
 * JSON Schema for tool input
 */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    items?: { type: string };
    required?: boolean;
  }>;
  required?: string[];
}

/**
 * Tool definition for LLM
 */
export interface LlmToolDefinition {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

/**
 * Stop reason for completion
 */
export type StopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';

/**
 * Token usage statistics
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

/**
 * Tool call from LLM response
 */
export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * LLM completion request
 */
export interface LlmCompletionRequest {
  /** Conversation messages */
  messages: LlmMessage[];

  /** System prompt (optional, can also be first message) */
  systemPrompt?: string;

  /** Available tools for the model to call */
  tools?: LlmToolDefinition[];

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Temperature for response randomness (0-1) */
  temperature?: number;

  /** Stop sequences */
  stopSequences?: string[];

  /** Model override (uses default if not specified) */
  model?: string;

  /** Enable streaming */
  stream?: boolean;

  /** Request metadata for tracking */
  metadata?: {
    sessionId?: string;
    userId?: string;
    agentType?: string;
    [key: string]: unknown;
  };
}

/**
 * LLM completion response
 */
export interface LlmCompletionResponse {
  /** Response ID */
  id: string;

  /** Model used */
  model: string;

  /** Text content from the response */
  content: string;

  /** Content blocks (for structured responses) */
  contentBlocks?: ContentBlock[];

  /** Tool calls if any */
  toolCalls?: LlmToolCall[];

  /** Stop reason */
  stopReason: StopReason;

  /** Token usage */
  usage: TokenUsage;

  /** Response metadata */
  metadata?: {
    latencyMs?: number;
    provider?: string;
    cached?: boolean;
    [key: string]: unknown;
  };
}

// ============================================
// STREAMING TYPES
// ============================================

/**
 * Stream event types
 */
export type StreamEventType =
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop'
  | 'error';

/**
 * Base stream event
 */
export interface StreamEventBase {
  type: StreamEventType;
}

/**
 * Text delta event
 */
export interface TextDeltaEvent extends StreamEventBase {
  type: 'content_block_delta';
  index: number;
  delta: {
    type: 'text_delta';
    text: string;
  };
}

/**
 * Tool use delta event
 */
export interface ToolUseDeltaEvent extends StreamEventBase {
  type: 'content_block_delta';
  index: number;
  delta: {
    type: 'input_json_delta';
    partial_json: string;
  };
}

/**
 * Message stop event
 */
export interface MessageStopEvent extends StreamEventBase {
  type: 'message_stop';
  message: LlmCompletionResponse;
}

/**
 * Error event
 */
export interface ErrorEvent extends StreamEventBase {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

/**
 * Stream event union
 */
export type StreamEvent =
  | TextDeltaEvent
  | ToolUseDeltaEvent
  | MessageStopEvent
  | ErrorEvent
  | StreamEventBase;

// ============================================
// PROVIDER INTERFACE
// ============================================

/**
 * LLM Provider interface
 * Implemented by each provider (Claude, OpenAI, etc.)
 */
export interface LlmProvider {
  /** Provider name */
  readonly name: string;

  /** Check if provider is available */
  isAvailable(): boolean;

  /** Complete a conversation */
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;

  /** Stream a conversation completion */
  stream?(request: LlmCompletionRequest): AsyncIterable<StreamEvent>;
}

// ============================================
// GATEWAY INTERFACE
// ============================================

/**
 * LLM Gateway interface
 * High-level interface for LLM operations with provider abstraction
 */
export interface LlmGateway {
  /**
   * Send a completion request
   * Automatically handles provider selection and fallback
   */
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;

  /**
   * Stream a completion request
   * Returns async iterator of stream events
   */
  stream(request: LlmCompletionRequest): AsyncIterable<StreamEvent>;

  /**
   * Get token count estimate for messages
   * Useful for context window management
   */
  estimateTokens(messages: LlmMessage[]): number;

  /**
   * Check if the gateway is healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get current provider name
   */
  getCurrentProvider(): string;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

/**
 * Provider configuration
 */
export interface LlmProviderConfig {
  /** API key */
  apiKey: string;

  /** Model ID to use */
  modelId: string;

  /** Base URL override */
  baseUrl?: string;

  /** Default max tokens */
  defaultMaxTokens?: number;

  /** Default temperature */
  defaultTemperature?: number;

  /** Request timeout in milliseconds */
  timeoutMs?: number;

  /** Maximum retries */
  maxRetries?: number;
}

/**
 * Gateway configuration
 */
export interface LlmGatewayConfig {
  /** Primary provider config (Claude) */
  primary: LlmProviderConfig;

  /** Fallback provider config (OpenAI) */
  fallback?: LlmProviderConfig;

  /** Enable fallback */
  fallbackEnabled?: boolean;

  /** Enable streaming */
  streamingEnabled?: boolean;

  /** Enable caching */
  cachingEnabled?: boolean;

  /** Cache TTL in seconds */
  cacheTtlSeconds?: number;
}
