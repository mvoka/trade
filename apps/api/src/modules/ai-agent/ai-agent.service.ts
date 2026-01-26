import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrchestratorService, OrchestratorSession, ConversationTurn, ToolCallLogEntry } from './orchestrator.service';
import {
  CreateAgentSessionDto,
  SendMessageDto,
  SessionHistoryQueryDto,
  AgentSessionResponseDto,
  AgentMessageResponseDto,
  SessionHistoryResponseDto,
  ConversationMessageDto,
  ToolCallResponseDto,
  HumanTakeoverResponseDto,
  HumanTakeoverDto,
  AgentSessionStatus,
  MessageRole,
  ToolCallStatus,
} from './dto/ai-agent.dto';

// ============================================
// AI AGENT SERVICE
// ============================================

/**
 * AiAgentService - High-level API for AI agent functionality
 *
 * Provides the public interface for:
 * - Creating and managing agent sessions
 * - Sending messages to the agent
 * - Retrieving conversation history
 * - Handling session lifecycle
 *
 * P1 Feature: Complete high-level API stubs
 * P2 Feature: Full persistence, analytics, monitoring
 */
@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: OrchestratorService,
  ) {
    this.logger.log('AiAgentService initialized');
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  /**
   * Create a new agent session
   *
   * @param dto - Session creation parameters
   * @returns Created session response
   *
   * P1: Delegates to OrchestratorService
   * P2: Add validation, rate limiting, persistence
   */
  async createAgentSession(dto: CreateAgentSessionDto): Promise<AgentSessionResponseDto> {
    this.logger.log(`Creating agent session. Type: ${dto.sessionType}, User: ${dto.userId ?? 'anonymous'}`);

    const session = await this.orchestrator.startSession(
      dto.userId,
      dto.sessionType,
      {
        orgId: dto.orgId,
        ...dto.context,
      },
    );

    return this.mapSessionToResponse(session);
  }

  /**
   * Send a message to an agent session
   *
   * @param sessionId - Target session ID
   * @param dto - Message content
   * @returns Agent response
   *
   * P1: Delegates to OrchestratorService.processMessage
   * P2: Add streaming support, retry logic
   */
  async sendMessage(sessionId: string, dto: SendMessageDto): Promise<AgentMessageResponseDto> {
    this.logger.debug(`Sending message to session ${sessionId}`);

    const result = await this.orchestrator.processMessage(
      sessionId,
      dto.content,
      dto.metadata,
    );

    return {
      sessionId: result.sessionId,
      message: {
        id: `msg_${Date.now()}`,
        role: result.response.role,
        content: result.response.content,
        timestamp: new Date(),
        metadata: result.response.metadata,
      },
      toolCalls: result.toolCalls.map(tc => this.mapToolCallToResponse(tc)),
      suggestedActions: result.suggestedActions,
      sessionActive: result.sessionActive,
    };
  }

  /**
   * Get conversation history for a session
   *
   * @param sessionId - Session ID
   * @param query - Pagination parameters
   * @returns Paginated conversation history
   *
   * P1: In-memory history retrieval
   * P2: Database pagination, filtering
   */
  async getSessionHistory(
    sessionId: string,
    query: SessionHistoryQueryDto,
  ): Promise<SessionHistoryResponseDto> {
    this.logger.debug(`Getting history for session ${sessionId}`);

    const session = this.orchestrator.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const conversationHistory = this.orchestrator.getConversationHistory(sessionId);
    const toolCallLog = query.includeToolCalls
      ? this.orchestrator.getToolCallLog(sessionId)
      : [];

    // Pagination
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const total = conversationHistory.length;
    const totalPages = Math.ceil(total / pageSize);

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedMessages = conversationHistory.slice(startIndex, endIndex);

    // Map messages with tool calls
    const messages: ConversationMessageDto[] = paginatedMessages.map(turn => {
      const toolCalls = turn.toolCallIds
        ? toolCallLog
            .filter(tc => turn.toolCallIds?.includes(tc.id))
            .map(tc => this.mapToolCallToResponse(tc))
        : undefined;

      return {
        id: turn.id,
        role: turn.role,
        content: turn.content,
        timestamp: turn.timestamp,
        metadata: turn.metadata,
        toolCalls,
      };
    });

    return {
      session: this.mapSessionToResponse(session),
      messages,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  /**
   * End an agent session
   *
   * @param sessionId - Session to end
   * @returns Updated session response
   *
   * P1: Delegates to OrchestratorService.endSession
   * P2: Cleanup resources, send notifications
   */
  async endAgentSession(sessionId: string): Promise<AgentSessionResponseDto> {
    this.logger.log(`Ending session ${sessionId}`);

    const session = await this.orchestrator.endSession(sessionId);

    return this.mapSessionToResponse(session);
  }

  /**
   * Request human takeover for a session
   *
   * @param sessionId - Session ID
   * @param dto - Takeover parameters
   * @returns Takeover result
   *
   * P1: Delegates to OrchestratorService.handleHumanTakeover
   * P2: Queue integration, agent notification
   */
  async requestHumanTakeover(
    sessionId: string,
    dto: HumanTakeoverDto,
  ): Promise<HumanTakeoverResponseDto> {
    this.logger.log(`Human takeover requested for session ${sessionId}`);

    const result = await this.orchestrator.handleHumanTakeover(
      sessionId,
      dto.reason,
      dto.priority,
    );

    return result;
  }

  // ============================================
  // SESSION QUERIES
  // ============================================

  /**
   * Get session by ID
   *
   * @param sessionId - Session ID
   * @returns Session response or throws NotFoundException
   */
  async getSession(sessionId: string): Promise<AgentSessionResponseDto> {
    const session = this.orchestrator.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return this.mapSessionToResponse(session);
  }

  /**
   * Check if session exists and is active
   */
  isSessionActive(sessionId: string): boolean {
    const session = this.orchestrator.getSession(sessionId);
    return session?.status === AgentSessionStatus.ACTIVE;
  }

  // ============================================
  // MAPPERS
  // ============================================

  /**
   * Map internal session to response DTO
   */
  private mapSessionToResponse(session: OrchestratorSession): AgentSessionResponseDto {
    return {
      id: session.id,
      sessionType: session.sessionType,
      status: session.status,
      userId: session.userId,
      orgId: session.orgId,
      createdAt: session.createdAt,
      endedAt: session.endedAt,
      context: session.context,
    };
  }

  /**
   * Map internal tool call to response DTO
   */
  private mapToolCallToResponse(toolCall: ToolCallLogEntry): ToolCallResponseDto {
    return {
      id: toolCall.id,
      toolName: toolCall.toolName,
      status: toolCall.status,
      input: this.sanitizeToolInput(toolCall.input),
      output: toolCall.output ? this.sanitizeToolOutput(toolCall.output) : undefined,
      error: toolCall.error,
      executedAt: toolCall.startedAt,
      durationMs: toolCall.durationMs,
    };
  }

  /**
   * Sanitize tool input for response (remove sensitive data)
   *
   * P1: Basic sanitization
   * P2: Full PII masking, audit-safe output
   */
  private sanitizeToolInput(input: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
    const sanitized = { ...input };

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Sanitize tool output for response
   */
  private sanitizeToolOutput(output: Record<string, unknown>): Record<string, unknown> {
    // Same sanitization as input
    return this.sanitizeToolInput(output);
  }
}
