import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from './notification.service';
import { MessageSender, NOTIFICATION_TYPES, PaginationParams } from '@trades/shared';

/**
 * Message record interface
 */
export interface MessageRecord {
  id: string;
  threadId: string;
  senderId: string | null;
  senderType: MessageSender;
  content: string;
  attachmentUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Message thread interface
 */
export interface MessageThread {
  id: string;
  jobId: string;
  messages: MessageRecord[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Paginated messages response
 */
export interface PaginatedMessages {
  data: MessageRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * CommunicationsService - Messaging and thread management
 *
 * Handles job-related messaging between SMB users, pros, and operators.
 * Uses anonymous messaging with masked identities until booking is confirmed.
 *
 * @example
 * // Get or create thread for a job
 * const thread = await communicationsService.getThread(jobId);
 *
 * // Send a message
 * await communicationsService.sendMessage(thread.id, userId, 'SMB', 'Hello!');
 */
@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Get or create a message thread for a job
   *
   * @param jobId - Job ID to get/create thread for
   * @returns Message thread with messages
   *
   * @example
   * const thread = await communicationsService.getThread('job-123');
   * console.log('Thread ID:', thread.id);
   * console.log('Messages:', thread.messages.length);
   */
  async getThread(jobId: string): Promise<MessageThread> {
    this.logger.log(`Getting thread for job: ${jobId}`);

    // Verify job exists
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job not found: ${jobId}`);
    }

    // Get or create thread
    let thread = await this.prisma.messageThread.findUnique({
      where: { jobId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) {
      this.logger.log(`Creating new thread for job: ${jobId}`);
      thread = await this.prisma.messageThread.create({
        data: { jobId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    return {
      id: thread.id,
      jobId: thread.jobId,
      messages: thread.messages.map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
        senderId: msg.senderId,
        senderType: msg.senderType as MessageSender,
        content: msg.content,
        attachmentUrl: msg.attachmentUrl,
        readAt: msg.readAt,
        createdAt: msg.createdAt,
      })),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  /**
   * Get thread by ID
   *
   * @param threadId - Thread ID
   * @returns Message thread
   */
  async getThreadById(threadId: string): Promise<MessageThread> {
    const thread = await this.prisma.messageThread.findUnique({
      where: { id: threadId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    return {
      id: thread.id,
      jobId: thread.jobId,
      messages: thread.messages.map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
        senderId: msg.senderId,
        senderType: msg.senderType as MessageSender,
        content: msg.content,
        attachmentUrl: msg.attachmentUrl,
        readAt: msg.readAt,
        createdAt: msg.createdAt,
      })),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  /**
   * Send a message in a thread
   *
   * @param threadId - Thread ID to send message in
   * @param senderId - User ID of sender (null for system messages)
   * @param senderType - Type of sender (SMB, PRO, OPERATOR, SYSTEM)
   * @param content - Message content
   * @param attachmentUrl - Optional attachment URL
   * @returns Created message
   *
   * @example
   * const message = await communicationsService.sendMessage(
   *   'thread-123',
   *   'user-456',
   *   'SMB',
   *   'When can you arrive?'
   * );
   */
  async sendMessage(
    threadId: string,
    senderId: string | null,
    senderType: MessageSender,
    content: string,
    attachmentUrl?: string,
  ): Promise<MessageRecord> {
    this.logger.log(`Sending message in thread: ${threadId}`);

    // Verify thread exists and get job info
    const thread = await this.prisma.messageThread.findUnique({
      where: { id: threadId },
      include: {
        job: {
          include: {
            createdBy: true,
            dispatchAssignment: {
              include: {
                proProfile: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    // If sender is provided, verify they have access to this thread
    if (senderId) {
      const hasAccess = await this.verifyThreadAccess(thread.job, senderId, senderType);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this thread');
      }
    }

    // Create the message
    const message = await this.prisma.message.create({
      data: {
        threadId,
        senderId,
        senderType: senderType as any,
        content,
        attachmentUrl: attachmentUrl || null,
      },
    });

    // Update thread timestamp
    await this.prisma.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    // Notify the other party
    await this.notifyNewMessage(thread.job, senderId, senderType);

    this.logger.log(`Message sent: ${message.id}`);

    return {
      id: message.id,
      threadId: message.threadId,
      senderId: message.senderId,
      senderType: message.senderType as MessageSender,
      content: message.content,
      attachmentUrl: message.attachmentUrl,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }

  /**
   * Get messages in a thread with pagination
   *
   * @param threadId - Thread ID
   * @param pagination - Pagination options
   * @returns Paginated messages
   *
   * @example
   * const messages = await communicationsService.getMessages('thread-123', {
   *   page: 1,
   *   pageSize: 20,
   * });
   */
  async getMessages(
    threadId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedMessages> {
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    // Verify thread exists
    const thread = await this.prisma.messageThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    // Get total count
    const total = await this.prisma.message.count({
      where: { threadId },
    });

    // Get messages
    const messages = await this.prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    });

    return {
      data: messages.map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
        senderId: msg.senderId,
        senderType: msg.senderType as MessageSender,
        content: msg.content,
        attachmentUrl: msg.attachmentUrl,
        readAt: msg.readAt,
        createdAt: msg.createdAt,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Mark messages as read for a user
   *
   * @param threadId - Thread ID
   * @param userId - User ID marking messages as read
   * @returns Number of messages marked as read
   *
   * @example
   * const count = await communicationsService.markAsRead('thread-123', 'user-456');
   * console.log(`Marked ${count} messages as read`);
   */
  async markAsRead(threadId: string, userId: string): Promise<{ count: number }> {
    this.logger.log(`Marking messages as read: thread=${threadId}, user=${userId}`);

    // Get user's role to determine which messages to mark
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    // Determine sender types to mark as read (all except the user's type)
    const senderTypesToMark: string[] = [];
    if (user.role === 'SMB_USER') {
      senderTypesToMark.push('PRO', 'OPERATOR', 'SYSTEM');
    } else if (user.role === 'PRO_USER') {
      senderTypesToMark.push('SMB', 'OPERATOR', 'SYSTEM');
    } else {
      // Operators/admins read all messages
      senderTypesToMark.push('SMB', 'PRO', 'SYSTEM');
    }

    // Mark messages as read
    const result = await this.prisma.message.updateMany({
      where: {
        threadId,
        senderType: { in: senderTypesToMark as any[] },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    this.logger.log(`Marked ${result.count} messages as read`);

    return { count: result.count };
  }

  /**
   * Get unread message count for a user in a thread
   *
   * @param threadId - Thread ID
   * @param userId - User ID
   * @returns Unread message count
   */
  async getUnreadCount(threadId: string, userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return 0;
    }

    // Determine sender types to count (messages from others)
    const senderTypesToCount: string[] = [];
    if (user.role === 'SMB_USER') {
      senderTypesToCount.push('PRO', 'OPERATOR', 'SYSTEM');
    } else if (user.role === 'PRO_USER') {
      senderTypesToCount.push('SMB', 'OPERATOR', 'SYSTEM');
    } else {
      senderTypesToCount.push('SMB', 'PRO', 'SYSTEM');
    }

    return this.prisma.message.count({
      where: {
        threadId,
        senderType: { in: senderTypesToCount as any[] },
        readAt: null,
      },
    });
  }

  /**
   * Send a system message to a thread
   *
   * @param threadId - Thread ID
   * @param content - Message content
   * @returns Created message
   */
  async sendSystemMessage(
    threadId: string,
    content: string,
  ): Promise<MessageRecord> {
    return this.sendMessage(threadId, null, 'SYSTEM', content);
  }

  /**
   * Verify user has access to a thread based on their relationship to the job
   */
  private async verifyThreadAccess(
    job: any,
    userId: string,
    senderType: MessageSender,
  ): Promise<boolean> {
    // System messages are always allowed
    if (senderType === 'SYSTEM') {
      return true;
    }

    // SMB users can access if they created the job
    if (senderType === 'SMB' && job.createdById === userId) {
      return true;
    }

    // Pros can access if they're assigned to the job
    if (senderType === 'PRO' && job.dispatchAssignment?.proProfile?.userId === userId) {
      return true;
    }

    // Check if user is an operator/admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user && (user.role === 'OPERATOR' || user.role === 'ADMIN')) {
      return true;
    }

    return false;
  }

  /**
   * Notify the other party about a new message
   */
  private async notifyNewMessage(
    job: any,
    senderId: string | null,
    senderType: MessageSender,
  ): Promise<void> {
    try {
      // Determine who to notify
      let recipientUserId: string | null = null;

      if (senderType === 'SMB' || senderType === 'SYSTEM') {
        // Notify the assigned pro
        recipientUserId = job.dispatchAssignment?.proProfile?.userId || null;
      } else if (senderType === 'PRO') {
        // Notify the job creator (SMB)
        recipientUserId = job.createdById;
      }

      if (recipientUserId) {
        await this.notificationService.send(
          recipientUserId,
          NOTIFICATION_TYPES.NEW_MESSAGE,
          {
            jobId: job.id,
            jobNumber: job.jobNumber,
            senderType,
          },
          ['IN_APP', 'PUSH'],
        );
      }
    } catch (error) {
      // Don't fail message sending if notification fails
      this.logger.error('Failed to send new message notification:', error);
    }
  }
}
