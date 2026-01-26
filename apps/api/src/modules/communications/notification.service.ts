import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SmsService } from './sms.service';
import { EmailService, EMAIL_TEMPLATES } from './email.service';
import { ConsentService } from './consent.service';
import {
  ConsentType,
  NotificationChannel,
  NOTIFICATION_TYPES,
} from '@trades/shared';

/**
 * Notification data payload
 */
export interface NotificationData {
  [key: string]: unknown;
}

/**
 * Notification log record
 */
export interface NotificationLogRecord {
  id: string;
  userId: string;
  channel: NotificationChannel;
  type: string;
  subject: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  failReason: string | null;
  createdAt: Date;
}

/**
 * Notification send result
 */
export interface NotificationResult {
  success: boolean;
  channelResults: {
    channel: NotificationChannel;
    success: boolean;
    messageId?: string;
    error?: string;
  }[];
  logIds: string[];
}

/**
 * Channel to consent type mapping
 */
const CHANNEL_CONSENT_MAP: Record<NotificationChannel, ConsentType> = {
  SMS: 'TRANSACTIONAL_SMS' as ConsentType,
  EMAIL: 'TRANSACTIONAL_EMAIL' as ConsentType,
  PUSH: 'TRANSACTIONAL_SMS' as ConsentType, // Use SMS consent for push
  IN_APP: 'TRANSACTIONAL_SMS' as ConsentType, // In-app doesn't require explicit consent
};

/**
 * Marketing notification types that require marketing consent
 */
const MARKETING_NOTIFICATION_TYPES = [
  'MARKETING_CAMPAIGN',
  'PROMOTIONAL_OFFER',
  'NEWSLETTER',
];

/**
 * NotificationService - Multi-channel notification orchestration
 *
 * Sends notifications via SMS, Email, Push, and In-App channels.
 * Handles consent verification, template rendering, and logging.
 *
 * @example
 * // Send dispatch notification to pro
 * await notificationService.sendDispatchNotification(proId, jobId);
 *
 * // Send booking confirmation
 * await notificationService.sendBookingConfirmation(userId, bookingId);
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly consentService: ConsentService,
  ) {}

  /**
   * Send a notification to a user via multiple channels
   *
   * @param userId - User ID to notify
   * @param type - Notification type
   * @param data - Notification data/payload
   * @param channels - Channels to send through (defaults to all consented channels)
   * @returns Notification result with channel outcomes
   *
   * @example
   * const result = await notificationService.send(
   *   'user-123',
   *   NOTIFICATION_TYPES.DISPATCH_NEW,
   *   { jobId: 'job-456', jobTitle: 'Plumbing Repair' },
   *   ['SMS', 'EMAIL']
   * );
   */
  async send(
    userId: string,
    type: string,
    data: NotificationData,
    channels?: NotificationChannel[],
  ): Promise<NotificationResult> {
    this.logger.log(`Sending ${type} notification to user: ${userId}`);

    // Get user information
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    // Determine which channels to use
    const requestedChannels = channels || ['SMS', 'EMAIL', 'IN_APP'] as NotificationChannel[];
    const consentedChannels = await this.getConsentedChannels(userId, type, requestedChannels);

    if (consentedChannels.length === 0) {
      this.logger.warn(`No consented channels for user ${userId} and type ${type}`);
      return {
        success: false,
        channelResults: [],
        logIds: [],
      };
    }

    // Send via each consented channel
    const channelResults: NotificationResult['channelResults'] = [];
    const logIds: string[] = [];

    for (const channel of consentedChannels) {
      try {
        const result = await this.sendViaChannel(user, channel, type, data);
        channelResults.push(result);

        // Log the notification
        const log = await this.logNotification({
          userId,
          channel,
          type,
          subject: this.getSubjectForType(type, data),
          content: this.getContentForType(type, data),
          metadata: data as Record<string, unknown>,
          sentAt: result.success ? new Date() : null,
          failedAt: result.success ? null : new Date(),
          failReason: result.error || null,
        });
        logIds.push(log.id);
      } catch (error) {
        this.logger.error(`Failed to send ${type} via ${channel}:`, error);
        channelResults.push({
          channel,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const success = channelResults.some((r) => r.success);
    this.logger.log(`Notification ${type} sent: ${success ? 'SUCCESS' : 'FAILED'}`);

    return {
      success,
      channelResults,
      logIds,
    };
  }

  /**
   * Send dispatch notification to a pro
   *
   * @param proId - Pro profile ID
   * @param jobId - Job ID
   * @returns Notification result
   */
  async sendDispatchNotification(
    proId: string,
    jobId: string,
  ): Promise<NotificationResult> {
    this.logger.log(`Sending dispatch notification: pro=${proId}, job=${jobId}`);

    // Get pro profile with user info
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proId },
      include: {
        user: true,
      },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile not found: ${proId}`);
    }

    // Get job details
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        serviceCategory: true,
      },
    });

    if (!job) {
      throw new NotFoundException(`Job not found: ${jobId}`);
    }

    return this.send(
      proProfile.userId,
      NOTIFICATION_TYPES.DISPATCH_NEW,
      {
        jobId: job.id,
        jobNumber: job.jobNumber,
        jobTitle: job.title || `${job.serviceCategory.name} Service`,
        serviceCategory: job.serviceCategory.name,
        city: job.serviceCity,
        urgency: job.urgency,
        proName: proProfile.user.firstName || 'Pro',
      },
      ['SMS', 'EMAIL', 'PUSH'],
    );
  }

  /**
   * Send booking confirmation to a user
   *
   * @param userId - User ID
   * @param bookingId - Booking ID
   * @returns Notification result
   */
  async sendBookingConfirmation(
    userId: string,
    bookingId: string,
  ): Promise<NotificationResult> {
    this.logger.log(`Sending booking confirmation: user=${userId}, booking=${bookingId}`);

    // Get booking with related data
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        job: {
          include: {
            serviceCategory: true,
          },
        },
        proProfile: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking not found: ${bookingId}`);
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    const scheduledTime = booking.slotStart || booking.windowStart;

    return this.send(
      userId,
      NOTIFICATION_TYPES.BOOKING_CONFIRMATION,
      {
        bookingId: booking.id,
        jobId: booking.jobId,
        jobTitle: booking.job.title || `${booking.job.serviceCategory.name} Service`,
        proName: booking.proProfile.businessName ||
          `${booking.proProfile.user.firstName} ${booking.proProfile.user.lastName}`,
        scheduledDate: scheduledTime?.toISOString().split('T')[0],
        scheduledTime: scheduledTime?.toISOString().split('T')[1]?.substring(0, 5),
        address: `${booking.job.serviceAddressLine1}, ${booking.job.serviceCity}`,
        userName: user.firstName || 'Customer',
      },
      ['SMS', 'EMAIL'],
    );
  }

  /**
   * Send a reminder notification
   *
   * @param userId - User ID
   * @param type - Reminder type (BOOKING_REMINDER, etc.)
   * @param data - Reminder data
   * @returns Notification result
   */
  async sendReminder(
    userId: string,
    type: string,
    data: NotificationData,
  ): Promise<NotificationResult> {
    this.logger.log(`Sending reminder: user=${userId}, type=${type}`);

    return this.send(userId, type, data, ['SMS', 'EMAIL', 'PUSH']);
  }

  /**
   * Log a notification to the database
   *
   * @param notification - Notification details to log
   * @returns Created notification log record
   */
  async logNotification(notification: {
    userId: string;
    channel: NotificationChannel;
    type: string;
    subject?: string | null;
    content: string;
    metadata?: Record<string, unknown> | null;
    sentAt?: Date | null;
    deliveredAt?: Date | null;
    failedAt?: Date | null;
    failReason?: string | null;
  }): Promise<NotificationLogRecord> {
    const log = await this.prisma.notificationLog.create({
      data: {
        userId: notification.userId,
        channel: notification.channel as any,
        type: notification.type,
        subject: notification.subject || null,
        content: notification.content,
        metadata: notification.metadata as any || undefined,
        sentAt: notification.sentAt || null,
        deliveredAt: notification.deliveredAt || null,
        failedAt: notification.failedAt || null,
        failReason: notification.failReason || null,
      },
    });

    return {
      ...log,
      channel: log.channel as NotificationChannel,
      metadata: log.metadata as Record<string, unknown> | null,
    };
  }

  /**
   * Mark notification as delivered
   *
   * @param logId - Notification log ID
   * @returns Updated log record
   */
  async markDelivered(logId: string): Promise<NotificationLogRecord> {
    const log = await this.prisma.notificationLog.update({
      where: { id: logId },
      data: { deliveredAt: new Date() },
    });

    return {
      ...log,
      channel: log.channel as NotificationChannel,
      metadata: log.metadata as Record<string, unknown> | null,
    };
  }

  /**
   * Mark notification as failed
   *
   * @param logId - Notification log ID
   * @param reason - Failure reason
   * @returns Updated log record
   */
  async markFailed(logId: string, reason: string): Promise<NotificationLogRecord> {
    const log = await this.prisma.notificationLog.update({
      where: { id: logId },
      data: {
        failedAt: new Date(),
        failReason: reason,
      },
    });

    return {
      ...log,
      channel: log.channel as NotificationChannel,
      metadata: log.metadata as Record<string, unknown> | null,
    };
  }

  /**
   * Get notification history for a user
   *
   * @param userId - User ID
   * @param options - Query options
   * @returns Notification logs
   */
  async getNotificationHistory(
    userId: string,
    options?: {
      channel?: NotificationChannel;
      type?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<NotificationLogRecord[]> {
    const logs = await this.prisma.notificationLog.findMany({
      where: {
        userId,
        ...(options?.channel && { channel: options.channel as any }),
        ...(options?.type && { type: options.type }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    return logs.map((log) => ({
      ...log,
      channel: log.channel as NotificationChannel,
      metadata: log.metadata as Record<string, unknown> | null,
    }));
  }

  /**
   * Get channels that user has consented to for given notification type
   */
  private async getConsentedChannels(
    userId: string,
    type: string,
    requestedChannels: NotificationChannel[],
  ): Promise<NotificationChannel[]> {
    const consentedChannels: NotificationChannel[] = [];

    for (const channel of requestedChannels) {
      // In-app notifications don't require consent
      if (channel === 'IN_APP') {
        consentedChannels.push(channel);
        continue;
      }

      // Determine required consent type
      let consentType = CHANNEL_CONSENT_MAP[channel];

      // Check if this is a marketing notification
      if (MARKETING_NOTIFICATION_TYPES.includes(type)) {
        if (channel === 'SMS') {
          consentType = 'MARKETING_SMS' as ConsentType;
        } else if (channel === 'EMAIL') {
          consentType = 'MARKETING_EMAIL' as ConsentType;
        }
      }

      // Check consent
      const hasConsent = await this.consentService.hasConsent(userId, consentType);
      if (hasConsent) {
        consentedChannels.push(channel);
      } else {
        this.logger.debug(`User ${userId} missing consent for ${channel} (${consentType})`);
      }
    }

    return consentedChannels;
  }

  /**
   * Send notification via a specific channel
   */
  private async sendViaChannel(
    user: { id: string; email: string; phone: string | null; firstName: string | null },
    channel: NotificationChannel,
    type: string,
    data: NotificationData,
  ): Promise<{
    channel: NotificationChannel;
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    switch (channel) {
      case 'SMS':
        if (!user.phone) {
          return {
            channel,
            success: false,
            error: 'User has no phone number',
          };
        }
        const smsResult = await this.smsService.sendSms(
          user.phone,
          this.getContentForType(type, data),
        );
        return {
          channel,
          success: smsResult.success,
          messageId: smsResult.messageSid,
          error: smsResult.errorMessage,
        };

      case 'EMAIL':
        const templateId = this.getEmailTemplateForType(type);
        const emailResult = templateId
          ? await this.emailService.sendTemplatedEmail(user.email, templateId, {
              ...data,
              userName: user.firstName || 'User',
            })
          : await this.emailService.sendEmail(
              user.email,
              this.getSubjectForType(type, data) || 'Notification',
              this.getContentForType(type, data),
            );
        return {
          channel,
          success: emailResult.success,
          messageId: emailResult.messageId,
          error: emailResult.error,
        };

      case 'PUSH':
        // Push notifications would be implemented with FCM/APNS
        this.logger.log(`[STUB] Push notification for user ${user.id}: ${type}`);
        return {
          channel,
          success: true,
          messageId: `push-${Date.now()}`,
        };

      case 'IN_APP':
        // In-app notifications would be stored for client retrieval
        this.logger.log(`[STUB] In-app notification for user ${user.id}: ${type}`);
        return {
          channel,
          success: true,
          messageId: `inapp-${Date.now()}`,
        };

      default:
        return {
          channel,
          success: false,
          error: `Unknown channel: ${channel}`,
        };
    }
  }

  /**
   * Get email template ID for notification type
   */
  private getEmailTemplateForType(type: string): string | null {
    const templateMap: Record<string, string> = {
      [NOTIFICATION_TYPES.DISPATCH_NEW]: EMAIL_TEMPLATES.DISPATCH_NEW,
      [NOTIFICATION_TYPES.DISPATCH_ACCEPTED]: EMAIL_TEMPLATES.DISPATCH_ACCEPTED,
      [NOTIFICATION_TYPES.DISPATCH_DECLINED]: EMAIL_TEMPLATES.DISPATCH_DECLINED,
      [NOTIFICATION_TYPES.BOOKING_CONFIRMATION]: EMAIL_TEMPLATES.BOOKING_CONFIRMATION,
      [NOTIFICATION_TYPES.BOOKING_REMINDER]: EMAIL_TEMPLATES.BOOKING_REMINDER,
      [NOTIFICATION_TYPES.BOOKING_CANCELLED]: EMAIL_TEMPLATES.BOOKING_CANCELLED,
      [NOTIFICATION_TYPES.JOB_SCHEDULED]: EMAIL_TEMPLATES.JOB_SCHEDULED,
      [NOTIFICATION_TYPES.JOB_STARTED]: EMAIL_TEMPLATES.JOB_STARTED,
      [NOTIFICATION_TYPES.JOB_COMPLETED]: EMAIL_TEMPLATES.JOB_COMPLETED,
      [NOTIFICATION_TYPES.VERIFICATION_SUBMITTED]: EMAIL_TEMPLATES.VERIFICATION_SUBMITTED,
      [NOTIFICATION_TYPES.VERIFICATION_APPROVED]: EMAIL_TEMPLATES.VERIFICATION_APPROVED,
      [NOTIFICATION_TYPES.VERIFICATION_DENIED]: EMAIL_TEMPLATES.VERIFICATION_DENIED,
      [NOTIFICATION_TYPES.DOCUMENT_EXPIRING]: EMAIL_TEMPLATES.DOCUMENT_EXPIRING,
      [NOTIFICATION_TYPES.NEW_MESSAGE]: EMAIL_TEMPLATES.NEW_MESSAGE,
    };

    return templateMap[type] || null;
  }

  /**
   * Get subject line for notification type
   */
  private getSubjectForType(type: string, data: NotificationData): string {
    const subjectMap: Record<string, string> = {
      [NOTIFICATION_TYPES.DISPATCH_NEW]: `New Job Available: ${data.jobTitle || 'Service Request'}`,
      [NOTIFICATION_TYPES.DISPATCH_ACCEPTED]: 'Job Accepted',
      [NOTIFICATION_TYPES.DISPATCH_DECLINED]: 'Job Declined',
      [NOTIFICATION_TYPES.BOOKING_CONFIRMATION]: `Booking Confirmed: ${data.scheduledDate || 'Your Appointment'}`,
      [NOTIFICATION_TYPES.BOOKING_REMINDER]: `Reminder: Upcoming Appointment`,
      [NOTIFICATION_TYPES.BOOKING_CANCELLED]: 'Booking Cancelled',
      [NOTIFICATION_TYPES.JOB_SCHEDULED]: 'Job Scheduled',
      [NOTIFICATION_TYPES.JOB_STARTED]: 'Work Has Started',
      [NOTIFICATION_TYPES.JOB_COMPLETED]: 'Job Completed',
      [NOTIFICATION_TYPES.VERIFICATION_APPROVED]: 'Verification Approved',
      [NOTIFICATION_TYPES.VERIFICATION_DENIED]: 'Verification Update Required',
      [NOTIFICATION_TYPES.NEW_MESSAGE]: 'New Message',
    };

    return subjectMap[type] || 'Notification';
  }

  /**
   * Get content/body for notification type (for SMS)
   */
  private getContentForType(type: string, data: NotificationData): string {
    const contentMap: Record<string, string> = {
      [NOTIFICATION_TYPES.DISPATCH_NEW]:
        `New job available: ${data.jobTitle || 'Service Request'} in ${data.city || 'your area'}. Open app to respond.`,
      [NOTIFICATION_TYPES.DISPATCH_ACCEPTED]:
        `Your job has been accepted by ${data.proName || 'a pro'}.`,
      [NOTIFICATION_TYPES.BOOKING_CONFIRMATION]:
        `Booking confirmed for ${data.scheduledDate} at ${data.scheduledTime || 'scheduled time'} with ${data.proName || 'your pro'}.`,
      [NOTIFICATION_TYPES.BOOKING_REMINDER]:
        `Reminder: You have an appointment ${data.when || 'soon'} with ${data.proName || 'your pro'}.`,
      [NOTIFICATION_TYPES.BOOKING_CANCELLED]:
        `Your booking for ${data.scheduledDate || 'your appointment'} has been cancelled.`,
      [NOTIFICATION_TYPES.JOB_COMPLETED]:
        `Your job has been completed. Thank you for using our service!`,
      [NOTIFICATION_TYPES.VERIFICATION_APPROVED]:
        `Great news! Your verification has been approved. You can now receive jobs.`,
      [NOTIFICATION_TYPES.NEW_MESSAGE]:
        `You have a new message regarding your job. Open app to view.`,
    };

    return contentMap[type] || `Notification: ${type}`;
  }
}
