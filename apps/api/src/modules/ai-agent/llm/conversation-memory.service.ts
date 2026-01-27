import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LlmMessage, LlmMessageRole } from './llm-gateway.interface';

// ============================================
// CONVERSATION MEMORY INTERFACES
// ============================================

/**
 * Stored conversation turn
 */
export interface ConversationMemoryTurn {
  id: string;
  role: LlmMessageRole | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    toolName?: string;
    toolCallId?: string;
    isError?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Conversation context for LLM
 */
export interface ConversationContext {
  sessionId: string;
  agentType: string;
  systemPrompt: string;
  turns: ConversationMemoryTurn[];
  summary?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  /** Max turns to keep in context */
  maxTurns: number;
  /** Max tokens for context window */
  maxContextTokens: number;
  /** Enable summarization for long conversations */
  enableSummarization: boolean;
  /** Turns before triggering summarization */
  summarizationThreshold: number;
}

// ============================================
// CONVERSATION MEMORY SERVICE
// ============================================

/**
 * ConversationMemoryService - Manages conversation context for AI agents
 *
 * Responsibilities:
 * - Store and retrieve conversation history
 * - Manage context window size
 * - Summarize long conversations
 * - Cache sessions in Redis
 * - Persist to database
 */
@Injectable()
export class ConversationMemoryService {
  private readonly logger = new Logger(ConversationMemoryService.name);

  // Default configuration
  private readonly defaultConfig: MemoryConfig = {
    maxTurns: 50,
    maxContextTokens: 100000, // Claude's context window
    enableSummarization: true,
    summarizationThreshold: 30,
  };

  // Token estimation
  private readonly CHARS_PER_TOKEN = 4;

  // Redis key prefixes
  private readonly REDIS_PREFIX = 'agent:session:';
  private readonly REDIS_TTL_SECONDS = 3600; // 1 hour

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('ConversationMemoryService initialized');
  }

  // ============================================
  // CONTEXT MANAGEMENT
  // ============================================

  /**
   * Get conversation context for LLM
   * Retrieves turns and formats them for the model
   */
  async getContext(
    sessionId: string,
    config?: Partial<MemoryConfig>,
  ): Promise<ConversationContext | null> {
    const mergedConfig = { ...this.defaultConfig, ...config };

    // Try Redis cache first
    const cached = await this.getCachedContext(sessionId);
    if (cached) {
      return this.trimContext(cached, mergedConfig);
    }

    // Fall back to database
    const dbContext = await this.loadFromDatabase(sessionId);
    if (dbContext) {
      // Cache for future requests
      await this.cacheContext(sessionId, dbContext);
      return this.trimContext(dbContext, mergedConfig);
    }

    return null;
  }

  /**
   * Add a turn to the conversation
   */
  async addTurn(
    sessionId: string,
    turn: Omit<ConversationMemoryTurn, 'id' | 'timestamp'>,
  ): Promise<ConversationMemoryTurn> {
    const fullTurn: ConversationMemoryTurn = {
      id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...turn,
    };

    // Get existing context
    let context = await this.getCachedContext(sessionId);
    if (!context) {
      context = await this.loadFromDatabase(sessionId);
    }

    if (context) {
      context.turns.push(fullTurn);

      // Check if summarization is needed
      if (
        this.defaultConfig.enableSummarization &&
        context.turns.length >= this.defaultConfig.summarizationThreshold
      ) {
        // Summarization would happen here (requires LLM call)
        this.logger.debug(`Session ${sessionId} may need summarization`);
      }

      // Update cache
      await this.cacheContext(sessionId, context);
    }

    // Persist to database
    await this.persistTurn(sessionId, fullTurn);

    return fullTurn;
  }

  /**
   * Initialize a new conversation context
   */
  async initializeContext(
    sessionId: string,
    agentType: string,
    systemPrompt: string,
    metadata?: Record<string, unknown>,
  ): Promise<ConversationContext> {
    const context: ConversationContext = {
      sessionId,
      agentType,
      systemPrompt,
      turns: [],
      metadata,
    };

    // Cache the new context
    await this.cacheContext(sessionId, context);

    this.logger.debug(`Initialized context for session ${sessionId}`);

    return context;
  }

  /**
   * Clear conversation context
   */
  async clearContext(sessionId: string): Promise<void> {
    // Remove from cache
    await this.redis.del(`${this.REDIS_PREFIX}${sessionId}`);

    this.logger.debug(`Cleared context for session ${sessionId}`);
  }

  // ============================================
  // MESSAGE FORMATTING
  // ============================================

  /**
   * Format turns for LLM consumption
   * Converts stored turns to LLM message format
   */
  formatForLlm(context: ConversationContext): LlmMessage[] {
    const messages: LlmMessage[] = [];

    for (const turn of context.turns) {
      if (turn.role === 'tool') {
        // Tool results need special formatting
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: turn.metadata?.toolCallId || '',
              content: turn.content,
              is_error: turn.metadata?.isError,
            },
          ],
        });
      } else {
        messages.push({
          role: turn.role as LlmMessageRole,
          content: turn.content,
        });
      }
    }

    return messages;
  }

  /**
   * Get the system prompt from context
   */
  getSystemPrompt(context: ConversationContext): string {
    let prompt = context.systemPrompt;

    // Add summary if available
    if (context.summary) {
      prompt += `\n\n## Previous Conversation Summary\n${context.summary}`;
    }

    return prompt;
  }

  // ============================================
  // CONTEXT WINDOW MANAGEMENT
  // ============================================

  /**
   * Trim context to fit within limits
   */
  private trimContext(
    context: ConversationContext,
    config: MemoryConfig,
  ): ConversationContext {
    let trimmedTurns = [...context.turns];

    // Trim by turn count
    if (trimmedTurns.length > config.maxTurns) {
      // Keep the most recent turns, preserve system context
      const toRemove = trimmedTurns.length - config.maxTurns;
      trimmedTurns = trimmedTurns.slice(toRemove);
      this.logger.debug(`Trimmed ${toRemove} turns from context`);
    }

    // Trim by token count
    let totalTokens = this.estimateTokens(context.systemPrompt);
    const keepTurns: ConversationMemoryTurn[] = [];

    // Work backwards to keep most recent turns
    for (let i = trimmedTurns.length - 1; i >= 0; i--) {
      const turnTokens = this.estimateTokens(trimmedTurns[i].content);
      if (totalTokens + turnTokens <= config.maxContextTokens) {
        keepTurns.unshift(trimmedTurns[i]);
        totalTokens += turnTokens;
      } else {
        this.logger.debug(`Token limit reached, trimmed ${i + 1} additional turns`);
        break;
      }
    }

    return {
      ...context,
      turns: keepTurns,
    };
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  // ============================================
  // CACHING
  // ============================================

  /**
   * Get context from Redis cache
   */
  private async getCachedContext(sessionId: string): Promise<ConversationContext | null> {
    try {
      const cached = await this.redis.getJson<ConversationContext>(
        `${this.REDIS_PREFIX}${sessionId}`,
      );
      if (cached) {
        // Rehydrate dates
        cached.turns = cached.turns.map((turn) => ({
          ...turn,
          timestamp: new Date(turn.timestamp),
        }));
      }
      return cached;
    } catch (error) {
      this.logger.error(`Failed to get cached context for ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Cache context in Redis
   */
  private async cacheContext(sessionId: string, context: ConversationContext): Promise<void> {
    try {
      await this.redis.setJson(
        `${this.REDIS_PREFIX}${sessionId}`,
        context,
        this.REDIS_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(`Failed to cache context for ${sessionId}:`, error);
    }
  }

  // ============================================
  // DATABASE PERSISTENCE
  // ============================================

  /**
   * Load context from database
   */
  private async loadFromDatabase(sessionId: string): Promise<ConversationContext | null> {
    try {
      const session = await this.prisma.agentSession.findUnique({
        where: { id: sessionId },
        include: {
          conversationTurns: {
            orderBy: { turnNumber: 'asc' },
          },
        },
      });

      if (!session) {
        return null;
      }

      const context: ConversationContext = {
        sessionId: session.id,
        agentType: session.sessionType,
        systemPrompt: (session.metadata as any)?.systemPrompt || '',
        turns: session.conversationTurns.map((turn) => ({
          id: turn.id,
          role: turn.role.toLowerCase() as LlmMessageRole,
          content: turn.content,
          timestamp: turn.createdAt,
        })),
        metadata: session.metadata as Record<string, unknown>,
      };

      return context;
    } catch (error) {
      this.logger.error(`Failed to load context from database for ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Persist a turn to database
   */
  private async persistTurn(sessionId: string, turn: ConversationMemoryTurn): Promise<void> {
    try {
      // Get current turn count
      const turnCount = await this.prisma.conversationTurn.count({
        where: { agentSessionId: sessionId },
      });

      await this.prisma.conversationTurn.create({
        data: {
          id: turn.id,
          agentSessionId: sessionId,
          role: turn.role.toUpperCase(),
          content: turn.content,
          turnNumber: turnCount + 1,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to persist turn for ${sessionId}:`, error);
      // Don't throw - persistence failure shouldn't break the flow
    }
  }

  // ============================================
  // SUMMARIZATION
  // ============================================

  /**
   * Summarize conversation history
   * Called when conversation gets too long
   *
   * NOTE: Requires LLM call, should be injected to avoid circular dependency
   */
  async summarizeConversation(
    context: ConversationContext,
    summarizer: (messages: LlmMessage[], prompt: string) => Promise<string>,
  ): Promise<string> {
    const messages = this.formatForLlm(context);

    const summaryPrompt = `Summarize the key points of this conversation concisely:
- Main topics discussed
- Decisions made
- Actions taken or pending
- Important context to remember

Keep the summary under 500 words.`;

    try {
      const summary = await summarizer(messages, summaryPrompt);
      return summary;
    } catch (error) {
      this.logger.error('Failed to summarize conversation:', error);
      return '';
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Get conversation statistics
   */
  async getStats(sessionId: string): Promise<{
    turnCount: number;
    estimatedTokens: number;
    oldestTurn?: Date;
    newestTurn?: Date;
  }> {
    const context = await this.getContext(sessionId);

    if (!context || context.turns.length === 0) {
      return { turnCount: 0, estimatedTokens: 0 };
    }

    let totalTokens = this.estimateTokens(context.systemPrompt);
    for (const turn of context.turns) {
      totalTokens += this.estimateTokens(turn.content);
    }

    return {
      turnCount: context.turns.length,
      estimatedTokens: totalTokens,
      oldestTurn: context.turns[0]?.timestamp,
      newestTurn: context.turns[context.turns.length - 1]?.timestamp,
    };
  }

  /**
   * Export conversation for audit/review
   */
  async exportConversation(sessionId: string): Promise<{
    session: ConversationContext | null;
    formatted: string;
  }> {
    const context = await this.getContext(sessionId);

    if (!context) {
      return { session: null, formatted: '' };
    }

    const lines: string[] = [
      `Session: ${sessionId}`,
      `Agent: ${context.agentType}`,
      `---`,
    ];

    for (const turn of context.turns) {
      const timestamp = turn.timestamp.toISOString();
      lines.push(`[${timestamp}] ${turn.role.toUpperCase()}: ${turn.content}`);
    }

    return {
      session: context,
      formatted: lines.join('\n'),
    };
  }
}
