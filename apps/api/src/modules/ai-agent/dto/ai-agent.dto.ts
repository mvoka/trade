import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsObject,
  IsArray,
  ValidateNested,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ============================================
// ENUMS
// ============================================

/**
 * Types of AI agent sessions
 * P1: PHONE, BOOKING - primary flows
 * P2: SUPPORT, DISPATCH - future enhancements
 */
export enum AgentSessionType {
  PHONE = 'PHONE',
  BOOKING = 'BOOKING',
  SUPPORT = 'SUPPORT',
  DISPATCH = 'DISPATCH',
}

/**
 * Session status tracking
 */
export enum AgentSessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  HUMAN_TAKEOVER = 'HUMAN_TAKEOVER',
  ERROR = 'ERROR',
  EXPIRED = 'EXPIRED',
}

/**
 * Message role in conversation
 */
export enum MessageRole {
  USER = 'USER',
  AGENT = 'AGENT',
  SYSTEM = 'SYSTEM',
  TOOL = 'TOOL',
}

/**
 * Tool call status
 */
export enum ToolCallStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// ============================================
// REQUEST DTOs
// ============================================

/**
 * DTO for creating a new agent session
 */
export class CreateAgentSessionDto {
  @ApiPropertyOptional({
    description: 'User ID if authenticated',
    example: 'clx1234567890',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    description: 'Type of agent session',
    enum: AgentSessionType,
    example: AgentSessionType.PHONE,
  })
  @IsEnum(AgentSessionType)
  sessionType: AgentSessionType;

  @ApiPropertyOptional({
    description: 'Organization context for the session',
    example: 'clx_org_123',
  })
  @IsString()
  @IsOptional()
  orgId?: string;

  @ApiPropertyOptional({
    description: 'Initial context/metadata for the session',
    example: { source: 'inbound_call', phoneNumber: '+1234567890' },
  })
  @IsObject()
  @IsOptional()
  context?: Record<string, unknown>;
}

/**
 * DTO for sending a message to the agent
 */
export class SendMessageDto {
  @ApiProperty({
    description: 'Message content from user',
    example: 'I need to book a plumber for tomorrow morning',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: 'Additional message metadata',
    example: { confidence: 0.95, language: 'en' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for tool execution request
 */
export class ExecuteToolDto {
  @ApiProperty({
    description: 'Name of the tool to execute',
    example: 'BookingTool.createBooking',
  })
  @IsString()
  toolName: string;

  @ApiProperty({
    description: 'Parameters for tool execution',
    example: { jobId: 'clx_job_123', date: '2024-01-15', timeSlot: 'morning' },
  })
  @IsObject()
  params: Record<string, unknown>;
}

/**
 * DTO for human takeover request
 */
export class HumanTakeoverDto {
  @ApiPropertyOptional({
    description: 'Reason for human takeover',
    example: 'Customer requested to speak with a human',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Priority level for human queue',
    example: 'high',
  })
  @IsString()
  @IsOptional()
  priority?: string;
}

/**
 * DTO for querying session history
 */
export class SessionHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    minimum: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of messages per page',
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 50;

  @ApiPropertyOptional({
    description: 'Include tool calls in response',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeToolCalls?: boolean = true;
}

// ============================================
// RESPONSE DTOs
// ============================================

/**
 * Response DTO for agent session
 */
export class AgentSessionResponseDto {
  @ApiProperty({
    description: 'Unique session identifier',
    example: 'clx_session_123',
  })
  id: string;

  @ApiProperty({
    description: 'Session type',
    enum: AgentSessionType,
  })
  sessionType: AgentSessionType;

  @ApiProperty({
    description: 'Current session status',
    enum: AgentSessionStatus,
  })
  status: AgentSessionStatus;

  @ApiPropertyOptional({
    description: 'Associated user ID',
  })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Associated organization ID',
  })
  orgId?: string;

  @ApiProperty({
    description: 'Session creation timestamp',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Session end timestamp',
  })
  endedAt?: Date;

  @ApiPropertyOptional({
    description: 'Session context/metadata',
  })
  context?: Record<string, unknown>;
}

/**
 * Response DTO for a conversation message
 */
export class ConversationMessageDto {
  @ApiProperty({
    description: 'Message ID',
  })
  id: string;

  @ApiProperty({
    description: 'Message role',
    enum: MessageRole,
  })
  role: MessageRole;

  @ApiProperty({
    description: 'Message content',
  })
  content: string;

  @ApiProperty({
    description: 'Message timestamp',
  })
  timestamp: Date;

  @ApiPropertyOptional({
    description: 'Message metadata',
  })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Associated tool calls',
    type: 'array',
  })
  toolCalls?: ToolCallResponseDto[];
}

/**
 * Response DTO for tool call
 */
export class ToolCallResponseDto {
  @ApiProperty({
    description: 'Tool call ID',
  })
  id: string;

  @ApiProperty({
    description: 'Tool name',
  })
  toolName: string;

  @ApiProperty({
    description: 'Tool call status',
    enum: ToolCallStatus,
  })
  status: ToolCallStatus;

  @ApiPropertyOptional({
    description: 'Input parameters (sanitized)',
  })
  input?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Tool output (sanitized)',
  })
  output?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Error message if failed',
  })
  error?: string;

  @ApiProperty({
    description: 'Execution timestamp',
  })
  executedAt: Date;

  @ApiPropertyOptional({
    description: 'Execution duration in ms',
  })
  durationMs?: number;
}

/**
 * Response DTO for agent message
 */
export class AgentMessageResponseDto {
  @ApiProperty({
    description: 'Session ID',
  })
  sessionId: string;

  @ApiProperty({
    description: 'Agent response message',
  })
  message: ConversationMessageDto;

  @ApiPropertyOptional({
    description: 'Tool calls executed during response',
    type: [ToolCallResponseDto],
  })
  toolCalls?: ToolCallResponseDto[];

  @ApiPropertyOptional({
    description: 'Suggested next actions',
    type: [String],
  })
  suggestedActions?: string[];

  @ApiProperty({
    description: 'Whether the session is still active',
  })
  sessionActive: boolean;
}

/**
 * Response DTO for session history
 */
export class SessionHistoryResponseDto {
  @ApiProperty({
    description: 'Session information',
    type: AgentSessionResponseDto,
  })
  session: AgentSessionResponseDto;

  @ApiProperty({
    description: 'Conversation messages',
    type: [ConversationMessageDto],
  })
  messages: ConversationMessageDto[];

  @ApiProperty({
    description: 'Pagination metadata',
  })
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Response DTO for human takeover
 */
export class HumanTakeoverResponseDto {
  @ApiProperty({
    description: 'Session ID',
  })
  sessionId: string;

  @ApiProperty({
    description: 'Updated session status',
    enum: AgentSessionStatus,
  })
  status: AgentSessionStatus;

  @ApiProperty({
    description: 'Human queue position (stub)',
    example: 3,
  })
  queuePosition: number;

  @ApiPropertyOptional({
    description: 'Estimated wait time in seconds',
    example: 120,
  })
  estimatedWaitSeconds?: number;

  @ApiProperty({
    description: 'Takeover message',
  })
  message: string;
}

/**
 * Generic message response
 */
export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Success indicator',
  })
  success?: boolean;
}
