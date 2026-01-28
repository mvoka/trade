import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PolicyService } from '../feature-flags/policy.service';
import { AuditService } from '../audit/audit.service';
import { FEATURE_FLAGS, POLICY_KEYS, AUDIT_ACTIONS, ERROR_CODES } from '@trades/shared';
import {
  SubmitLeadDto,
  UpdateLeadStatusDto,
  OfferLeadResponseDto,
  OfferLeadsListResponseDto,
  LeadSubmissionResponseDto,
  LeadsQueryDto,
  LeadStatus,
} from './dto/offers.dto';

/**
 * OfferLeadsService - Manages lead capture and follow-up
 *
 * Feature Flag: OFFER_CAMPAIGNS_ENABLED
 *
 * Provides:
 * - Lead submission from public forms
 * - Lead status management
 * - Follow-up tracking
 * - Compliance-aware lead handling
 */
@Injectable()
export class OfferLeadsService {
  private readonly logger = new Logger(OfferLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Check if offer campaigns feature is enabled
   */
  private async checkFeatureEnabled(): Promise<void> {
    const enabled = await this.featureFlagsService.isEnabled(FEATURE_FLAGS.OFFER_CAMPAIGNS_ENABLED, {});
    if (!enabled) {
      throw new ForbiddenException(ERROR_CODES.OFFERS_NOT_ENABLED);
    }
  }

  /**
   * Submit a lead from public offer form
   */
  async submitLead(slug: string, dto: SubmitLeadDto): Promise<LeadSubmissionResponseDto> {
    await this.checkFeatureEnabled();

    // Find the campaign
    const campaign = await this.prisma.offerCampaign.findUnique({
      where: { slug },
    });

    if (!campaign || campaign.status !== 'ACTIVE') {
      throw new NotFoundException('Offer not found or not active');
    }

    // Check if expired
    if (campaign.expiresAt && campaign.expiresAt < new Date()) {
      throw new BadRequestException('Offer has expired');
    }

    // Validate marketing consent if required
    if (campaign.requiresMarketingConsent && !dto.marketingConsentGranted) {
      throw new BadRequestException('Marketing consent is required for this offer');
    }

    // Check for duplicate leads (same email + campaign)
    const existingLead = await this.prisma.offerLead.findFirst({
      where: {
        campaignId: campaign.id,
        email: dto.email.toLowerCase(),
      },
    });

    if (existingLead) {
      // Return success but don't create duplicate
      return {
        success: true,
        message: 'Thank you for your interest! We will be in touch soon.',
      };
    }

    // Create the lead
    const lead = await this.prisma.offerLead.create({
      data: {
        campaignId: campaign.id,
        name: dto.name,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        address: dto.address,
        notes: dto.notes,
        status: 'NEW',
        marketingConsentGranted: dto.marketingConsentGranted,
        customFieldValues: dto.customFieldValues ?? {},
        followUpCount: 0,
      },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.OFFER_LEAD_SUBMITTED,
      targetType: 'OfferLead',
      targetId: lead.id,
      details: {
        campaignId: campaign.id,
        hasConsent: dto.marketingConsentGranted,
      },
    });

    this.logger.log(`Lead submitted for campaign ${campaign.id}: ${lead.id}`);

    return {
      success: true,
      message: 'Thank you for your interest! We will be in touch soon.',
      leadId: lead.id,
    };
  }

  /**
   * Get leads for a campaign
   */
  async getLeadsForCampaign(
    campaignId: string,
    query: LeadsQueryDto,
  ): Promise<OfferLeadsListResponseDto> {
    await this.checkFeatureEnabled();

    const { status, hasMarketingConsent, page = 1, pageSize = 20 } = query;

    const where: Record<string, unknown> = { campaignId };

    if (status) {
      where.status = status;
    }

    if (hasMarketingConsent !== undefined) {
      where.marketingConsentGranted = hasMarketingConsent;
    }

    const skip = (page - 1) * pageSize;

    const [leads, total] = await Promise.all([
      this.prisma.offerLead.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.offerLead.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      leads: leads.map((lead) => this.mapToResponse(lead)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get lead by ID
   */
  async getLead(id: string): Promise<OfferLeadResponseDto> {
    await this.checkFeatureEnabled();

    const lead = await this.prisma.offerLead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return this.mapToResponse(lead);
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(
    id: string,
    dto: UpdateLeadStatusDto,
    actorId: string,
  ): Promise<OfferLeadResponseDto> {
    await this.checkFeatureEnabled();

    const lead = await this.prisma.offerLead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const updateData: Record<string, unknown> = {
      status: dto.status,
    };

    // Track specific status changes
    if (dto.status === 'CONTACTED' && lead.status === 'NEW') {
      updateData.lastContactedAt = new Date();
      updateData.followUpCount = lead.followUpCount + 1;
    }

    if (dto.status === 'CONVERTED') {
      updateData.convertedAt = new Date();
    }

    const updated = await this.prisma.offerLead.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.OFFER_LEAD_STATUS_UPDATED,
      actorId,
      targetType: 'OfferLead',
      targetId: id,
      details: {
        previousStatus: lead.status,
        newStatus: dto.status,
        notes: dto.notes,
      },
    });

    this.logger.log(`Lead status updated: ${id} -> ${dto.status}`);

    return this.mapToResponse(updated);
  }

  /**
   * Record a follow-up contact
   */
  async recordFollowUp(
    id: string,
    notes: string,
    actorId: string,
  ): Promise<OfferLeadResponseDto> {
    await this.checkFeatureEnabled();

    const lead = await this.prisma.offerLead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Check max follow-ups policy
    const maxFollowUps = await this.policyService.getValue<number>(
      POLICY_KEYS.OFFER_MAX_FOLLOWUPS,
      {},
    ) ?? 3;

    if (lead.followUpCount >= maxFollowUps) {
      throw new BadRequestException(`Maximum follow-up attempts (${maxFollowUps}) reached`);
    }

    const updated = await this.prisma.offerLead.update({
      where: { id },
      data: {
        followUpCount: lead.followUpCount + 1,
        lastContactedAt: new Date(),
        status: lead.status === 'NEW' ? 'CONTACTED' : lead.status,
      },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.OFFER_LEAD_FOLLOWUP,
      actorId,
      targetType: 'OfferLead',
      targetId: id,
      details: {
        followUpCount: updated.followUpCount,
        notes,
      },
    });

    this.logger.log(`Follow-up recorded for lead: ${id}`);

    return this.mapToResponse(updated);
  }

  /**
   * Get leads requiring follow-up
   */
  async getLeadsRequiringFollowUp(limit: number = 20): Promise<OfferLeadResponseDto[]> {
    await this.checkFeatureEnabled();

    const maxFollowUps = await this.policyService.getValue<number>(
      POLICY_KEYS.OFFER_MAX_FOLLOWUPS,
      {},
    ) ?? 3;

    // Find leads that are NEW or CONTACTED and haven't reached max follow-ups
    // and haven't been contacted in the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const leads = await this.prisma.offerLead.findMany({
      where: {
        status: { in: ['NEW', 'CONTACTED'] },
        followUpCount: { lt: maxFollowUps },
        OR: [
          { lastContactedAt: null },
          { lastContactedAt: { lt: oneDayAgo } },
        ],
      },
      orderBy: [
        { status: 'asc' }, // NEW before CONTACTED
        { createdAt: 'asc' }, // Oldest first
      ],
      take: limit,
    });

    return leads.map((lead) => this.mapToResponse(lead));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToResponse(lead: {
    id: string;
    campaignId: string;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    notes: string | null;
    status: string;
    marketingConsentGranted: boolean;
    customFieldValues: unknown;
    followUpCount: number;
    lastContactedAt: Date | null;
    convertedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): OfferLeadResponseDto {
    return {
      id: lead.id,
      campaignId: lead.campaignId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone ?? undefined,
      address: lead.address ?? undefined,
      notes: lead.notes ?? undefined,
      status: lead.status as LeadStatus,
      marketingConsentGranted: lead.marketingConsentGranted,
      customFieldValues: lead.customFieldValues as Record<string, string> | undefined,
      followUpCount: lead.followUpCount,
      lastContactedAt: lead.lastContactedAt ?? undefined,
      convertedAt: lead.convertedAt ?? undefined,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }
}
