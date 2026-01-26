import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiAgentService } from './ai-agent.service';
import {
  CreateAgentSessionDto,
  SendMessageDto,
  SessionHistoryQueryDto,
  HumanTakeoverDto,
  AgentSessionResponseDto,
  AgentMessageResponseDto,
  SessionHistoryResponseDto,
  HumanTakeoverResponseDto,
  MessageResponseDto,
} from './dto/ai-agent.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

// ============================================
// AI AGENT CONTROLLER
// ============================================

/**
 * AiAgentController - REST API endpoints for AI agent functionality
 *
 * Endpoints:
 * - POST /agent/sessions - Create new session
 * - POST /agent/sessions/:id/messages - Send message
 * - GET /agent/sessions/:id/history - Get history
 * - POST /agent/sessions/:id/end - End session
 * - POST /agent/sessions/:id/takeover - Human takeover
 *
 * P1 Feature: All endpoints implemented as stubs
 * P2 Feature: WebSocket support, streaming responses
 */
@ApiTags('AI Agent')
@Controller('agent')
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  /**
   * Create a new AI agent session
   *
   * Supports both authenticated and anonymous sessions.
   * Session type determines the agent behavior and available tools.
   */
  @Post('sessions')
  @Public() // Allow anonymous sessions
  @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 sessions per minute
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new agent session',
    description: `
Create a new AI agent session. Sessions can be created by authenticated users
or anonymously. The session type determines agent behavior:
- PHONE: Phone agent for voice interactions
- BOOKING: Booking assistant
- SUPPORT: Customer support (P2)
- DISPATCH: Dispatch coordination (P2)

P1 Feature: Basic session creation with stub behavior
P2 Feature: Full LLM integration, persistent state
    `,
  })
  @ApiBody({ type: CreateAgentSessionDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Session created successfully',
    type: AgentSessionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid session parameters or feature disabled',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  async createSession(
    @Body() dto: CreateAgentSessionDto,
    @CurrentUser() user?: CurrentUserData,
  ): Promise<AgentSessionResponseDto> {
    // Use authenticated user ID if available
    if (user && !dto.userId) {
      dto.userId = user.userId;
    }

    return this.aiAgentService.createAgentSession(dto);
  }

  /**
   * Get session details
   */
  @Get('sessions/:id')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get session details',
    description: 'Retrieve details about an agent session.',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session details',
    type: AgentSessionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  async getSession(@Param('id') sessionId: string): Promise<AgentSessionResponseDto> {
    return this.aiAgentService.getSession(sessionId);
  }

  // ============================================
  // MESSAGING
  // ============================================

  /**
   * Send a message to the agent
   *
   * Processes the message and returns the agent's response,
   * including any tool calls that were executed.
   */
  @Post('sessions/:id/messages')
  @Public()
  @Throttle({ short: { limit: 30, ttl: 60000 } }) // 30 messages per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send message to agent',
    description: `
Send a message to an active agent session. The agent will process the message
and respond accordingly, potentially executing tools as needed.

P1 Feature: Stub responses with simulated tool calls
P2 Feature: Full LLM processing, streaming support
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session_abc123',
  })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Agent response with any tool calls',
    type: AgentMessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Session not active or invalid message',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  async sendMessage(
    @Param('id') sessionId: string,
    @Body() dto: SendMessageDto,
  ): Promise<AgentMessageResponseDto> {
    return this.aiAgentService.sendMessage(sessionId, dto);
  }

  // ============================================
  // HISTORY
  // ============================================

  /**
   * Get conversation history for a session
   *
   * Returns paginated conversation turns including user messages,
   * agent responses, and tool calls.
   */
  @Get('sessions/:id/history')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get session conversation history',
    description: `
Retrieve the conversation history for an agent session. Includes all messages,
tool calls, and system events. Supports pagination for long conversations.

P1 Feature: In-memory history
P2 Feature: Database persistence, filtering, search
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session_abc123',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Items per page (max 100)',
    example: 50,
  })
  @ApiQuery({
    name: 'includeToolCalls',
    required: false,
    description: 'Include tool call details',
    example: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated conversation history',
    type: SessionHistoryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  async getHistory(
    @Param('id') sessionId: string,
    @Query() query: SessionHistoryQueryDto,
  ): Promise<SessionHistoryResponseDto> {
    return this.aiAgentService.getSessionHistory(sessionId, query);
  }

  // ============================================
  // SESSION LIFECYCLE
  // ============================================

  /**
   * End an agent session
   *
   * Gracefully terminates the session and cleans up resources.
   */
  @Post('sessions/:id/end')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'End agent session',
    description: `
End an active agent session. This will:
- Mark the session as completed
- Clean up any pending operations
- Archive the conversation history

P1 Feature: Basic session termination
P2 Feature: Resource cleanup, analytics, follow-up scheduling
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session ended successfully',
    type: AgentSessionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  async endSession(@Param('id') sessionId: string): Promise<AgentSessionResponseDto> {
    return this.aiAgentService.endAgentSession(sessionId);
  }

  /**
   * Request human takeover
   *
   * Transfers the session to a human agent queue.
   */
  @Post('sessions/:id/takeover')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request human takeover',
    description: `
Transfer an active agent session to a human agent. The session will be
queued for human handling, and the caller will receive queue position
and estimated wait time.

P1 Feature: Stub implementation with mock queue
P2 Feature: Full queue integration, agent routing, priority handling
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session_abc123',
  })
  @ApiBody({ type: HumanTakeoverDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transfer initiated',
    type: HumanTakeoverResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Session not active or already transferred',
  })
  async requestTakeover(
    @Param('id') sessionId: string,
    @Body() dto: HumanTakeoverDto,
  ): Promise<HumanTakeoverResponseDto> {
    return this.aiAgentService.requestHumanTakeover(sessionId, dto);
  }

  // ============================================
  // HEALTH / STATUS (P2)
  // ============================================

  /**
   * Get agent service status
   *
   * P2 Feature: Health check endpoint for monitoring
   */
  @Get('health')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Agent service health check',
    description: 'Check the health status of the AI agent service.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is healthy',
    type: MessageResponseDto,
  })
  async healthCheck(): Promise<MessageResponseDto> {
    return {
      message: 'AI Agent service is operational',
      success: true,
    };
  }
}
