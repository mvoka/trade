import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConsentType } from '@trades/shared';

/**
 * Consent record interface
 */
export interface ConsentRecord {
  id: string;
  userId: string;
  type: ConsentType;
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Consent check result
 */
export interface ConsentCheckResult {
  hasConsent: boolean;
  consent?: ConsentRecord;
}

/**
 * Multiple consent check result
 */
export interface MultipleConsentCheckResult {
  allGranted: boolean;
  results: Record<ConsentType, boolean>;
  missing: ConsentType[];
}

/**
 * ConsentService - Manages user consent for communications
 *
 * Handles GDPR/CASL compliant consent management for:
 * - Transactional SMS/Email (required for service)
 * - Marketing SMS/Email (opt-in)
 * - Call Recording (opt-in)
 *
 * @example
 * // Check if user has SMS consent
 * const canSendSms = await consentService.hasConsent(userId, ConsentType.TRANSACTIONAL_SMS);
 *
 * // Grant marketing consent
 * await consentService.grantConsent(userId, ConsentType.MARKETING_EMAIL);
 */
@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grant consent for a specific type
   *
   * @param userId - User ID
   * @param type - Consent type to grant
   * @param metadata - Optional metadata (IP address, user agent)
   * @returns Updated or created consent record
   *
   * @example
   * const consent = await consentService.grantConsent(
   *   'user-123',
   *   ConsentType.MARKETING_SMS,
   *   { ipAddress: '192.168.1.1', userAgent: 'Mozilla/5.0...' }
   * );
   */
  async grantConsent(
    userId: string,
    type: ConsentType,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<ConsentRecord> {
    this.logger.log(`Granting ${type} consent for user: ${userId}`);

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    // Upsert consent record
    const consent = await this.prisma.consent.upsert({
      where: {
        userId_type: {
          userId,
          type: type as any,
        },
      },
      update: {
        granted: true,
        grantedAt: new Date(),
        revokedAt: null,
        ipAddress: metadata?.ipAddress || null,
        userAgent: metadata?.userAgent || null,
      },
      create: {
        userId,
        type: type as any,
        granted: true,
        grantedAt: new Date(),
        ipAddress: metadata?.ipAddress || null,
        userAgent: metadata?.userAgent || null,
      },
    });

    this.logger.log(`Consent ${type} granted for user ${userId}`);

    return {
      ...consent,
      type: consent.type as ConsentType,
    };
  }

  /**
   * Revoke consent for a specific type
   *
   * @param userId - User ID
   * @param type - Consent type to revoke
   * @param metadata - Optional metadata (IP address, user agent)
   * @returns Updated consent record
   *
   * @example
   * const consent = await consentService.revokeConsent(
   *   'user-123',
   *   ConsentType.MARKETING_SMS
   * );
   */
  async revokeConsent(
    userId: string,
    type: ConsentType,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<ConsentRecord> {
    this.logger.log(`Revoking ${type} consent for user: ${userId}`);

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    // Upsert consent record with revoked status
    const consent = await this.prisma.consent.upsert({
      where: {
        userId_type: {
          userId,
          type: type as any,
        },
      },
      update: {
        granted: false,
        revokedAt: new Date(),
        ipAddress: metadata?.ipAddress || null,
        userAgent: metadata?.userAgent || null,
      },
      create: {
        userId,
        type: type as any,
        granted: false,
        revokedAt: new Date(),
        ipAddress: metadata?.ipAddress || null,
        userAgent: metadata?.userAgent || null,
      },
    });

    this.logger.log(`Consent ${type} revoked for user ${userId}`);

    return {
      ...consent,
      type: consent.type as ConsentType,
    };
  }

  /**
   * Check if user has granted a specific consent
   *
   * @param userId - User ID
   * @param type - Consent type to check
   * @returns Whether consent is granted
   *
   * @example
   * const canSendMarketing = await consentService.hasConsent(
   *   'user-123',
   *   ConsentType.MARKETING_EMAIL
   * );
   */
  async hasConsent(userId: string, type: ConsentType): Promise<boolean> {
    const consent = await this.prisma.consent.findUnique({
      where: {
        userId_type: {
          userId,
          type: type as any,
        },
      },
    });

    // If no record exists, consent is not granted
    if (!consent) {
      return false;
    }

    return consent.granted;
  }

  /**
   * Get detailed consent check result
   *
   * @param userId - User ID
   * @param type - Consent type to check
   * @returns Consent check result with full record
   */
  async checkConsent(userId: string, type: ConsentType): Promise<ConsentCheckResult> {
    const consent = await this.prisma.consent.findUnique({
      where: {
        userId_type: {
          userId,
          type: type as any,
        },
      },
    });

    if (!consent) {
      return { hasConsent: false };
    }

    return {
      hasConsent: consent.granted,
      consent: {
        ...consent,
        type: consent.type as ConsentType,
      },
    };
  }

  /**
   * Get all consents for a user
   *
   * @param userId - User ID
   * @returns Array of all consent records for the user
   *
   * @example
   * const consents = await consentService.getConsents('user-123');
   * consents.forEach(c => console.log(`${c.type}: ${c.granted}`));
   */
  async getConsents(userId: string): Promise<ConsentRecord[]> {
    const consents = await this.prisma.consent.findMany({
      where: { userId },
      orderBy: { type: 'asc' },
    });

    return consents.map((consent) => ({
      ...consent,
      type: consent.type as ConsentType,
    }));
  }

  /**
   * Get all consents with defaults for missing types
   *
   * @param userId - User ID
   * @returns All consent types with their status (including defaults for unset)
   */
  async getConsentsWithDefaults(userId: string): Promise<Record<ConsentType, boolean>> {
    const consents = await this.getConsents(userId);

    // Build map with defaults (all false by default)
    const result: Record<ConsentType, boolean> = {
      TRANSACTIONAL_SMS: false,
      MARKETING_SMS: false,
      TRANSACTIONAL_EMAIL: false,
      MARKETING_EMAIL: false,
      CALL_RECORDING: false,
    };

    // Override with actual values
    for (const consent of consents) {
      result[consent.type] = consent.granted;
    }

    return result;
  }

  /**
   * Check multiple consent types at once
   *
   * @param userId - User ID
   * @param types - Array of consent types to check
   * @returns Result showing if all are granted and which are missing
   *
   * @example
   * const result = await consentService.requireConsent(
   *   'user-123',
   *   [ConsentType.TRANSACTIONAL_SMS, ConsentType.CALL_RECORDING]
   * );
   * if (!result.allGranted) {
   *   console.log('Missing consents:', result.missing);
   * }
   */
  async requireConsent(
    userId: string,
    types: ConsentType[],
  ): Promise<MultipleConsentCheckResult> {
    const consents = await this.prisma.consent.findMany({
      where: {
        userId,
        type: { in: types as any[] },
      },
    });

    // Build results map
    const results: Record<ConsentType, boolean> = {} as Record<ConsentType, boolean>;
    const missing: ConsentType[] = [];

    for (const type of types) {
      const consent = consents.find((c) => c.type === type);
      const isGranted = consent?.granted ?? false;
      results[type] = isGranted;

      if (!isGranted) {
        missing.push(type);
      }
    }

    return {
      allGranted: missing.length === 0,
      results,
      missing,
    };
  }

  /**
   * Bulk update consents for a user
   *
   * @param userId - User ID
   * @param updates - Array of consent updates
   * @param metadata - Optional metadata
   * @returns Updated consent records
   */
  async bulkUpdateConsents(
    userId: string,
    updates: Array<{ type: ConsentType; granted: boolean }>,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<ConsentRecord[]> {
    this.logger.log(`Bulk updating ${updates.length} consents for user: ${userId}`);

    const results: ConsentRecord[] = [];

    for (const update of updates) {
      const consent = update.granted
        ? await this.grantConsent(userId, update.type, metadata)
        : await this.revokeConsent(userId, update.type, metadata);

      results.push(consent);
    }

    return results;
  }

  /**
   * Initialize default transactional consents for a new user
   *
   * Call this when a new user registers to set up default consents.
   * By default, transactional communications are enabled.
   *
   * @param userId - User ID
   * @param metadata - Optional metadata
   * @returns Created consent records
   */
  async initializeDefaultConsents(
    userId: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<ConsentRecord[]> {
    this.logger.log(`Initializing default consents for user: ${userId}`);

    const defaults: Array<{ type: ConsentType; granted: boolean }> = [
      { type: 'TRANSACTIONAL_SMS' as ConsentType, granted: true },
      { type: 'TRANSACTIONAL_EMAIL' as ConsentType, granted: true },
      { type: 'MARKETING_SMS' as ConsentType, granted: false },
      { type: 'MARKETING_EMAIL' as ConsentType, granted: false },
      { type: 'CALL_RECORDING' as ConsentType, granted: false },
    ];

    return this.bulkUpdateConsents(userId, defaults, metadata);
  }

  /**
   * Get consent audit trail for a user
   *
   * Returns the history of consent changes. In production, this would
   * query an audit log table.
   *
   * @param userId - User ID
   * @returns Current consent records (in production, would include history)
   */
  async getConsentAuditTrail(userId: string): Promise<ConsentRecord[]> {
    // In production, this would query an audit log table
    // For now, return current state with timestamps
    return this.getConsents(userId);
  }
}
