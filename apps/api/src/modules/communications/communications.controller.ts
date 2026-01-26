import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CommunicationsService } from './communications.service';
import { ConsentService } from './consent.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import {
  SendMessageDto,
  UpdateConsentDto,
  MessageResponseDto,
  MessageThreadResponseDto,
  PaginatedMessagesResponseDto,
  ConsentStatusResponseDto,
  ConsentResponseDto,
  PaginationQueryDto,
} from './dto/communications.dto';
import { ConsentType, MessageSender } from '@trades/shared';

@ApiTags('Communications')
@Controller('communications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommunicationsController {
  constructor(
    private readonly communicationsService: CommunicationsService,
    private readonly consentService: ConsentService,
  ) {}

  // ============================================
  // MESSAGING ENDPOINTS
  // ============================================

  /**
   * Get message thread for a job
   */
  @Get('messages/:jobId')
  @ApiOperation({
    summary: 'Get message thread for a job',
    description: 'Retrieves or creates a message thread for the specified job. Returns all messages in the thread.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID to get messages for',
    example: 'clxx1234567890',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message thread retrieved successfully',
    type: MessageThreadResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getMessageThread(
    @Param('jobId') jobId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<MessageThreadResponseDto> {
    const thread = await this.communicationsService.getThread(jobId);

    // Mark messages as read for this user
    await this.communicationsService.markAsRead(thread.id, user.userId);

    return thread;
  }

  /**
   * Get paginated messages in a thread
   */
  @Get('messages/:jobId/paginated')
  @ApiOperation({
    summary: 'Get paginated messages for a job',
    description: 'Retrieves messages with pagination support. Useful for large threads.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID to get messages for',
    example: 'clxx1234567890',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based)',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Number of messages per page',
    example: 20,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Messages retrieved successfully',
    type: PaginatedMessagesResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job or thread not found',
  })
  async getPaginatedMessages(
    @Param('jobId') jobId: string,
    @Query() pagination: PaginationQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PaginatedMessagesResponseDto> {
    const thread = await this.communicationsService.getThread(jobId);

    // Mark messages as read for this user
    await this.communicationsService.markAsRead(thread.id, user.userId);

    return this.communicationsService.getMessages(thread.id, {
      page: pagination.page ? Number(pagination.page) : 1,
      pageSize: pagination.pageSize ? Number(pagination.pageSize) : 20,
    });
  }

  /**
   * Send a message in a job thread
   */
  @Post('messages/:jobId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a message in a job thread',
    description: 'Sends a new message in the job\'s message thread. Creates the thread if it doesn\'t exist.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID to send message for',
    example: 'clxx1234567890',
  })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Message sent successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not authorized to message in this thread',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid message content',
  })
  async sendMessage(
    @Param('jobId') jobId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<MessageResponseDto> {
    // Get or create thread
    const thread = await this.communicationsService.getThread(jobId);

    // Determine sender type based on user role
    let senderType: MessageSender;
    switch (user.role) {
      case 'PRO_USER':
        senderType = 'PRO';
        break;
      case 'OPERATOR':
      case 'ADMIN':
        senderType = 'OPERATOR';
        break;
      default:
        senderType = 'SMB';
    }

    return this.communicationsService.sendMessage(
      thread.id,
      user.userId,
      senderType,
      dto.content,
      dto.attachmentUrl,
    );
  }

  /**
   * Mark messages as read
   */
  @Post('messages/:jobId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark messages as read',
    description: 'Marks all unread messages in the thread as read for the current user.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID',
    example: 'clxx1234567890',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Messages marked as read',
    schema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Number of messages marked as read',
          example: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job or thread not found',
  })
  async markMessagesAsRead(
    @Param('jobId') jobId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ count: number }> {
    const thread = await this.communicationsService.getThread(jobId);
    return this.communicationsService.markAsRead(thread.id, user.userId);
  }

  // ============================================
  // CONSENT ENDPOINTS
  // ============================================

  /**
   * Get current consent status
   */
  @Get('consent')
  @ApiOperation({
    summary: 'Get consent status',
    description: 'Retrieves the current consent status for all consent types for the authenticated user.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Consent status retrieved successfully',
    type: ConsentStatusResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getConsentStatus(
    @CurrentUser() user: CurrentUserData,
  ): Promise<ConsentStatusResponseDto> {
    const consents = await this.consentService.getConsents(user.userId);

    return {
      userId: user.userId,
      consents: consents.map((consent) => ({
        id: consent.id,
        userId: consent.userId,
        type: consent.type,
        granted: consent.granted,
        grantedAt: consent.grantedAt,
        revokedAt: consent.revokedAt,
        createdAt: consent.createdAt,
        updatedAt: consent.updatedAt,
      })),
    };
  }

  /**
   * Update consent settings
   */
  @Post('consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update consent settings',
    description: 'Updates consent settings for the authenticated user. Can grant or revoke multiple consent types at once.',
  })
  @ApiBody({ type: UpdateConsentDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Consent settings updated successfully',
    type: ConsentStatusResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid consent data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async updateConsent(
    @Body() dto: UpdateConsentDto,
    @CurrentUser() user: CurrentUserData,
    @Req() request: Request,
  ): Promise<ConsentStatusResponseDto> {
    const metadata = {
      ipAddress: request.ip || request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
    };

    // Update each consent
    await this.consentService.bulkUpdateConsents(
      user.userId,
      dto.consents.map((c) => ({
        type: c.type as ConsentType,
        granted: c.granted,
      })),
      metadata,
    );

    // Return updated consent status
    const consents = await this.consentService.getConsents(user.userId);

    return {
      userId: user.userId,
      consents: consents.map((consent) => ({
        id: consent.id,
        userId: consent.userId,
        type: consent.type,
        granted: consent.granted,
        grantedAt: consent.grantedAt,
        revokedAt: consent.revokedAt,
        createdAt: consent.createdAt,
        updatedAt: consent.updatedAt,
      })),
    };
  }

  /**
   * Grant a specific consent
   */
  @Post('consent/:type/grant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Grant a specific consent',
    description: 'Grants consent for a specific communication type.',
  })
  @ApiParam({
    name: 'type',
    description: 'Consent type to grant',
    enum: ['TRANSACTIONAL_SMS', 'MARKETING_SMS', 'TRANSACTIONAL_EMAIL', 'MARKETING_EMAIL', 'CALL_RECORDING'],
    example: 'MARKETING_EMAIL',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Consent granted successfully',
    type: ConsentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid consent type',
  })
  async grantConsent(
    @Param('type') type: ConsentType,
    @CurrentUser() user: CurrentUserData,
    @Req() request: Request,
  ): Promise<ConsentResponseDto> {
    const metadata = {
      ipAddress: request.ip || request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
    };

    const consent = await this.consentService.grantConsent(user.userId, type, metadata);

    return {
      id: consent.id,
      userId: consent.userId,
      type: consent.type,
      granted: consent.granted,
      grantedAt: consent.grantedAt,
      revokedAt: consent.revokedAt,
      createdAt: consent.createdAt,
      updatedAt: consent.updatedAt,
    };
  }

  /**
   * Revoke a specific consent
   */
  @Post('consent/:type/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke a specific consent',
    description: 'Revokes consent for a specific communication type.',
  })
  @ApiParam({
    name: 'type',
    description: 'Consent type to revoke',
    enum: ['TRANSACTIONAL_SMS', 'MARKETING_SMS', 'TRANSACTIONAL_EMAIL', 'MARKETING_EMAIL', 'CALL_RECORDING'],
    example: 'MARKETING_SMS',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Consent revoked successfully',
    type: ConsentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid consent type',
  })
  async revokeConsent(
    @Param('type') type: ConsentType,
    @CurrentUser() user: CurrentUserData,
    @Req() request: Request,
  ): Promise<ConsentResponseDto> {
    const metadata = {
      ipAddress: request.ip || request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
    };

    const consent = await this.consentService.revokeConsent(user.userId, type, metadata);

    return {
      id: consent.id,
      userId: consent.userId,
      type: consent.type,
      granted: consent.granted,
      grantedAt: consent.grantedAt,
      revokedAt: consent.revokedAt,
      createdAt: consent.createdAt,
      updatedAt: consent.updatedAt,
    };
  }
}
