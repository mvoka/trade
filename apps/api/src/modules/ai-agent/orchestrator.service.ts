import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PolicyService } from '../feature-flags/policy.service';
import { SkillRegistryService, SkillExecutionContext } from './skill-registry.service';
import { ToolsService, ToolContext, ToolResult } from './tools.service';
import { LlmGatewayService } from './llm/llm-gateway.service';
import { ConversationMemoryService, ConversationMemoryTurn } from './llm/conversation-memory.service';
import { PromptTemplateService } from './llm/prompt-template.service';
import { AgentConfigRegistryService } from './agents/agent-config.registry';
import { AgentInstance } from './agents/agent-config.interface';
import {
  LlmMessage,
  LlmToolDefinition,
  LlmToolCall,
  ContentBlock,
} from './llm/llm-gateway.interface';
import {
  AgentSessionType,
  AgentSessionStatus,
  MessageRole,
  ToolCallStatus,
} from './dto/ai-agent.dto';
import { randomUUID } from 'crypto';

// ============================================
// ORCHESTRATOR INTERFACES
// ============================================

/**
 * Session state for the orchestrator
 */
export interface OrchestratorSession {
  id: string;
  sessionType: AgentSessionType;
  agentId?: string;
  status: AgentSessionStatus;
  userId?: string;
  orgId?: string;
  context: Record<string, unknown>;
  conversationHistory: ConversationTurn[];
  toolCallLog: ToolCallLogEntry[];
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
  /** Agent instance for LLM-powered sessions */
  agentInstance?: AgentInstance;
  /** Turn counter for max turns enforcement */
  turnCount: number;
}

/**
 * Conversation turn in the session
 */
export interface ConversationTurn {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  toolCallIds?: string[];
}

/**
 * Tool call log entry
 */
export interface ToolCallLogEntry {
  id: string;
  sessionId: string;
  toolName: string;
  status: ToolCallStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

/**
 * Message processing result
 */
export interface ProcessMessageResult {
  sessionId: string;
  response: {
    role: MessageRole;
    content: string;
    metadata?: Record<string, unknown>;
  };
  toolCalls: ToolCallLogEntry[];
  suggestedActions?: string[];
  sessionActive: boolean;
}

/**
 * Tool execution result from orchestrator
 */
export interface ExecuteToolResult {
  success: boolean;
  toolCallId: string;
  result: ToolResult;
  error?: string;
}

/**
 * Human takeover result
 */
export interface HumanTakeoverResult {
  sessionId: string;
  status: AgentSessionStatus;
  queuePosition: number;
  estimatedWaitSeconds?: number;
  message: string;
}

// ============================================
// REDIS KEYS
// ============================================

const REDIS_SESSION_PREFIX = 'orchestrator:session:';
const REDIS_SESSION_TTL = 3600; // 1 hour

// ============================================
// ORCHESTRATOR SERVICE
// ============================================

/**
 * OrchestratorService - Central coordination for AI agent sessions
 *
 * Responsibilities:
 * - Manage agent session lifecycle
 * - Process incoming messages via LLM
 * - Coordinate tool execution
 * - Handle human takeover
 * - Maintain conversation state
 *
 * Enhanced with:
 * - LLM integration via LlmGatewayService
 * - Redis session storage for horizontal scaling
 * - Agent configuration support
 * - Conversation memory management
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  // In-memory session store (fallback when Redis unavailable)
  private sessions = new Map<string, OrchestratorSession>();

  // Flag for LLM availability
  private llmAvailable = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly policyService: PolicyService,
    private readonly skillRegistry: SkillRegistryService,
    private readonly toolsService: ToolsService,
    private readonly llmGateway: LlmGatewayService,
    private readonly conversationMemory: ConversationMemoryService,
    private readonly promptTemplateService: PromptTemplateService,
    private readonly agentConfigRegistry: AgentConfigRegistryService,
  ) {
    this.initializeLlm();
    this.logger.log('OrchestratorService initialized');
  }

  /**
   * Check LLM availability on startup
   */
  private async initializeLlm(): Promise<void> {
    try {
      this.llmAvailable = await this.llmGateway.isHealthy();
      if (this.llmAvailable) {
        this.logger.log(`LLM available via ${this.llmGateway.getCurrentProvider()}`);
      } else {
        this.logger.warn('LLM not available - using fallback responses');
      }
    } catch (error) {
      this.logger.error('Failed to initialize LLM:', error);
      this.llmAvailable = false;
    }
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  /**
   * Start a new agent session
   *
   * @param userId - Optional user ID for authenticated sessions
   * @param sessionType - Type of session (PHONE, BOOKING, etc.)
   * @param context - Optional initial context including agentId
   * @returns Created session
   */
  async startSession(
    userId: string | undefined,
    sessionType: AgentSessionType,
    context?: Record<string, unknown>,
  ): Promise<OrchestratorSession> {
    const sessionId = `session_${randomUUID()}`;
    const agentId = context?.agentId as string | undefined;

    this.logger.log(`Starting session ${sessionId} of type ${sessionType}${agentId ? ` with agent ${agentId}` : ''}`);

    // Check if phone agent is enabled for phone sessions
    if (sessionType === AgentSessionType.PHONE) {
      const phoneAgentEnabled = await this.featureFlagsService.isEnabled(
        'PHONE_AGENT_ENABLED',
        { orgId: context?.orgId as string },
      );

      if (!phoneAgentEnabled) {
        throw new BadRequestException('Phone agent feature is not enabled');
      }

      const phoneAgentMode = await this.policyService.getValue(
        'PHONE_AGENT_MODE',
        { orgId: context?.orgId as string },
      );
      this.logger.debug(`Phone agent mode: ${phoneAgentMode}`);
    }

    // Create agent instance if agentId specified
    let agentInstance: AgentInstance | undefined;
    if (agentId) {
      try {
        agentInstance = await this.agentConfigRegistry.createInstance(
          agentId,
          sessionId,
          {
            ...context,
            userId,
          },
        );
      } catch (error) {
        this.logger.warn(`Failed to create agent instance: ${error}`);
        // Continue without agent instance - will use fallback
      }
    }

    const session: OrchestratorSession = {
      id: sessionId,
      sessionType,
      agentId,
      status: AgentSessionStatus.ACTIVE,
      userId,
      orgId: context?.orgId as string | undefined,
      context: context ?? {},
      conversationHistory: [],
      toolCallLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      agentInstance,
      turnCount: 0,
    };

    // Store in Redis (primary) and memory (fallback)
    await this.saveSession(session);

    // Initialize conversation memory if using LLM
    if (agentInstance) {
      await this.conversationMemory.initializeContext(
        sessionId,
        agentId!,
        agentInstance.systemPrompt,
        context,
      );
    }

    // Add system message to conversation
    const systemTurn: ConversationTurn = {
      id: `turn_${randomUUID()}`,
      role: MessageRole.SYSTEM,
      content: `Session started. Type: ${sessionType}${agentId ? `. Agent: ${agentId}` : ''}. Ready to assist.`,
      timestamp: new Date(),
      metadata: { sessionStart: true, agentId },
    };
    session.conversationHistory.push(systemTurn);

    // Persist to database
    await this.persistSessionToDb(session);

    this.logger.log(`Session ${sessionId} created successfully`);

    return session;
  }

  /**
   * End an agent session
   */
  async endSession(sessionId: string): Promise<OrchestratorSession> {
    const session = await this.getSessionOrThrow(sessionId);

    this.logger.log(`Ending session ${sessionId}`);

    session.status = AgentSessionStatus.COMPLETED;
    session.endedAt = new Date();
    session.updatedAt = new Date();

    // Add system message
    const endTurn: ConversationTurn = {
      id: `turn_${randomUUID()}`,
      role: MessageRole.SYSTEM,
      content: 'Session ended.',
      timestamp: new Date(),
      metadata: { sessionEnd: true },
    };
    session.conversationHistory.push(endTurn);

    // Save and cleanup
    await this.saveSession(session);
    await this.conversationMemory.clearContext(sessionId);

    // Update database
    await this.updateSessionInDb(session);

    this.logger.log(`Session ${sessionId} ended`);

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<OrchestratorSession | undefined> {
    // Try Redis first
    try {
      const cached = await this.redis.getJson<OrchestratorSession>(
        `${REDIS_SESSION_PREFIX}${sessionId}`,
      );
      if (cached) {
        // Rehydrate dates
        return this.rehydrateSession(cached);
      }
    } catch (error) {
      this.logger.debug(`Redis get failed for ${sessionId}, using memory`);
    }

    // Fall back to memory
    return this.sessions.get(sessionId);
  }

  /**
   * Get session or throw NotFoundException
   */
  private async getSessionOrThrow(sessionId: string): Promise<OrchestratorSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return session;
  }

  // ============================================
  // MESSAGE PROCESSING
  // ============================================

  /**
   * Process an incoming message in the session
   *
   * Uses LLM for intelligent responses when available,
   * falls back to stub responses otherwise.
   */
  async processMessage(
    sessionId: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<ProcessMessageResult> {
    const session = await this.getSessionOrThrow(sessionId);

    if (session.status !== AgentSessionStatus.ACTIVE) {
      throw new BadRequestException(`Session ${sessionId} is not active`);
    }

    // Check max turns
    if (session.agentInstance?.config.maxTurns &&
        session.turnCount >= session.agentInstance.config.maxTurns) {
      this.logger.warn(`Session ${sessionId} reached max turns, triggering handoff`);
      return this.triggerMaxTurnsHandoff(session, message);
    }

    this.logger.debug(`Processing message in session ${sessionId}: ${message.substring(0, 100)}...`);

    // Add user message to conversation
    const userTurn: ConversationTurn = {
      id: `turn_${randomUUID()}`,
      role: MessageRole.USER,
      content: message,
      timestamp: new Date(),
      metadata,
    };
    session.conversationHistory.push(userTurn);
    session.turnCount++;

    // Add to conversation memory
    await this.conversationMemory.addTurn(sessionId, {
      role: 'user',
      content: message,
      metadata,
    });

    // Check if LLM is available and agent is configured
    if (this.llmAvailable && session.agentInstance) {
      return this.processWithLlm(session, message);
    }

    // Fallback to stub response
    return this.processWithStub(session, message);
  }

  /**
   * Process message using LLM
   */
  private async processWithLlm(
    session: OrchestratorSession,
    message: string,
  ): Promise<ProcessMessageResult> {
    const agentInstance = session.agentInstance!;
    const toolCalls: ToolCallLogEntry[] = [];

    try {
      // Get conversation context
      const context = await this.conversationMemory.getContext(session.id);
      const messages = context ? this.conversationMemory.formatForLlm(context) : [];

      // Get available tools
      const tools = this.getToolDefinitionsForAgent(agentInstance);

      // Call LLM
      const response = await this.llmGateway.complete({
        messages,
        systemPrompt: agentInstance.systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
        maxTokens: agentInstance.config.llmConfig?.maxTokens,
        temperature: agentInstance.config.llmConfig?.temperature,
        metadata: {
          sessionId: session.id,
          userId: session.userId,
          agentType: session.agentId,
        },
      });

      // Handle tool calls if any
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await this.executeToolCalls(session, response.toolCalls);
        toolCalls.push(...toolResults);

        // Continue conversation with tool results
        return this.continueAfterTools(session, response, toolResults);
      }

      // Add agent response to conversation
      const agentContent = response.content;
      const agentTurn: ConversationTurn = {
        id: `turn_${randomUUID()}`,
        role: MessageRole.AGENT,
        content: agentContent,
        timestamp: new Date(),
      };
      session.conversationHistory.push(agentTurn);

      // Add to memory
      await this.conversationMemory.addTurn(session.id, {
        role: 'assistant',
        content: agentContent,
      });

      // Save session
      session.updatedAt = new Date();
      await this.saveSession(session);

      // Check for escalation triggers
      const suggestedActions = this.checkEscalationTriggers(session, message, agentContent);

      return {
        sessionId: session.id,
        response: {
          role: MessageRole.AGENT,
          content: agentContent,
        },
        toolCalls,
        suggestedActions,
        sessionActive: session.status === AgentSessionStatus.ACTIVE,
      };
    } catch (error) {
      this.logger.error(`LLM processing failed for session ${session.id}:`, error);
      // Fall back to stub on error
      return this.processWithStub(session, message);
    }
  }

  /**
   * Continue conversation after tool execution
   */
  private async continueAfterTools(
    session: OrchestratorSession,
    previousResponse: { content: string; toolCalls?: LlmToolCall[] },
    toolResults: ToolCallLogEntry[],
  ): Promise<ProcessMessageResult> {
    const agentInstance = session.agentInstance!;

    // Build messages with tool results
    const context = await this.conversationMemory.getContext(session.id);
    const messages: LlmMessage[] = context
      ? this.conversationMemory.formatForLlm(context)
      : [];

    // Add assistant message with tool use
    if (previousResponse.toolCalls) {
      const contentBlocks: ContentBlock[] = [];
      if (previousResponse.content) {
        contentBlocks.push({ type: 'text', text: previousResponse.content });
      }
      for (const tc of previousResponse.toolCalls) {
        contentBlocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      messages.push({
        role: 'assistant',
        content: contentBlocks,
      });
    }

    // Add tool results
    for (const result of toolResults) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: result.id,
            content: JSON.stringify(result.output ?? result.error),
            is_error: result.status === ToolCallStatus.FAILED,
          },
        ],
      });

      // Add to memory
      await this.conversationMemory.addTurn(session.id, {
        role: 'tool',
        content: JSON.stringify(result.output ?? result.error),
        metadata: {
          toolName: result.toolName,
          toolCallId: result.id,
          isError: result.status === ToolCallStatus.FAILED,
        },
      });
    }

    // Get tools again for continuation
    const tools = this.getToolDefinitionsForAgent(agentInstance);

    // Call LLM again with tool results
    const response = await this.llmGateway.complete({
      messages,
      systemPrompt: agentInstance.systemPrompt,
      tools: tools.length > 0 ? tools : undefined,
      maxTokens: agentInstance.config.llmConfig?.maxTokens,
      temperature: agentInstance.config.llmConfig?.temperature,
      metadata: {
        sessionId: session.id,
        userId: session.userId,
        agentType: session.agentId,
      },
    });

    // If more tool calls, recurse (with depth limit)
    if (response.toolCalls && response.toolCalls.length > 0 && session.turnCount < 10) {
      session.turnCount++;
      const newToolResults = await this.executeToolCalls(session, response.toolCalls);
      toolResults.push(...newToolResults);
      return this.continueAfterTools(session, response, newToolResults);
    }

    // Add final response
    const agentContent = response.content;
    const agentTurn: ConversationTurn = {
      id: `turn_${randomUUID()}`,
      role: MessageRole.AGENT,
      content: agentContent,
      timestamp: new Date(),
      toolCallIds: toolResults.map((t) => t.id),
    };
    session.conversationHistory.push(agentTurn);

    await this.conversationMemory.addTurn(session.id, {
      role: 'assistant',
      content: agentContent,
    });

    session.updatedAt = new Date();
    await this.saveSession(session);

    return {
      sessionId: session.id,
      response: {
        role: MessageRole.AGENT,
        content: agentContent,
      },
      toolCalls: toolResults,
      suggestedActions: [],
      sessionActive: session.status === AgentSessionStatus.ACTIVE,
    };
  }

  /**
   * Process message with stub (fallback)
   */
  private async processWithStub(
    session: OrchestratorSession,
    message: string,
  ): Promise<ProcessMessageResult> {
    const toolCalls: ToolCallLogEntry[] = [];

    // Simulate tool call detection
    let agentContent = '';
    let suggestedActions: string[] = [];

    if (message.toLowerCase().includes('book')) {
      agentContent = 'I can help you book an appointment. Let me check available time slots for you.';
      suggestedActions = ['View available slots', 'Specify preferred time', 'Choose a different date'];

      const toolCallEntry = await this.logToolCall(
        session.id,
        'BookingTool.getSlots',
        { query: message },
      );
      toolCalls.push(toolCallEntry);
    } else if (message.toLowerCase().includes('dispatch')) {
      agentContent = 'I can initiate a dispatch to find available pros in your area.';
      suggestedActions = ['Start dispatch', 'Check existing dispatches', 'Specify requirements'];
    } else if (message.toLowerCase().includes('human') || message.toLowerCase().includes('agent')) {
      agentContent = 'I understand you would like to speak with a human agent. I can transfer you now.';
      suggestedActions = ['Transfer to human', 'Continue with AI'];
    } else {
      agentContent = `I received your message: "${message.substring(0, 50)}...". ` +
        'This is a stub response. In the full implementation, I would process this with an LLM and potentially execute tools.';
      suggestedActions = ['Book an appointment', 'Request dispatch', 'Talk to human agent'];
    }

    // Add agent response to conversation
    const agentTurn: ConversationTurn = {
      id: `turn_${randomUUID()}`,
      role: MessageRole.AGENT,
      content: agentContent,
      timestamp: new Date(),
      toolCallIds: toolCalls.map((tc) => tc.id),
    };
    session.conversationHistory.push(agentTurn);
    session.updatedAt = new Date();

    await this.saveSession(session);

    return {
      sessionId: session.id,
      response: {
        role: MessageRole.AGENT,
        content: agentContent,
      },
      toolCalls,
      suggestedActions,
      sessionActive: session.status === AgentSessionStatus.ACTIVE,
    };
  }

  // ============================================
  // TOOL EXECUTION
  // ============================================

  /**
   * Execute tool calls from LLM
   */
  private async executeToolCalls(
    session: OrchestratorSession,
    toolCalls: LlmToolCall[],
  ): Promise<ToolCallLogEntry[]> {
    const results: ToolCallLogEntry[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeToolCall(
        session.id,
        toolCall.name,
        toolCall.arguments,
      );
      results.push({
        id: toolCall.id,
        sessionId: session.id,
        toolName: toolCall.name,
        status: result.success ? ToolCallStatus.SUCCESS : ToolCallStatus.FAILED,
        input: toolCall.arguments,
        output: result.result.data as Record<string, unknown> | undefined,
        error: result.error,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0,
      });
    }

    return results;
  }

  /**
   * Execute a single tool call
   */
  async executeToolCall(
    sessionId: string,
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<ExecuteToolResult> {
    const session = await this.getSessionOrThrow(sessionId);

    if (session.status !== AgentSessionStatus.ACTIVE) {
      throw new BadRequestException(`Session ${sessionId} is not active`);
    }

    this.logger.debug(`Executing tool ${toolName} in session ${sessionId}`);

    const toolCallId = `toolcall_${randomUUID()}`;
    const startTime = Date.now();

    // Create tool context
    const toolContext: ToolContext = {
      sessionId,
      userId: session.userId,
      orgId: session.orgId,
      permissions: await this.getUserPermissions(session.userId),
      metadata: session.context,
    };

    let result: ToolResult;

    try {
      // Route to appropriate tool
      switch (toolName) {
        case 'BookingTool.createBooking':
          result = await this.toolsService.createBooking(params as any, toolContext);
          break;
        case 'BookingTool.getSlots':
          result = await this.toolsService.getSlots(params as any, toolContext);
          break;
        case 'DispatchTool.initiateDispatch':
          result = await this.toolsService.initiateDispatch(params as any, toolContext);
          break;
        case 'DispatchTool.checkStatus':
          result = await this.toolsService.checkDispatchStatus(params.dispatchId as string, toolContext);
          break;
        case 'SmsTool.sendSms':
          result = await this.toolsService.sendSms(params as any, toolContext);
          break;
        case 'EmailTool.sendEmail':
          result = await this.toolsService.sendEmail(params as any, toolContext);
          break;
        case 'CallTool.initiateCall':
          result = await this.toolsService.initiateCall(params as any, toolContext);
          break;
        case 'CalendarTool.checkAvailability':
          result = await this.toolsService.checkAvailability(params as any, toolContext);
          break;
        default:
          result = {
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
      }

      // Log tool call
      const logEntry: ToolCallLogEntry = {
        id: toolCallId,
        sessionId,
        toolName,
        status: result.success ? ToolCallStatus.SUCCESS : ToolCallStatus.FAILED,
        input: params,
        output: result.data as Record<string, unknown>,
        error: result.error,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      };
      session.toolCallLog.push(logEntry);

      // Add tool response to conversation
      const toolTurn: ConversationTurn = {
        id: `turn_${randomUUID()}`,
        role: MessageRole.TOOL,
        content: JSON.stringify(result.data ?? result.error),
        timestamp: new Date(),
        metadata: { toolName, toolCallId },
      };
      session.conversationHistory.push(toolTurn);

      await this.saveSession(session);

      return {
        success: result.success,
        toolCallId,
        result,
      };
    } catch (error) {
      this.logger.error(`Tool execution failed: ${toolName}`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed tool call
      const logEntry: ToolCallLogEntry = {
        id: toolCallId,
        sessionId,
        toolName,
        status: ToolCallStatus.FAILED,
        input: params,
        error: errorMessage,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      };
      session.toolCallLog.push(logEntry);

      await this.saveSession(session);

      return {
        success: false,
        toolCallId,
        result: { success: false, error: errorMessage },
        error: errorMessage,
      };
    }
  }

  /**
   * Log a tool call (helper for internal tracking)
   */
  private async logToolCall(
    sessionId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolCallLogEntry> {
    const entry: ToolCallLogEntry = {
      id: `toolcall_${randomUUID()}`,
      sessionId,
      toolName,
      status: ToolCallStatus.PENDING,
      input,
      startedAt: new Date(),
    };

    const session = await this.getSession(sessionId);
    if (session) {
      session.toolCallLog.push(entry);
    }

    // Simulate completion for stub
    entry.status = ToolCallStatus.SUCCESS;
    entry.completedAt = new Date();
    entry.durationMs = 50;
    entry.output = { stub: true, message: 'Tool call simulated' };

    return entry;
  }

  // ============================================
  // HUMAN TAKEOVER
  // ============================================

  /**
   * Handle transfer to human agent
   */
  async handleHumanTakeover(
    sessionId: string,
    reason?: string,
    priority?: string,
  ): Promise<HumanTakeoverResult> {
    const session = await this.getSessionOrThrow(sessionId);

    this.logger.log(`Human takeover requested for session ${sessionId}. Reason: ${reason}`);

    // Update session status
    session.status = AgentSessionStatus.HUMAN_TAKEOVER;
    session.updatedAt = new Date();

    // Add system message
    const takeoverTurn: ConversationTurn = {
      id: `turn_${randomUUID()}`,
      role: MessageRole.SYSTEM,
      content: `Human takeover initiated. Reason: ${reason ?? 'Not specified'}`,
      timestamp: new Date(),
      metadata: { humanTakeover: true, reason, priority },
    };
    session.conversationHistory.push(takeoverTurn);

    await this.saveSession(session);
    await this.updateSessionInDb(session);

    // Calculate mock queue position
    const queuePosition = Math.floor(Math.random() * 5) + 1;
    const estimatedWaitSeconds = queuePosition * 60;

    return {
      sessionId,
      status: AgentSessionStatus.HUMAN_TAKEOVER,
      queuePosition,
      estimatedWaitSeconds,
      message: `You are being transferred to a human agent. Your position in queue: ${queuePosition}. Estimated wait time: ${Math.round(estimatedWaitSeconds / 60)} minutes.`,
    };
  }

  /**
   * Trigger handoff when max turns reached
   */
  private async triggerMaxTurnsHandoff(
    session: OrchestratorSession,
    lastMessage: string,
  ): Promise<ProcessMessageResult> {
    const handoffMessage = 'I apologize, but this conversation has become quite long. Let me connect you with a human agent who can better assist you.';

    await this.handleHumanTakeover(session.id, 'Max turns reached', 'normal');

    return {
      sessionId: session.id,
      response: {
        role: MessageRole.AGENT,
        content: handoffMessage,
      },
      toolCalls: [],
      suggestedActions: ['Wait for human agent'],
      sessionActive: false,
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Get tool definitions for an agent
   */
  private getToolDefinitionsForAgent(agentInstance: AgentInstance): LlmToolDefinition[] {
    const toolDefs = this.toolsService.getToolDefinitions();
    const tools: LlmToolDefinition[] = [];

    for (const toolName of agentInstance.availableTools) {
      const def = toolDefs[toolName];
      if (def) {
        tools.push({
          name: toolName,
          description: def.description,
          input_schema: this.getToolSchema(toolName),
        });
      }
    }

    return tools;
  }

  /**
   * Get JSON schema for a tool
   */
  private getToolSchema(toolName: string): any {
    // Tool schemas - simplified for now
    const schemas: Record<string, any> = {
      'BookingTool.createBooking': {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Job ID to book' },
          proProfileId: { type: 'string', description: 'Contractor profile ID' },
          startTime: { type: 'string', description: 'Start time (ISO format)' },
          endTime: { type: 'string', description: 'End time (ISO format)' },
          notes: { type: 'string', description: 'Booking notes' },
        },
        required: ['jobId', 'proProfileId'],
      },
      'BookingTool.getSlots': {
        type: 'object',
        properties: {
          proProfileId: { type: 'string', description: 'Contractor profile ID' },
          startDate: { type: 'string', description: 'Start date (ISO format)' },
          endDate: { type: 'string', description: 'End date (ISO format)' },
          durationMinutes: { type: 'number', description: 'Required duration' },
        },
        required: ['proProfileId', 'startDate', 'endDate'],
      },
      'DispatchTool.initiateDispatch': {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Job ID to dispatch' },
          urgency: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'] },
          radiusKm: { type: 'number', description: 'Search radius in km' },
        },
        required: ['jobId'],
      },
      'DispatchTool.checkStatus': {
        type: 'object',
        properties: {
          dispatchId: { type: 'string', description: 'Dispatch ID to check' },
        },
        required: ['dispatchId'],
      },
      'SmsTool.sendSms': {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Phone number' },
          message: { type: 'string', description: 'Message content' },
        },
        required: ['to', 'message'],
      },
      'EmailTool.sendEmail': {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Email address' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body' },
        },
        required: ['to', 'subject', 'body'],
      },
      'CallTool.initiateCall': {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Phone number' },
          recordingEnabled: { type: 'boolean', description: 'Enable recording' },
        },
        required: ['to'],
      },
      'CalendarTool.checkAvailability': {
        type: 'object',
        properties: {
          proProfileId: { type: 'string', description: 'Contractor profile ID' },
          startDate: { type: 'string', description: 'Start date (ISO format)' },
          endDate: { type: 'string', description: 'End date (ISO format)' },
        },
        required: ['proProfileId', 'startDate', 'endDate'],
      },
    };

    return schemas[toolName] || { type: 'object', properties: {} };
  }

  /**
   * Check for escalation triggers in conversation
   */
  private checkEscalationTriggers(
    session: OrchestratorSession,
    userMessage: string,
    agentResponse: string,
  ): string[] {
    const suggestions: string[] = [];

    if (session.agentInstance?.config.escalation?.triggerKeywords) {
      const lowerMessage = userMessage.toLowerCase();
      for (const keyword of session.agentInstance.config.escalation.triggerKeywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          suggestions.push('Transfer to human agent');
          break;
        }
      }
    }

    return suggestions;
  }

  /**
   * Get user permissions
   */
  private async getUserPermissions(userId?: string): Promise<string[]> {
    if (!userId) {
      return ['booking:read', 'calendar:read'];
    }

    return [
      'booking:read',
      'booking:create',
      'dispatch:read',
      'dispatch:create',
      'calendar:read',
      'sms:send',
      'email:send',
      'call:initiate',
    ];
  }

  // ============================================
  // SESSION PERSISTENCE
  // ============================================

  /**
   * Save session to Redis and memory
   */
  private async saveSession(session: OrchestratorSession): Promise<void> {
    // Save to memory as fallback
    this.sessions.set(session.id, session);

    // Try to save to Redis
    try {
      await this.redis.setJson(
        `${REDIS_SESSION_PREFIX}${session.id}`,
        session,
        REDIS_SESSION_TTL,
      );
    } catch (error) {
      this.logger.debug(`Failed to save session to Redis: ${session.id}`);
    }
  }

  /**
   * Rehydrate session dates after JSON parsing
   */
  private rehydrateSession(session: OrchestratorSession): OrchestratorSession {
    return {
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      endedAt: session.endedAt ? new Date(session.endedAt) : undefined,
      conversationHistory: session.conversationHistory.map((turn) => ({
        ...turn,
        timestamp: new Date(turn.timestamp),
      })),
      toolCallLog: session.toolCallLog.map((log) => ({
        ...log,
        startedAt: new Date(log.startedAt),
        completedAt: log.completedAt ? new Date(log.completedAt) : undefined,
      })),
    };
  }

  /**
   * Persist session to database
   */
  private async persistSessionToDb(session: OrchestratorSession): Promise<void> {
    try {
      await this.prisma.agentSession.create({
        data: {
          id: session.id,
          sessionType: session.sessionType,
          userId: session.userId,
          metadata: {
            agentId: session.agentId,
            systemPrompt: session.agentInstance?.systemPrompt,
            ...session.context,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to persist session to database: ${session.id}`, error);
    }
  }

  /**
   * Update session in database
   */
  private async updateSessionInDb(session: OrchestratorSession): Promise<void> {
    try {
      await this.prisma.agentSession.update({
        where: { id: session.id },
        data: {
          endedAt: session.endedAt,
          metadata: {
            agentId: session.agentId,
            status: session.status,
            turnCount: session.turnCount,
            ...session.context,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update session in database: ${session.id}`, error);
    }
  }

  // ============================================
  // PUBLIC ACCESSORS
  // ============================================

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: string): Promise<ConversationTurn[]> {
    const session = await this.getSessionOrThrow(sessionId);
    return session.conversationHistory;
  }

  /**
   * Get tool call log for a session
   */
  async getToolCallLog(sessionId: string): Promise<ToolCallLogEntry[]> {
    const session = await this.getSessionOrThrow(sessionId);
    return session.toolCallLog;
  }

  /**
   * Check if LLM is available
   */
  isLlmAvailable(): boolean {
    return this.llmAvailable;
  }
}
