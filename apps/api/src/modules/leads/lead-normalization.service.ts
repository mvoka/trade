import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  LeadSource,
  LeadStatus,
  createLeadFingerprint,
  formatPostalCode,
  isValidCanadianPostalCode,
} from '@trades/shared';

// Normalized lead structure
export interface NormalizedLead {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  businessName?: string;
  serviceAddressLine1?: string;
  serviceAddressLine2?: string;
  serviceCity?: string;
  serviceProvince?: string;
  servicePostalCode?: string;
  serviceCountry?: string;
  serviceAddress?: string; // Full formatted address
  serviceLat?: number;
  serviceLng?: number;
  serviceCategory?: string;
  description?: string;
  preferredDateStart?: Date;
  preferredDateEnd?: Date;
  urgency?: string;
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Duplicate detection result
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateOfId?: string;
  fingerprint: string;
}

@Injectable()
export class LeadNormalizationService {
  private readonly logger = new Logger(LeadNormalizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalize raw lead data from various sources into a standard format
   */
  normalize(rawPayload: Record<string, unknown>, source: LeadSource): NormalizedLead {
    this.logger.debug(`Normalizing lead from source: ${source}`);

    switch (source) {
      case LeadSource.WEB_FORM:
        return this.normalizeWebFormLead(rawPayload);
      case LeadSource.WEBHOOK:
        return this.normalizeWebhookLead(rawPayload);
      case LeadSource.EMAIL:
        return this.normalizeEmailLead(rawPayload);
      case LeadSource.PHONE:
        return this.normalizePhoneLead(rawPayload);
      case LeadSource.MANUAL:
        return this.normalizeManualLead(rawPayload);
      default:
        return this.normalizeGenericLead(rawPayload);
    }
  }

  /**
   * Validate normalized lead data for required fields
   */
  validate(normalized: NormalizedLead): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required: At least one contact method
    if (!normalized.contactPhone && !normalized.contactEmail) {
      errors.push('At least one contact method (phone or email) is required');
    }

    // Required: Contact name
    if (!normalized.contactName || normalized.contactName.trim().length < 2) {
      errors.push('Contact name is required and must be at least 2 characters');
    }

    // Required: Description
    if (!normalized.description || normalized.description.trim().length < 10) {
      errors.push('Description is required and must be at least 10 characters');
    }

    // Validate phone format if provided
    if (normalized.contactPhone) {
      const phoneDigits = normalized.contactPhone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        errors.push('Phone number must have at least 10 digits');
      }
    }

    // Validate email format if provided
    if (normalized.contactEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalized.contactEmail)) {
        errors.push('Invalid email format');
      }
    }

    // Validate postal code if provided
    if (normalized.servicePostalCode) {
      if (!isValidCanadianPostalCode(normalized.servicePostalCode)) {
        warnings.push('Postal code may not be valid Canadian format');
      }
    }

    // Warn if no service address
    if (!normalized.serviceAddress && !normalized.serviceAddressLine1) {
      warnings.push('No service address provided');
    }

    // Warn if no service category
    if (!normalized.serviceCategory) {
      warnings.push('No service category specified');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check for duplicate leads using fingerprint matching
   */
  async detectDuplicate(normalized: NormalizedLead): Promise<DuplicateCheckResult> {
    const fingerprint = this.createFingerprint(
      normalized.contactEmail,
      normalized.contactPhone,
      normalized.serviceAddress || normalized.serviceAddressLine1,
    );

    if (!fingerprint) {
      return {
        isDuplicate: false,
        fingerprint: '',
      };
    }

    // Check for existing leads with the same fingerprint in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const existingLead = await this.prisma.leadNormalized.findFirst({
      where: {
        fingerprint,
        createdAt: {
          gte: twentyFourHoursAgo,
        },
        status: {
          notIn: [LeadStatus.INVALID, LeadStatus.DUPLICATE],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingLead) {
      this.logger.debug(`Duplicate lead detected: ${existingLead.id}`);
      return {
        isDuplicate: true,
        duplicateOfId: existingLead.id,
        fingerprint,
      };
    }

    return {
      isDuplicate: false,
      fingerprint,
    };
  }

  /**
   * Create a fingerprint for lead deduplication
   * Uses the shared utility function
   */
  createFingerprint(email?: string, phone?: string, address?: string): string {
    return createLeadFingerprint(email, phone, address);
  }

  // ============================================
  // PRIVATE NORMALIZATION METHODS
  // ============================================

  private normalizeWebFormLead(payload: Record<string, unknown>): NormalizedLead {
    // Web form data comes pre-structured from WebLeadDto
    const serviceAddress = this.buildServiceAddress(
      payload.serviceAddressLine1 as string | undefined,
      payload.serviceAddressLine2 as string | undefined,
      payload.serviceCity as string | undefined,
      payload.serviceProvince as string | undefined,
      payload.servicePostalCode as string | undefined,
      payload.serviceCountry as string | undefined,
    );

    return {
      contactName: this.sanitizeString(payload.contactName as string | undefined),
      contactEmail: this.sanitizeEmail(payload.contactEmail as string | undefined),
      contactPhone: this.sanitizePhone(payload.contactPhone as string | undefined),
      businessName: this.sanitizeString(payload.businessName as string | undefined),
      serviceAddressLine1: this.sanitizeString(payload.serviceAddressLine1 as string | undefined),
      serviceAddressLine2: this.sanitizeString(payload.serviceAddressLine2 as string | undefined),
      serviceCity: this.sanitizeString(payload.serviceCity as string | undefined),
      serviceProvince: this.sanitizeString(payload.serviceProvince as string | undefined)?.toUpperCase(),
      servicePostalCode: payload.servicePostalCode
        ? formatPostalCode(payload.servicePostalCode as string)
        : undefined,
      serviceCountry: (payload.serviceCountry as string | undefined) || 'CA',
      serviceAddress,
      serviceCategory: this.sanitizeString(payload.serviceCategory as string | undefined)?.toUpperCase(),
      description: this.sanitizeString(payload.description as string | undefined),
      preferredDateStart: this.parseDate(payload.preferredDateStart as string | undefined),
      preferredDateEnd: this.parseDate(payload.preferredDateEnd as string | undefined),
      urgency: (payload.urgency as string | undefined) || 'NORMAL',
    };
  }

  private normalizeWebhookLead(payload: Record<string, unknown>): NormalizedLead {
    // Webhook data requires flexible field mapping
    // Common field name variations are handled here
    const contactName =
      this.sanitizeString(payload.contactName as string) ||
      this.sanitizeString(payload.name as string) ||
      this.sanitizeString(payload.customer_name as string) ||
      this.sanitizeString(payload.full_name as string) ||
      this.buildName(payload.firstName as string, payload.lastName as string) ||
      this.buildName(payload.first_name as string, payload.last_name as string);

    const contactEmail =
      this.sanitizeEmail(payload.contactEmail as string) ||
      this.sanitizeEmail(payload.email as string) ||
      this.sanitizeEmail(payload.customer_email as string);

    const contactPhone =
      this.sanitizePhone(payload.contactPhone as string) ||
      this.sanitizePhone(payload.phone as string) ||
      this.sanitizePhone(payload.telephone as string) ||
      this.sanitizePhone(payload.customer_phone as string) ||
      this.sanitizePhone(payload.mobile as string);

    const businessName =
      this.sanitizeString(payload.businessName as string) ||
      this.sanitizeString(payload.company as string) ||
      this.sanitizeString(payload.business as string) ||
      this.sanitizeString(payload.company_name as string);

    const addressLine1 =
      this.sanitizeString(payload.serviceAddressLine1 as string) ||
      this.sanitizeString(payload.address as string) ||
      this.sanitizeString(payload.street as string) ||
      this.sanitizeString(payload.address_line_1 as string) ||
      this.sanitizeString(payload.street_address as string);

    const addressLine2 =
      this.sanitizeString(payload.serviceAddressLine2 as string) ||
      this.sanitizeString(payload.address2 as string) ||
      this.sanitizeString(payload.address_line_2 as string) ||
      this.sanitizeString(payload.unit as string) ||
      this.sanitizeString(payload.suite as string);

    const city =
      this.sanitizeString(payload.serviceCity as string) ||
      this.sanitizeString(payload.city as string);

    const province =
      this.sanitizeString(payload.serviceProvince as string) ||
      this.sanitizeString(payload.province as string) ||
      this.sanitizeString(payload.state as string);

    const postalCode =
      (payload.servicePostalCode as string) ||
      (payload.postalCode as string) ||
      (payload.postal_code as string) ||
      (payload.zip as string) ||
      (payload.zipCode as string);

    const country =
      (payload.serviceCountry as string) ||
      (payload.country as string) ||
      'CA';

    const serviceAddress = this.buildServiceAddress(
      addressLine1,
      addressLine2,
      city,
      province,
      postalCode,
      country,
    );

    const serviceCategory =
      this.sanitizeString(payload.serviceCategory as string) ||
      this.sanitizeString(payload.category as string) ||
      this.sanitizeString(payload.service as string) ||
      this.sanitizeString(payload.service_type as string);

    const description =
      this.sanitizeString(payload.description as string) ||
      this.sanitizeString(payload.message as string) ||
      this.sanitizeString(payload.notes as string) ||
      this.sanitizeString(payload.details as string) ||
      this.sanitizeString(payload.request as string);

    const urgency =
      this.normalizeUrgency(payload.urgency as string) ||
      this.normalizeUrgency(payload.priority as string) ||
      'NORMAL';

    return {
      contactName,
      contactEmail,
      contactPhone,
      businessName,
      serviceAddressLine1: addressLine1,
      serviceAddressLine2: addressLine2,
      serviceCity: city,
      serviceProvince: province?.toUpperCase(),
      servicePostalCode: postalCode ? formatPostalCode(postalCode) : undefined,
      serviceCountry: country,
      serviceAddress,
      serviceCategory: serviceCategory?.toUpperCase(),
      description,
      preferredDateStart: this.parseDate(
        (payload.preferredDateStart as string) ||
          (payload.preferred_date as string) ||
          (payload.date as string),
      ),
      preferredDateEnd: this.parseDate(payload.preferredDateEnd as string),
      urgency,
    };
  }

  private normalizeEmailLead(payload: Record<string, unknown>): NormalizedLead {
    // Email leads typically have from, subject, body fields
    const from = payload.from as string;
    const body = payload.body as string || payload.text as string;
    const subject = payload.subject as string;

    // Extract email from 'from' field (may be formatted as "Name <email>")
    const emailMatch = from?.match(/<([^>]+)>/) || from?.match(/([^\s]+@[^\s]+)/);
    const contactEmail = emailMatch ? emailMatch[1] : from;

    // Try to extract name from 'from' field
    const nameMatch = from?.match(/^([^<]+)/);
    const contactName = nameMatch ? nameMatch[1].trim() : undefined;

    // Extract phone from body (simple regex)
    const phoneMatch = body?.match(
      /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/,
    );
    const contactPhone = phoneMatch ? phoneMatch[0] : undefined;

    return {
      contactName: this.sanitizeString(contactName),
      contactEmail: this.sanitizeEmail(contactEmail),
      contactPhone: this.sanitizePhone(contactPhone),
      description: this.sanitizeString(body) || this.sanitizeString(subject),
      urgency: 'NORMAL',
    };
  }

  private normalizePhoneLead(payload: Record<string, unknown>): NormalizedLead {
    // Phone leads might come from a call transcription service
    return this.normalizeGenericLead(payload);
  }

  private normalizeManualLead(payload: Record<string, unknown>): NormalizedLead {
    // Manual leads follow the same structure as web form
    return this.normalizeWebFormLead(payload);
  }

  private normalizeGenericLead(payload: Record<string, unknown>): NormalizedLead {
    // Generic fallback normalization
    return this.normalizeWebhookLead(payload);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private sanitizeString(value: string | undefined | null): string | undefined {
    if (!value || typeof value !== 'string') {
      return undefined;
    }
    return value.trim().replace(/\s+/g, ' ');
  }

  private sanitizeEmail(value: string | undefined | null): string | undefined {
    if (!value || typeof value !== 'string') {
      return undefined;
    }
    return value.trim().toLowerCase();
  }

  private sanitizePhone(value: string | undefined | null): string | undefined {
    if (!value || typeof value !== 'string') {
      return undefined;
    }
    // Keep formatting but remove extra whitespace
    return value.trim();
  }

  private buildName(firstName?: string, lastName?: string): string | undefined {
    const first = this.sanitizeString(firstName);
    const last = this.sanitizeString(lastName);
    if (first && last) {
      return `${first} ${last}`;
    }
    return first || last;
  }

  private buildServiceAddress(
    line1?: string,
    line2?: string,
    city?: string,
    province?: string,
    postalCode?: string,
    country?: string,
  ): string | undefined {
    const parts: string[] = [];

    if (line1) parts.push(line1);
    if (line2) parts.push(line2);

    const cityProvinceParts: string[] = [];
    if (city) cityProvinceParts.push(city);
    if (province) cityProvinceParts.push(province);
    if (cityProvinceParts.length > 0) {
      parts.push(cityProvinceParts.join(', '));
    }

    if (postalCode) parts.push(formatPostalCode(postalCode));
    if (country && country !== 'CA') parts.push(country);

    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  private parseDate(value: string | undefined | null): Date | undefined {
    if (!value) {
      return undefined;
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }

  private normalizeUrgency(value: string | undefined | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const upper = value.toUpperCase().trim();
    const validUrgencies = ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'];
    if (validUrgencies.includes(upper)) {
      return upper;
    }
    // Map common variations
    const urgencyMap: Record<string, string> = {
      URGENT: 'HIGH',
      ASAP: 'HIGH',
      CRITICAL: 'EMERGENCY',
      ROUTINE: 'NORMAL',
      STANDARD: 'NORMAL',
      FLEXIBLE: 'LOW',
    };
    return urgencyMap[upper] || 'NORMAL';
  }
}
