import { Injectable, Logger } from '@nestjs/common';

/**
 * SMS sending options - Twilio-compatible interface
 */
export interface SendSmsOptions {
  /** From phone number (Twilio number or masked number) */
  from?: string;
  /** Media URLs for MMS messages */
  mediaUrls?: string[];
  /** Webhook URL for status callbacks */
  statusCallback?: string;
  /** Message service SID (for messaging services) */
  messagingServiceSid?: string;
  /** Maximum price willing to pay for message */
  maxPrice?: string;
  /** Whether to provide feedback */
  provideFeedback?: boolean;
  /** Validity period in seconds */
  validityPeriod?: number;
  /** Force delivery even if user has unsubscribed */
  forceDelivery?: boolean;
  /** Smart encoding for message body */
  smartEncoded?: boolean;
  /** Scheduling - send at specific time */
  sendAt?: Date;
  /** Schedule type */
  scheduleType?: 'fixed';
}

/**
 * SMS send result - Twilio-compatible interface
 */
export interface SmsResult {
  /** Whether the send was successful */
  success: boolean;
  /** Twilio message SID */
  messageSid?: string;
  /** Current status of the message */
  status?: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  /** To phone number */
  to?: string;
  /** From phone number */
  from?: string;
  /** Message body */
  body?: string;
  /** Number of segments */
  numSegments?: string;
  /** Number of media items */
  numMedia?: string;
  /** Direction of message */
  direction?: 'outbound-api' | 'inbound';
  /** Price of the message */
  price?: string;
  /** Price unit */
  priceUnit?: string;
  /** Error code if failed */
  errorCode?: number;
  /** Error message if failed */
  errorMessage?: string;
  /** Date message was created */
  dateCreated?: Date;
  /** Date message was sent */
  dateSent?: Date;
  /** Date message was updated */
  dateUpdated?: Date;
}

/**
 * Masked phone number result
 */
export interface MaskedNumberResult {
  /** Whether the operation was successful */
  success: boolean;
  /** The masked phone number */
  maskedNumber?: string;
  /** The phone number SID */
  phoneNumberSid?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * SmsService - Twilio-compatible SMS stub service
 *
 * This is a stub implementation that logs operations and returns mock responses.
 * Replace with actual Twilio implementation when ready.
 *
 * To integrate with Twilio:
 * 1. Install: npm install twilio
 * 2. Replace stub methods with actual Twilio SDK calls
 * 3. Configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables
 *
 * @example
 * // Future Twilio integration
 * import Twilio from 'twilio';
 * const client = Twilio(accountSid, authToken);
 * await client.messages.create({ to, from, body });
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  /** Default from number (would be configured in production) */
  private readonly DEFAULT_FROM_NUMBER = '+15555550100';

  /** In-memory store for masked numbers (stub) */
  private readonly maskedNumbers: Map<string, string> = new Map();

  constructor() {
    this.logger.log('SmsService initialized (STUB MODE)');
  }

  /**
   * Send an SMS message
   *
   * @param to - Recipient phone number (E.164 format)
   * @param message - Message body
   * @param options - Optional send options (Twilio-compatible)
   * @returns SMS result with message details
   *
   * @example
   * const result = await smsService.sendSms('+14165551234', 'Hello!');
   * if (result.success) {
   *   console.log('Message SID:', result.messageSid);
   * }
   */
  async sendSms(
    to: string,
    message: string,
    options?: SendSmsOptions,
  ): Promise<SmsResult> {
    const from = options?.from || this.DEFAULT_FROM_NUMBER;
    const messageSid = this.generateMockSid('SM');

    this.logger.log(`[STUB] Sending SMS to ${to} from ${from}`);
    this.logger.debug(`[STUB] Message body: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

    if (options?.mediaUrls?.length) {
      this.logger.debug(`[STUB] MMS with ${options.mediaUrls.length} media items`);
    }

    // Simulate send delay
    await this.simulateDelay(100);

    // Validate phone number format (basic E.164 check)
    if (!this.isValidE164(to)) {
      this.logger.warn(`[STUB] Invalid phone number format: ${to}`);
      return {
        success: false,
        errorCode: 21211,
        errorMessage: 'Invalid phone number format',
        to,
        from,
        status: 'failed',
      };
    }

    // Return success result
    const result: SmsResult = {
      success: true,
      messageSid,
      status: 'queued',
      to,
      from,
      body: message,
      numSegments: String(Math.ceil(message.length / 160)),
      numMedia: String(options?.mediaUrls?.length || 0),
      direction: 'outbound-api',
      dateCreated: new Date(),
      dateUpdated: new Date(),
    };

    this.logger.log(`[STUB] SMS queued successfully: ${messageSid}`);

    return result;
  }

  /**
   * Get or create a masked phone number for a user
   *
   * Masked numbers allow SMB<->Pro communication without revealing personal numbers.
   * In production, this would use Twilio Proxy or similar service.
   *
   * @param userId - User ID to get/create masked number for
   * @returns Masked number result
   *
   * @example
   * const result = await smsService.getMaskedNumber('user-123');
   * if (result.success) {
   *   console.log('Masked number:', result.maskedNumber);
   * }
   */
  async getMaskedNumber(userId: string): Promise<MaskedNumberResult> {
    this.logger.log(`[STUB] Getting/creating masked number for user: ${userId}`);

    // Check if user already has a masked number
    if (this.maskedNumbers.has(userId)) {
      const existingNumber = this.maskedNumbers.get(userId)!;
      this.logger.debug(`[STUB] Found existing masked number for user ${userId}: ${existingNumber}`);
      return {
        success: true,
        maskedNumber: existingNumber,
        phoneNumberSid: this.generateMockSid('PN'),
      };
    }

    // Simulate API delay
    await this.simulateDelay(50);

    // Generate a mock masked number
    const maskedNumber = this.generateMockMaskedNumber();
    this.maskedNumbers.set(userId, maskedNumber);

    this.logger.log(`[STUB] Created new masked number for user ${userId}: ${maskedNumber}`);

    return {
      success: true,
      maskedNumber,
      phoneNumberSid: this.generateMockSid('PN'),
    };
  }

  /**
   * Send an SMS to a masked number proxy session
   *
   * @param sessionId - Proxy session ID
   * @param participantNumber - Participant phone number
   * @param message - Message body
   * @returns SMS result
   */
  async sendToProxy(
    sessionId: string,
    participantNumber: string,
    message: string,
  ): Promise<SmsResult> {
    this.logger.log(`[STUB] Sending to proxy session ${sessionId}`);
    return this.sendSms(participantNumber, message, {
      messagingServiceSid: `MG${sessionId.substring(0, 32)}`,
    });
  }

  /**
   * Get message status by SID
   *
   * @param messageSid - Twilio message SID
   * @returns Current message status
   */
  async getMessageStatus(messageSid: string): Promise<SmsResult> {
    this.logger.log(`[STUB] Getting status for message: ${messageSid}`);

    // In production, this would call Twilio API
    return {
      success: true,
      messageSid,
      status: 'delivered',
      dateUpdated: new Date(),
    };
  }

  /**
   * Cancel a scheduled message
   *
   * @param messageSid - Twilio message SID
   * @returns Whether cancellation was successful
   */
  async cancelScheduledMessage(messageSid: string): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`[STUB] Cancelling scheduled message: ${messageSid}`);
    return { success: true };
  }

  /**
   * Validate phone number format (E.164)
   */
  private isValidE164(phoneNumber: string): boolean {
    // Basic E.164 validation: + followed by 10-15 digits
    const e164Regex = /^\+[1-9]\d{9,14}$/;
    return e164Regex.test(phoneNumber);
  }

  /**
   * Generate a mock Twilio SID
   */
  private generateMockSid(prefix: string): string {
    const chars = 'abcdef0123456789';
    let result = prefix;
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a mock masked phone number
   */
  private generateMockMaskedNumber(): string {
    // Generate a random US/CA number for demo
    const areaCode = String(Math.floor(Math.random() * 800) + 200);
    const exchange = String(Math.floor(Math.random() * 900) + 100);
    const subscriber = String(Math.floor(Math.random() * 9000) + 1000);
    return `+1${areaCode}${exchange}${subscriber}`;
  }

  /**
   * Simulate async delay (for realistic stub behavior)
   */
  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
