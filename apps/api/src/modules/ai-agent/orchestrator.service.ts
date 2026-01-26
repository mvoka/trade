import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PolicyService } from '../feature-flags/policy.service';
import { SkillRegistryService, SkillExecutionContext } from './skill-registry.service';
import { ToolsService, ToolContext, ToolResult } from './tools.service';
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
  status: AgentSessionStatus;
  userId?: string;
  orgId?: string;
  context: Record<string, unknown>;
  conversationHistory: ConversationTurn[];
  toolCallLog: ToolCallLogEntry[];
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
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
// ORCHESTRATOR SERVICE
// ============================================

/**
 * OrchestratorService - Central coordination for AI agent sessions
 *
 * Responsibilities:
 * - Manage agent session lifecycle
 * - Process incoming messages
 * - Coordinate tool execution
 * - Handle human takeover
 * - Maintain conversation state
 *
 * P1 Feature: Session management, message processing stubs
 * P2 Feature: Full LLM integration, state machine, analytics
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  // In-memory session store (P1)
  // P2: Move to Redis for horizontal scaling
  private sessions = new Map<string, OrchestratorSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly policyService: PolicyService,
    private readonly skillRegistry: SkillRegistryService,
    private readonly toolsService: ToolsService,
  ) {
    this.logger.log('OrchestratorService initialized');
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  /**
   * Start a new agent session
   *
   * @param userId - Optional user ID for authenticated sessions
   * @param sessionType - Type of session (PHONE, BOOKING, etc.)
   * @param context - Optional initial context
   * @returns Created session
   *
   * P1: In-memory session creation
   * P2: Persist to database, initialize LLM context
   */
  async startSession(
    userId: string | undefined,
    sessionType: AgentSessionType,
    context?: Record<string, unknown>,
  ): Promise<OrchestratorSession> {
    const sessionId = `session_${randomUUID()}`;

    this.logger.log(`Starting session ${sessionId} of type ${sessionType}`);

    // Check if phone agent is enabled for phone sessions
    if (sessionType === AgentSessionType.PHONE) {
      const phoneAgentEnabled = await this.featureFlagsService.isEnabled(
        'PHONE_AGENT_ENABLED',
        { orgId: context?.orgId as string },
      );

      if (!phoneAgentEnabled) {
        throw new BadRequestException('Phone agent feature is not enabled');
      }

      // Get phone agent mode
      const phoneAgentMode = await this.policyService.getValue(
        'PHONE_AGENT_MODE',
        { orgId: context?.orgId as string },
      );
      this.logger.debug(`Phone agent mode: ${phoneAgentMode}`);
    }

    const session: OrchestratorSession = {
      id: sessionId,
      sessionType,
      status: AgentSessionStatus.ACTIVE,
      userId,
      orgId: context?.orgId as string | undefined,
      context: context ?? {},
      conversationHistory: [],
      toolCallLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in memory (P1)
    this.sessions.set(sessionId, session);

    // P2: Persist to database
    // await this.prisma.agentSession.create({
    //   data: {
    //     id: sessionId,
    //     sessionType,
    //     status: AgentSessionStatus.ACTIVE,
    //     userId,
    //     orgId: context?.orgId,
    //     context: context ?? {},
    //   },
    // });

    // Add system message to conversation
    const systemTurn: ConversationTurn = {
      id: `turn_${randomUUID()}`,
      role: MessageRole.SYSTEM,
      content: `Session started. Type: ${sessionType}. Ready to assist.`,
      timestamp: new Date(),
      metadata: { sessionStart: true },
    };
    session.conversationHistory.push(systemTurn);

    this.logger.log(`Session ${sessionId} created successfully`);

    return session;
  }

  /**
   * End an agent session
   *
   * @param sessionId - Session to end
   * @returns Updated session
   *
   * P1: In-memory session update
   * P2: Persist to database, cleanup resources
   */
  async endSession(sessionId: string): Promise<OrchestratorSession> {
    const session = this.getSessionOrThrow(sessionId);

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

    // P2: Persist to database
    // await this.prisma.agentSession.update({
    //   where: { id: sessionId },
    //   data: {
    //     status: AgentSessionStatus.COMPLETED,
    //     endedAt: new Date(),
    //   },
    // });

    this.logger.log(`Session ${sessionId} ended`);

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): OrchestratorSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get session or throw NotFoundException
   */
  private getSessionOrThrow(sessionId: string): OrchestratorSession {
    const session = this.sessions.get(sessionId);
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
   * @param sessionId - Session ID
   * @param message - Message content
   * @param metadata - Optional message metadata
   * @returns Processing result with agent response
   *
   * P1: Stub implementation with echo response
   * P2: Full LLM integration with tool calling
   */
  async processMessage(
    sessionId: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<ProcessMessageResult> {
    const session = this.getSessionOrThrow(sessionId);

    if (session.status !== AgentSessionStatus.ACTIVE) {
      throw new BadRequestException(`Session ${sessionId} is not active`);
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

    // P1 Stub: Echo response with mock agent behavior
    // P2: Send to LLM, process tool calls, generate response

    const toolCalls: ToolCallLogEntry[] = [];

    // Simulate tool call detection (P1 stub)
    let agentContent = '';
    let suggestedActions: string[] = [];

    if (message.toLowerCase().includes('book')) {
      agentContent = 'I can help you book an appointment. Let me check available time slots for you.';
      suggestedActions = ['View available slots', 'Specify preferred time', 'Choose a different date'];

      // Simulate a tool call
      const toolCallEntry = await this.logToolCall(
        sessionId,
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
      toolCallIds: toolCalls.map(tc => tc.id),
    };
    session.conversationHistory.push(agentTurn);
    session.updatedAt = new Date();

    return {
      sessionId,
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
   * Execute a tool call within the session
   *
   * @param sessionId - Session ID
   * @param toolName - Tool to execute
   * @param params - Tool parameters
   * @returns Tool execution result
   *
   * P1: Route to ToolsService stubs
   * P2: Full tool execution with validation
   */
  async executeToolCall(
    sessionId: string,
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<ExecuteToolResult> {
    const session = this.getSessionOrThrow(sessionId);

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

    const session = this.sessions.get(sessionId);
    if (session) {
      session.toolCallLog.push(entry);
    }

    // Simulate completion for stub
    entry.status = ToolCallStatus.SUCCESS;
    entry.completedAt = new Date();
    entry.durationMs = 50; // Stub timing
    entry.output = { stub: true, message: 'Tool call simulated' };

    return entry;
  }

  // ============================================
  // HUMAN TAKEOVER
  // ============================================

  /**
   * Handle transfer to human agent
   *
   * @param sessionId - Session to transfer
   * @param reason - Reason for takeover
   * @param priority - Priority in queue
   * @returns Takeover result
   *
   * P1: Stub implementation
   * P2: Integration with human queue system
   */
  async handleHumanTakeover(
    sessionId: string,
    reason?: string,
    priority?: string,
  ): Promise<HumanTakeoverResult> {
    const session = this.getSessionOrThrow(sessionId);

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

    // P2: Queue the session for human agent
    // await this.humanQueueService.enqueue(sessionId, priority);

    // Stub: Calculate mock queue position
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

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Get user permissions (stub)
   *
   * P1: Return default permissions
   * P2: Query from RBAC service
   */
  private async getUserPermissions(userId?: string): Promise<string[]> {
    if (!userId) {
      // Anonymous user - limited permissions
      return ['booking:read', 'calendar:read'];
    }

    // P1 Stub: Return full permissions for authenticated users
    // P2: Query actual permissions from user/role
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

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId: string): ConversationTurn[] {
    const session = this.getSessionOrThrow(sessionId);
    return session.conversationHistory;
  }

  /**
   * Get tool call log for a session
   */
  getToolCallLog(sessionId: string): ToolCallLogEntry[] {
    const session = this.getSessionOrThrow(sessionId);
    return session.toolCallLog;
  }
}
