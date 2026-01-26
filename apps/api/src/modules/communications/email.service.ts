import { Injectable, Logger } from '@nestjs/common';

/**
 * Email attachment interface
 */
export interface EmailAttachment {
  /** Attachment filename */
  filename: string;
  /** Content (base64 encoded or URL) */
  content?: string;
  /** URL to fetch attachment from */
  url?: string;
  /** MIME type */
  type?: string;
  /** Content disposition */
  disposition?: 'attachment' | 'inline';
  /** Content ID for inline attachments */
  contentId?: string;
}

/**
 * Email sending options - SendGrid/SES compatible interface
 */
export interface SendEmailOptions {
  /** From email address */
  from?: string;
  /** From name */
  fromName?: string;
  /** Reply-to email address */
  replyTo?: string;
  /** Reply-to name */
  replyToName?: string;
  /** CC recipients */
  cc?: string | string[];
  /** BCC recipients */
  bcc?: string | string[];
  /** Attachments */
  attachments?: EmailAttachment[];
  /** HTML body (alternative to text body) */
  html?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Categories/tags for tracking */
  categories?: string[];
  /** Send at specific time (for scheduling) */
  sendAt?: Date;
  /** Batch ID for batch sending */
  batchId?: string;
  /** ASM group ID for unsubscribe management */
  asmGroupId?: number;
  /** IP pool name */
  ipPoolName?: string;
  /** Mail settings */
  mailSettings?: {
    sandboxMode?: boolean;
    bypassListManagement?: boolean;
    footer?: { enable: boolean; text?: string; html?: string };
  };
  /** Tracking settings */
  trackingSettings?: {
    clickTracking?: boolean;
    openTracking?: boolean;
    subscriptionTracking?: boolean;
  };
}

/**
 * Email send result
 */
export interface EmailResult {
  /** Whether the send was successful */
  success: boolean;
  /** Message ID from provider */
  messageId?: string;
  /** Status code */
  statusCode?: number;
  /** Error message if failed */
  error?: string;
  /** Additional response data */
  response?: Record<string, unknown>;
}

/**
 * Template data for dynamic templates
 */
export interface TemplateData {
  [key: string]: unknown;
}

/**
 * Email template IDs (would be configured per environment)
 */
export const EMAIL_TEMPLATES = {
  // Dispatch notifications
  DISPATCH_NEW: 'd-dispatch-new',
  DISPATCH_ACCEPTED: 'd-dispatch-accepted',
  DISPATCH_DECLINED: 'd-dispatch-declined',
  DISPATCH_TIMEOUT: 'd-dispatch-timeout',

  // Booking notifications
  BOOKING_CONFIRMATION: 'd-booking-confirmation',
  BOOKING_REMINDER: 'd-booking-reminder',
  BOOKING_CANCELLED: 'd-booking-cancelled',

  // Job notifications
  JOB_SCHEDULED: 'd-job-scheduled',
  JOB_STARTED: 'd-job-started',
  JOB_COMPLETED: 'd-job-completed',

  // Verification notifications
  VERIFICATION_SUBMITTED: 'd-verification-submitted',
  VERIFICATION_APPROVED: 'd-verification-approved',
  VERIFICATION_DENIED: 'd-verification-denied',
  DOCUMENT_EXPIRING: 'd-document-expiring',

  // Account notifications
  WELCOME: 'd-welcome',
  PASSWORD_RESET: 'd-password-reset',
  EMAIL_VERIFICATION: 'd-email-verification',

  // Communication
  NEW_MESSAGE: 'd-new-message',
} as const;

export type EmailTemplateId = typeof EMAIL_TEMPLATES[keyof typeof EMAIL_TEMPLATES] | string;

/**
 * EmailService - SendGrid/SES compatible email stub service
 *
 * This is a stub implementation that logs operations and returns mock responses.
 * Replace with actual SendGrid or AWS SES implementation when ready.
 *
 * To integrate with SendGrid:
 * 1. Install: npm install @sendgrid/mail
 * 2. Replace stub methods with actual SendGrid SDK calls
 * 3. Configure SENDGRID_API_KEY environment variable
 *
 * To integrate with AWS SES:
 * 1. Install: npm install @aws-sdk/client-ses
 * 2. Replace stub methods with actual SES SDK calls
 * 3. Configure AWS credentials
 *
 * @example
 * // Future SendGrid integration
 * import sgMail from '@sendgrid/mail';
 * sgMail.setApiKey(process.env.SENDGRID_API_KEY);
 * await sgMail.send({ to, from, subject, text });
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /** Default from email (would be configured in production) */
  private readonly DEFAULT_FROM_EMAIL = 'noreply@tradesplatform.com';
  private readonly DEFAULT_FROM_NAME = 'Trades Platform';

  constructor() {
    this.logger.log('EmailService initialized (STUB MODE)');
  }

  /**
   * Send a plain text/HTML email
   *
   * @param to - Recipient email address(es)
   * @param subject - Email subject
   * @param body - Email body (text)
   * @param options - Optional send options
   * @returns Email result
   *
   * @example
   * const result = await emailService.sendEmail(
   *   'user@example.com',
   *   'Welcome!',
   *   'Thank you for signing up.',
   * );
   */
  async sendEmail(
    to: string | string[],
    subject: string,
    body: string,
    options?: SendEmailOptions,
  ): Promise<EmailResult> {
    const recipients = Array.isArray(to) ? to : [to];
    const from = options?.from || this.DEFAULT_FROM_EMAIL;
    const messageId = this.generateMockMessageId();

    this.logger.log(`[STUB] Sending email to ${recipients.length} recipient(s)`);
    this.logger.debug(`[STUB] From: ${from}`);
    this.logger.debug(`[STUB] To: ${recipients.join(', ')}`);
    this.logger.debug(`[STUB] Subject: ${subject}`);

    if (options?.cc) {
      this.logger.debug(`[STUB] CC: ${Array.isArray(options.cc) ? options.cc.join(', ') : options.cc}`);
    }

    if (options?.attachments?.length) {
      this.logger.debug(`[STUB] Attachments: ${options.attachments.length}`);
    }

    // Simulate send delay
    await this.simulateDelay(100);

    // Validate email addresses
    for (const email of recipients) {
      if (!this.isValidEmail(email)) {
        this.logger.warn(`[STUB] Invalid email address: ${email}`);
        return {
          success: false,
          statusCode: 400,
          error: `Invalid email address: ${email}`,
        };
      }
    }

    this.logger.log(`[STUB] Email sent successfully: ${messageId}`);

    return {
      success: true,
      messageId,
      statusCode: 202,
      response: {
        message: 'Email queued for delivery',
        recipientCount: recipients.length,
      },
    };
  }

  /**
   * Send a templated email using dynamic templates
   *
   * @param to - Recipient email address(es)
   * @param templateId - Template ID (e.g., SendGrid dynamic template ID)
   * @param data - Template data for variable substitution
   * @param options - Optional send options
   * @returns Email result
   *
   * @example
   * const result = await emailService.sendTemplatedEmail(
   *   'user@example.com',
   *   EMAIL_TEMPLATES.BOOKING_CONFIRMATION,
   *   {
   *     userName: 'John',
   *     bookingDate: 'January 25, 2026',
   *     proName: 'Mike the Plumber',
   *   },
   * );
   */
  async sendTemplatedEmail(
    to: string | string[],
    templateId: EmailTemplateId,
    data: TemplateData,
    options?: SendEmailOptions,
  ): Promise<EmailResult> {
    const recipients = Array.isArray(to) ? to : [to];
    const from = options?.from || this.DEFAULT_FROM_EMAIL;
    const messageId = this.generateMockMessageId();

    this.logger.log(`[STUB] Sending templated email using template: ${templateId}`);
    this.logger.debug(`[STUB] From: ${from}`);
    this.logger.debug(`[STUB] To: ${recipients.join(', ')}`);
    this.logger.debug(`[STUB] Template data keys: ${Object.keys(data).join(', ')}`);

    // Simulate send delay
    await this.simulateDelay(100);

    // Validate email addresses
    for (const email of recipients) {
      if (!this.isValidEmail(email)) {
        this.logger.warn(`[STUB] Invalid email address: ${email}`);
        return {
          success: false,
          statusCode: 400,
          error: `Invalid email address: ${email}`,
        };
      }
    }

    // Log what the email would contain (for debugging)
    this.logger.debug(`[STUB] Rendered template data: ${JSON.stringify(data, null, 2)}`);

    this.logger.log(`[STUB] Templated email sent successfully: ${messageId}`);

    return {
      success: true,
      messageId,
      statusCode: 202,
      response: {
        message: 'Templated email queued for delivery',
        templateId,
        recipientCount: recipients.length,
      },
    };
  }

  /**
   * Send a batch of emails
   *
   * @param emails - Array of email configurations
   * @returns Array of email results
   */
  async sendBatch(
    emails: Array<{
      to: string | string[];
      subject?: string;
      body?: string;
      templateId?: EmailTemplateId;
      data?: TemplateData;
      options?: SendEmailOptions;
    }>,
  ): Promise<EmailResult[]> {
    this.logger.log(`[STUB] Sending batch of ${emails.length} emails`);

    const results: EmailResult[] = [];

    for (const email of emails) {
      let result: EmailResult;

      if (email.templateId) {
        result = await this.sendTemplatedEmail(
          email.to,
          email.templateId,
          email.data || {},
          email.options,
        );
      } else {
        result = await this.sendEmail(
          email.to,
          email.subject || 'No Subject',
          email.body || '',
          email.options,
        );
      }

      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(`[STUB] Batch complete: ${successCount}/${emails.length} successful`);

    return results;
  }

  /**
   * Get email status by message ID
   *
   * @param messageId - Email message ID
   * @returns Email status information
   */
  async getEmailStatus(messageId: string): Promise<{
    success: boolean;
    status?: string;
    events?: Array<{ event: string; timestamp: Date }>;
    error?: string;
  }> {
    this.logger.log(`[STUB] Getting status for email: ${messageId}`);

    // In production, this would call SendGrid/SES API
    return {
      success: true,
      status: 'delivered',
      events: [
        { event: 'processed', timestamp: new Date(Date.now() - 60000) },
        { event: 'delivered', timestamp: new Date() },
      ],
    };
  }

  /**
   * Validate template exists and is active
   *
   * @param templateId - Template ID to validate
   * @returns Whether template is valid
   */
  async validateTemplate(templateId: EmailTemplateId): Promise<{ valid: boolean; error?: string }> {
    this.logger.log(`[STUB] Validating template: ${templateId}`);

    // In production, this would check with SendGrid/SES
    const validTemplates = Object.values(EMAIL_TEMPLATES);
    const isValid = validTemplates.includes(templateId as any) || templateId.startsWith('d-');

    return {
      valid: isValid,
      error: isValid ? undefined : `Template not found: ${templateId}`,
    };
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    // RFC 5322 compliant email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }

  /**
   * Generate a mock message ID
   */
  private generateMockMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `<${timestamp}.${random}@tradesplatform.local>`;
  }

  /**
   * Simulate async delay (for realistic stub behavior)
   */
  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
