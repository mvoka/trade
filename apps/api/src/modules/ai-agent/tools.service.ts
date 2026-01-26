import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConsentService } from '../communications/consent.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PolicyService } from '../feature-flags/policy.service';
import { ConsentType } from '@trades/shared';

// ============================================
// TOOL INTERFACES
// ============================================

/**
 * Base interface for all tool execution contexts
 */
export interface ToolContext {
  sessionId: string;
  userId?: string;
  orgId?: string;
  permissions?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Base tool execution result
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTimeMs?: number;
    toolName?: string;
    [key: string]: unknown;
  };
}

/**
 * Consent check result
 */
export interface ConsentCheckResult {
  hasConsent: boolean;
  consentType: string;
  grantedAt?: Date;
  reason?: string;
}

// ============================================
// BOOKING TOOL INTERFACES
// ============================================

export interface BookingSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  available: boolean;
  proProfileId?: string;
}

export interface CreateBookingParams {
  jobId: string;
  proProfileId: string;
  slotId?: string;
  startTime?: Date;
  endTime?: Date;
  notes?: string;
}

export interface BookingResult {
  bookingId: string;
  status: string;
  scheduledTime: Date;
  confirmationSent: boolean;
}

// ============================================
// DISPATCH TOOL INTERFACES
// ============================================

export interface InitiateDispatchParams {
  jobId: string;
  urgency?: 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';
  preferredProIds?: string[];
  radiusKm?: number;
}

export interface DispatchStatus {
  dispatchId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  attempts: number;
  acceptedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// COMMUNICATION TOOL INTERFACES
// ============================================

export interface SendSmsParams {
  to: string;
  message: string;
  templateId?: string;
  templateVars?: Record<string, string>;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
  templateVars?: Record<string, string>;
}

export interface InitiateCallParams {
  to: string;
  callbackUrl?: string;
  recordingEnabled?: boolean;
  agentPrompt?: string;
}

// ============================================
// CALENDAR TOOL INTERFACES
// ============================================

export interface CheckAvailabilityParams {
  proProfileId: string;
  startDate: Date;
  endDate: Date;
  durationMinutes?: number;
}

export interface AvailabilityResult {
  proProfileId: string;
  slots: BookingSlot[];
  timezone: string;
}

// ============================================
// TOOLS SERVICE
// ============================================

/**
 * ToolsService - Provides tool interfaces for AI agent execution
 *
 * All tools implement:
 * - RBAC permission checks
 * - Consent validation where required
 * - Feature flag checks
 * - Audit logging (P2)
 *
 * P1 Feature: Stub implementations for all tools
 * P2 Feature: Full integration with underlying services
 */
@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    private readonly consentService: ConsentService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly policyService: PolicyService,
  ) {
    this.logger.log('ToolsService initialized');
  }

  // ============================================
  // PERMISSION HELPERS
  // ============================================

  /**
   * Check if user has required permission
   * P1: Basic permission check stub
   * P2: Full RBAC integration
   */
  private checkPermission(context: ToolContext, permission: string): boolean {
    const permissions = context.permissions ?? [];
    return permissions.includes(permission) || permissions.includes('*');
  }

  /**
   * Ensure permission or throw ForbiddenException
   */
  private ensurePermission(context: ToolContext, permission: string): void {
    if (!this.checkPermission(context, permission)) {
      throw new ForbiddenException(`Missing required permission: ${permission}`);
    }
  }

  /**
   * Check consent for a specific contact and type
   * P1: Stub returns true for demo
   * P2: Full ConsentService integration
   */
  private async checkConsent(
    contactId: string,
    consentType: ConsentType,
    context: ToolContext,
  ): Promise<ConsentCheckResult> {
    try {
      // P1 Stub: In real implementation, call ConsentService
      // const consent = await this.consentService.checkConsent(contactId, consentType);

      // Stub: Simulate consent check
      this.logger.debug(`Checking ${consentType} consent for ${contactId}`);

      // P1: Return stub result - always consented for demo
      // P2: Actual consent check
      return {
        hasConsent: true, // Stub: replace with actual check
        consentType,
        grantedAt: new Date(),
        reason: 'STUB: Consent check not implemented',
      };
    } catch (error) {
      this.logger.error(`Consent check failed for ${contactId}:`, error);
      return {
        hasConsent: false,
        consentType,
        reason: 'Consent check failed',
      };
    }
  }

  /**
   * Check if a feature flag is enabled
   */
  private async checkFeatureFlag(flag: string, context: ToolContext): Promise<boolean> {
    try {
      return await this.featureFlagsService.isEnabled(flag, {
        orgId: context.orgId,
      });
    } catch (error) {
      this.logger.error(`Feature flag check failed for ${flag}:`, error);
      return false;
    }
  }

  // ============================================
  // BOOKING TOOL
  // ============================================

  /**
   * BookingTool.createBooking - Create a new booking
   *
   * Required permissions: booking:create
   * Required flags: BOOKING_ENABLED
   *
   * P1: Stub implementation
   * P2: Full BookingService integration
   */
  async createBooking(
    params: CreateBookingParams,
    context: ToolContext,
  ): Promise<ToolResult<BookingResult>> {
    const startTime = Date.now();
    this.logger.debug('BookingTool.createBooking called', { params, sessionId: context.sessionId });

    try {
      // Permission check
      this.ensurePermission(context, 'booking:create');

      // Feature flag check
      const bookingEnabled = await this.checkFeatureFlag('BOOKING_ENABLED', context);
      if (!bookingEnabled) {
        return {
          success: false,
          error: 'Booking feature is not enabled',
          metadata: { executionTimeMs: Date.now() - startTime, toolName: 'BookingTool.createBooking' },
        };
      }

      // P1 Stub: Return mock booking result
      // P2: Integrate with BookingService.createBooking()

      const mockBookingId = `booking_${Date.now()}_stub`;

      return {
        success: true,
        data: {
          bookingId: mockBookingId,
          status: 'PENDING_CONFIRMATION',
          scheduledTime: params.startTime ?? new Date(),
          confirmationSent: false,
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          toolName: 'BookingTool.createBooking',
          stub: true,
        },
      };
    } catch (error) {
      this.logger.error('BookingTool.createBooking failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime, toolName: 'BookingTool.createBooking' },
      };
    }
  }

  /**
   * BookingTool.getSlots - Get available booking slots
   *
   * Required permissions: booking:read
   * Required flags: BOOKING_ENABLED
   *
   * P1: Stub implementation
   * P2: Full AvailabilityService integration
   */
  async getSlots(
    params: CheckAvailabilityParams,
    context: ToolContext,
  ): Promise<ToolResult<BookingSlot[]>> {
    const startTime = Date.now();
    this.logger.debug('BookingTool.getSlots called', { params, sessionId: context.sessionId });

    try {
      // Permission check
      this.ensurePermission(context, 'booking:read');

      // Feature flag check
      const bookingEnabled = await this.checkFeatureFlag('BOOKING_ENABLED', context);
      if (!bookingEnabled) {
        return {
          success: false,
          error: 'Booking feature is not enabled',
          metadata: { executionTimeMs: Date.now() - startTime, toolName: 'BookingTool.getSlots' },
        };
      }

      // P1 Stub: Return mock available slots
      // P2: Integrate with AvailabilityService.getSlots()

      const mockSlots: BookingSlot[] = [
        {
          id: 'slot_1_stub',
          startTime: new Date(params.startDate.getTime() + 9 * 60 * 60 * 1000), // 9 AM
          endTime: new Date(params.startDate.getTime() + 11 * 60 * 60 * 1000), // 11 AM
          available: true,
          proProfileId: params.proProfileId,
        },
        {
          id: 'slot_2_stub',
          startTime: new Date(params.startDate.getTime() + 14 * 60 * 60 * 1000), // 2 PM
          endTime: new Date(params.startDate.getTime() + 16 * 60 * 60 * 1000), // 4 PM
          available: true,
          proProfileId: params.proProfileId,
        },
      ];

      return {
        success: true,
        data: mockSlots,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          toolName: 'BookingTool.getSlots',
          stub: true,
        },
      };
    } catch (error) {
      this.logger.error('BookingTool.getSlots failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime, toolName: 'BookingTool.getSlots' },
      };
    }
  }

  // ============================================
  // DISPATCH TOOL
  // ============================================

  /**
   * DispatchTool.initiateDispatch - Start a dispatch process
   *
   * Required permissions: dispatch:create
   * Required flags: DISPATCH_ENABLED
   *
   * P1: Stub implementation
   * P2: Full DispatchService integration
   */
  async initiateDispatch(
    params: InitiateDispatchParams,
    context: ToolContext,
  ): Promise<ToolResult<DispatchStatus>> {
    const startTime = Date.now();
    this.logger.debug('DispatchTool.initiateDispatch called', { params, sessionId: context.sessionId });

    try {
      // Permission check
      this.ensurePermission(context, 'dispatch:create');

      // Feature flag check
      const dispatchEnabled = await this.checkFeatureFlag('DISPATCH_ENABLED', context);
      if (!dispatchEnabled) {
        return {
          success: false,
          error: 'Dispatch feature is not enabled',
          metadata: { executionTimeMs: Date.now() - startTime, toolName: 'DispatchTool.initiateDispatch' },
        };
      }

      // P1 Stub: Return mock dispatch status
      // P2: Integrate with DispatchService.initiateDispatch()

      const mockDispatchId = `dispatch_${Date.now()}_stub`;

      return {
        success: true,
        data: {
          dispatchId: mockDispatchId,
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          toolName: 'DispatchTool.initiateDispatch',
          stub: true,
        },
      };
    } catch (error) {
      this.logger.error('DispatchTool.initiateDispatch failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime, toolName: 'DispatchTool.initiateDispatch' },
      };
    }
  }

  /**
   * DispatchTool.checkStatus - Check dispatch status
   *
   * Required permissions: dispatch:read
   *
   * P1: Stub implementation
   * P2: Full DispatchService integration
   */
  async checkDispatchStatus(
    dispatchId: string,
    context: ToolContext,
  ): Promise<ToolResult<DispatchStatus>> {
    const startTime = Date.now();
    this.logger.debug('DispatchTool.checkStatus called', { dispatchId, sessionId: context.sessionId });

    try {
      // Permission check
      this.ensurePermission(context, 'dispatch:read');

      // P1 Stub: Return mock status
      // P2: Integrate with DispatchService.getStatus()

      return {
        success: true,
        data: {
          dispatchId,
          status: 'IN_PROGRESS',
          attempts: 2,
          createdAt: new Date(Date.now() - 300000), // 5 minutes ago
          updatedAt: new Date(),
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          toolName: 'DispatchTool.checkStatus',
          stub: true,
        },
      };
    } catch (error) {
      this.logger.error('DispatchTool.checkStatus failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime, toolName: 'DispatchTool.checkStatus' },
      };
    }
  }

  // ============================================
  // SMS TOOL
  // ============================================

  /**
   * SmsTool.sendSms - Send SMS message
   *
   * Required permissions: sms:send
   * Required consent: TRANSACTIONAL_SMS
   * Required flags: SMS_ENABLED
   *
   * P1: Stub implementation
   * P2: Full SmsService integration with consent check
   */
  async sendSms(
    params: SendSmsParams,
    context: ToolContext,
  ): Promise<ToolResult<{ messageId: string; status: string }>> {
    const startTime = Date.now();
    this.logger.debug('SmsTool.sendSms called', { to: params.to, sessionId: context.sessionId });

    try {
      // Permission check
      this.ensurePermission(context, 'sms:send');

      // Feature flag check
      const smsEnabled = await this.checkFeatureFlag('SMS_ENABLED', context);
      if (!smsEnabled) {
        return {
          success: false,
          error: 'SMS feature is not enabled',
          metadata: { executionTimeMs: Date.now() - startTime, toolName: 'SmsTool.sendSms' },
        };
      }

      // Consent check - REQUIRED for SMS
      const consentCheck = await this.checkConsent(
        params.to,
        ConsentType.TRANSACTIONAL_SMS,
        context,
      );

      if (!consentCheck.hasConsent) {
        return {
          success: false,
          error: `SMS consent not granted: ${consentCheck.reason}`,
          metadata: {
            executionTimeMs: Date.now() - startTime,
            toolName: 'SmsTool.sendSms',
            consentRequired: true,
          },
        };
      }

      // P1 Stub: Return mock result
      // P2: Integrate with SmsService.send()

      const mockMessageId = `sms_${Date.now()}_stub`;

      return {
        success: true,
        data: {
          messageId: mockMessageId,
          status: 'QUEUED',
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          toolName: 'SmsTool.sendSms',
          stub: true,
        },
      };
    } catch (error) {
      this.logger.error('SmsTool.sendSms failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime, toolName: 'SmsTool.sendSms' },
      };
    }
  }

  // ============================================
  // EMAIL TOOL
  // ============================================

  /**
   * EmailTool.sendEmail - Send email message
   *
   * Required permissions: email:send
   * Required flags: EMAIL_ENABLED
   *
   * P1: Stub implementation
   * P2: Full EmailService integration
   */
  async sendEmail(
    params: SendEmailParams,
    context: ToolContext,
  ): Promise<ToolResult<{ messageId: string; status: string }>> {
    const startTime = Date.now();
    this.logger.debug('EmailTool.sendEmail called', { to: params.to, sessionId: context.sessionId });

    try {
      // Permission check
      this.ensurePermission(context, 'email:send');

      // Feature flag check
      const emailEnabled = await this.checkFeatureFlag('EMAIL_ENABLED', context);
      if (!emailEnabled) {
        return {
          success: false,
          error: 'Email feature is not enabled',
          metadata: { executionTimeMs: Date.now() - startTime, toolName: 'EmailTool.sendEmail' },
        };
      }

      // P1 Stub: Return mock result
      // P2: Integrate with EmailService.send()

      const mockMessageId = `email_${Date.now()}_stub`;

      return {
        success: true,
        data: {
          messageId: mockMessageId,
          status: 'QUEUED',
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          toolName: 'EmailTool.sendEmail',
          stub: true,
        },
      };
    } catch (error) {
      this.logger.error('EmailTool.sendEmail failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime, toolName: 'EmailTool.sendEmail' },
      };
    }
  }

  // ============================================
  // CALL TOOL
  // ============================================

  /**
   * CallTool.initiateCall - Initiate an outbound call
   *
   * Required permissions: call:initiate
   * Required consent: CALL_RECORDING (if recording enabled)
   * Required flags: PHONE_AGENT_ENABLED
   *
   * P1: Stub implementation
   * P2: Full telephony integration (Twilio/Telnyx)
   */
  async initiateCall(
    params: InitiateCallParams,
    context: ToolContext,
  ): Promise<ToolResult<{ callId: string; status: string }>> {
    const startTime = Date.now();
    this.logger.debug('CallTool.initiateCall called', { to: params.to, sessionId: context.sessionId });

    try {
      // Permission check
      this.ensurePermission(context, 'call:initiate');

      // Feature flag check - PHONE_AGENT_ENABLED
      const phoneAgentEnabled = await this.checkFeatureFlag('PHONE_AGENT_ENABLED', context);
      if (!phoneAgentEnabled) {
        return {
          success: false,
          error: 'Phone agent feature is not enabled',
          metadata: { executionTimeMs: Date.now() - startTime, toolName: 'CallTool.initiateCall' },
        };
      }

      // Check PHONE_AGENT_MODE policy
      const phoneAgentMode = await this.policyService.getValue('PHONE_AGENT_MODE', {
        orgId: context.orgId,
      });
      this.logger.debug(`Phone agent mode: ${phoneAgentMode}`);

      // Consent check for recording (if enabled)
      if (params.recordingEnabled) {
        const consentCheck = await this.checkConsent(
          params.to,
          ConsentType.CALL_RECORDING,
          context,
        );

        if (!consentCheck.hasConsent) {
          return {
            success: false,
            error: `Call recording consent not granted: ${consentCheck.reason}`,
            metadata: {
              executionTimeMs: Date.now() - startTime,
              toolName: 'CallTool.initiateCall',
              consentRequired: true,
            },
          };
        }
      }

      // P1 Stub: Return mock result
      // P2: Integrate with telephony provider

      const mockCallId = `call_${Date.now()}_stub`;

      return {
        success: true,
        data: {
          callId: mockCallId,
          status: 'INITIATING',
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          toolName: 'CallTool.initiateCall',
          stub: true,
          phoneAgentMode,
        },
      };
    } catch (error) {
      this.logger.error('CallTool.initiateCall failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime, toolName: 'CallTool.initiateCall' },
      };
    }
  }

  // ============================================
  // CALENDAR TOOL
  // ============================================

  /**
   * CalendarTool.checkAvailability - Check pro availability
   *
   * Required permissions: calendar:read
   * Required flags: BOOKING_ENABLED
   *
   * P1: Stub implementation
   * P2: Full calendar integration
   */
  async checkAvailability(
    params: CheckAvailabilityParams,
    context: ToolContext,
  ): Promise<ToolResult<AvailabilityResult>> {
    const startTime = Date.now();
    this.logger.debug('CalendarTool.checkAvailability called', { params, sessionId: context.sessionId });

    try {
      // Permission check
      this.ensurePermission(context, 'calendar:read');

      // Feature flag check
      const bookingEnabled = await this.checkFeatureFlag('BOOKING_ENABLED', context);
      if (!bookingEnabled) {
        return {
          success: false,
          error: 'Booking/Calendar feature is not enabled',
          metadata: { executionTimeMs: Date.now() - startTime, toolName: 'CalendarTool.checkAvailability' },
        };
      }

      // P1 Stub: Return mock availability
      // P2: Integrate with AvailabilityService

      const mockSlots: BookingSlot[] = [
        {
          id: 'avail_1_stub',
          startTime: new Date(params.startDate.getTime() + 8 * 60 * 60 * 1000),
          endTime: new Date(params.startDate.getTime() + 10 * 60 * 60 * 1000),
          available: true,
          proProfileId: params.proProfileId,
        },
        {
          id: 'avail_2_stub',
          startTime: new Date(params.startDate.getTime() + 13 * 60 * 60 * 1000),
          endTime: new Date(params.startDate.getTime() + 17 * 60 * 60 * 1000),
          available: true,
          proProfileId: params.proProfileId,
        },
      ];

      return {
        success: true,
        data: {
          proProfileId: params.proProfileId,
          slots: mockSlots,
          timezone: 'America/Toronto',
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          toolName: 'CalendarTool.checkAvailability',
          stub: true,
        },
      };
    } catch (error) {
      this.logger.error('CalendarTool.checkAvailability failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime, toolName: 'CalendarTool.checkAvailability' },
      };
    }
  }

  // ============================================
  // TOOL REGISTRY
  // ============================================

  /**
   * Get all available tools and their metadata
   * Useful for exposing tool capabilities to the orchestrator/LLM
   */
  getToolDefinitions(): Record<string, { description: string; requiredPermissions: string[]; requiredFlags: string[] }> {
    return {
      'BookingTool.createBooking': {
        description: 'Create a new booking for a job with a pro',
        requiredPermissions: ['booking:create'],
        requiredFlags: ['BOOKING_ENABLED'],
      },
      'BookingTool.getSlots': {
        description: 'Get available booking slots for a pro',
        requiredPermissions: ['booking:read'],
        requiredFlags: ['BOOKING_ENABLED'],
      },
      'DispatchTool.initiateDispatch': {
        description: 'Initiate a dispatch process to find available pros',
        requiredPermissions: ['dispatch:create'],
        requiredFlags: ['DISPATCH_ENABLED'],
      },
      'DispatchTool.checkStatus': {
        description: 'Check the status of a dispatch',
        requiredPermissions: ['dispatch:read'],
        requiredFlags: [],
      },
      'SmsTool.sendSms': {
        description: 'Send an SMS message (requires consent)',
        requiredPermissions: ['sms:send'],
        requiredFlags: ['SMS_ENABLED'],
      },
      'EmailTool.sendEmail': {
        description: 'Send an email message',
        requiredPermissions: ['email:send'],
        requiredFlags: ['EMAIL_ENABLED'],
      },
      'CallTool.initiateCall': {
        description: 'Initiate an outbound phone call',
        requiredPermissions: ['call:initiate'],
        requiredFlags: ['PHONE_AGENT_ENABLED'],
      },
      'CalendarTool.checkAvailability': {
        description: 'Check availability for a pro',
        requiredPermissions: ['calendar:read'],
        requiredFlags: ['BOOKING_ENABLED'],
      },
    };
  }
}
