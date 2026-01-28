import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { AuditService } from '../audit/audit.service';
import { FEATURE_FLAGS, AUDIT_ACTIONS, ERROR_CODES } from '@trades/shared';
import {
  CreateOfferCampaignDto,
  UpdateOfferCampaignDto,
  OfferCampaignResponseDto,
  OfferCampaignsListResponseDto,
  PublicOfferResponseDto,
  OfferStatsResponseDto,
  OffersQueryDto,
  OfferStatus,
  OfferType,
} from './dto/offers.dto';

/**
 * OffersService - Manages offer campaigns
 *
 * Feature Flag: OFFER_CAMPAIGNS_ENABLED
 *
 * Provides:
 * - Campaign CRUD operations
 * - Public offer pages
 * - Campaign statistics
 */
@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
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
   * Create a new offer campaign
   */
  async createCampaign(
    dto: CreateOfferCampaignDto,
    actorId: string,
  ): Promise<OfferCampaignResponseDto> {
    await this.checkFeatureEnabled();

    // Check slug uniqueness
    const existing = await this.prisma.offerCampaign.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('Slug is already taken');
    }

    const campaign = await this.prisma.offerCampaign.create({
      data: {
        slug: dto.slug,
        headline: dto.headline,
        subheadline: dto.subheadline,
        offerType: dto.offerType,
        discountValue: dto.discountValue,
        status: 'DRAFT',
        serviceCategoryId: dto.serviceCategoryId,
        regionId: dto.regionId,
        heroImageUrl: dto.heroImageUrl,
        termsText: dto.termsText,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        requiresMarketingConsent: dto.requiresMarketingConsent,
        customFields: dto.customFields ?? [],
      },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.OFFER_CAMPAIGN_CREATED,
      actorId,
      targetType: 'OfferCampaign',
      targetId: campaign.id,
      details: { slug: dto.slug },
    });

    this.logger.log(`Offer campaign created: ${campaign.id}`);

    return this.mapToResponse(campaign, 0, 0);
  }

  /**
   * Update an offer campaign
   */
  async updateCampaign(
    id: string,
    dto: UpdateOfferCampaignDto,
    actorId: string,
  ): Promise<OfferCampaignResponseDto> {
    await this.checkFeatureEnabled();

    const campaign = await this.prisma.offerCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // If slug is being changed, check uniqueness
    if (dto.slug && dto.slug !== campaign.slug) {
      const existing = await this.prisma.offerCampaign.findUnique({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new BadRequestException('Slug is already taken');
      }
    }

    const updated = await this.prisma.offerCampaign.update({
      where: { id },
      data: {
        slug: dto.slug,
        headline: dto.headline,
        subheadline: dto.subheadline,
        status: dto.status,
        discountValue: dto.discountValue,
        heroImageUrl: dto.heroImageUrl,
        termsText: dto.termsText,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.OFFER_CAMPAIGN_UPDATED,
      actorId,
      targetType: 'OfferCampaign',
      targetId: id,
      details: { changes: dto },
    });

    this.logger.log(`Offer campaign updated: ${id}`);

    const stats = await this.getCampaignStats(id);

    return this.mapToResponse(updated, stats.totalLeads, stats.convertedLeads);
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(id: string): Promise<OfferCampaignResponseDto> {
    await this.checkFeatureEnabled();

    const campaign = await this.prisma.offerCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const stats = await this.getCampaignStats(id);

    return this.mapToResponse(campaign, stats.totalLeads, stats.convertedLeads);
  }

  /**
   * List campaigns with filters
   */
  async listCampaigns(query: OffersQueryDto): Promise<OfferCampaignsListResponseDto> {
    await this.checkFeatureEnabled();

    const { status, serviceCategoryId, regionId, page = 1, pageSize = 20 } = query;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (serviceCategoryId) {
      where.serviceCategoryId = serviceCategoryId;
    }

    if (regionId) {
      where.regionId = regionId;
    }

    const skip = (page - 1) * pageSize;

    const [campaigns, total] = await Promise.all([
      this.prisma.offerCampaign.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.offerCampaign.count({ where }),
    ]);

    // Get stats for each campaign
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const stats = await this.getCampaignStats(campaign.id);
        return this.mapToResponse(campaign, stats.totalLeads, stats.convertedLeads);
      }),
    );

    const totalPages = Math.ceil(total / pageSize);

    return {
      campaigns: campaignsWithStats,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get public offer by slug (no auth)
   */
  async getPublicOffer(slug: string): Promise<PublicOfferResponseDto> {
    await this.checkFeatureEnabled();

    const campaign = await this.prisma.offerCampaign.findUnique({
      where: { slug },
      include: {
        serviceCategory: true,
      },
    });

    if (!campaign || campaign.status !== 'ACTIVE') {
      throw new NotFoundException('Offer not found');
    }

    // Check if expired
    if (campaign.expiresAt && campaign.expiresAt < new Date()) {
      throw new NotFoundException('Offer has expired');
    }

    return {
      slug: campaign.slug,
      headline: campaign.headline,
      subheadline: campaign.subheadline ?? undefined,
      offerType: campaign.offerType as OfferType,
      discountValue: campaign.discountValue ?? undefined,
      heroImageUrl: campaign.heroImageUrl ?? undefined,
      termsText: campaign.termsText ?? undefined,
      expiresAt: campaign.expiresAt ?? undefined,
      requiresMarketingConsent: campaign.requiresMarketingConsent,
      customFields: campaign.customFields as string[] | undefined,
      serviceCategory: campaign.serviceCategory
        ? {
            id: campaign.serviceCategory.id,
            name: campaign.serviceCategory.name,
            code: campaign.serviceCategory.code,
          }
        : undefined,
    };
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<OfferStatsResponseDto> {
    const [total, byStatus, withConsent] = await Promise.all([
      this.prisma.offerLead.count({ where: { campaignId } }),
      this.prisma.offerLead.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: true,
      }),
      this.prisma.offerLead.count({
        where: { campaignId, marketingConsentGranted: true },
      }),
    ]);

    const statusCounts = byStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const convertedLeads = statusCounts['CONVERTED'] ?? 0;
    const conversionRate = total > 0 ? (convertedLeads / total) * 100 : 0;

    return {
      totalLeads: total,
      newLeads: statusCounts['NEW'] ?? 0,
      contactedLeads: statusCounts['CONTACTED'] ?? 0,
      qualifiedLeads: statusCounts['QUALIFIED'] ?? 0,
      convertedLeads,
      conversionRate: Math.round(conversionRate * 100) / 100,
      leadsWithConsent: withConsent,
    };
  }

  /**
   * Activate a campaign
   */
  async activateCampaign(id: string, actorId: string): Promise<OfferCampaignResponseDto> {
    await this.checkFeatureEnabled();

    const campaign = await this.prisma.offerCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status === 'ACTIVE') {
      throw new BadRequestException('Campaign is already active');
    }

    const updated = await this.prisma.offerCampaign.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.OFFER_CAMPAIGN_ACTIVATED,
      actorId,
      targetType: 'OfferCampaign',
      targetId: id,
    });

    this.logger.log(`Offer campaign activated: ${id}`);

    const stats = await this.getCampaignStats(id);

    return this.mapToResponse(updated, stats.totalLeads, stats.convertedLeads);
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(id: string, actorId: string): Promise<OfferCampaignResponseDto> {
    await this.checkFeatureEnabled();

    const campaign = await this.prisma.offerCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status !== 'ACTIVE') {
      throw new BadRequestException('Can only pause active campaigns');
    }

    const updated = await this.prisma.offerCampaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.OFFER_CAMPAIGN_PAUSED,
      actorId,
      targetType: 'OfferCampaign',
      targetId: id,
    });

    this.logger.log(`Offer campaign paused: ${id}`);

    const stats = await this.getCampaignStats(id);

    return this.mapToResponse(updated, stats.totalLeads, stats.convertedLeads);
  }

  /**
   * Archive a campaign
   */
  async archiveCampaign(id: string, actorId: string): Promise<OfferCampaignResponseDto> {
    await this.checkFeatureEnabled();

    const campaign = await this.prisma.offerCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const updated = await this.prisma.offerCampaign.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.OFFER_CAMPAIGN_ARCHIVED,
      actorId,
      targetType: 'OfferCampaign',
      targetId: id,
    });

    this.logger.log(`Offer campaign archived: ${id}`);

    const stats = await this.getCampaignStats(id);

    return this.mapToResponse(updated, stats.totalLeads, stats.convertedLeads);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToResponse(
    campaign: {
      id: string;
      slug: string;
      headline: string;
      subheadline: string | null;
      offerType: string;
      discountValue: number | null;
      status: string;
      serviceCategoryId: string | null;
      regionId: string | null;
      heroImageUrl: string | null;
      termsText: string | null;
      expiresAt: Date | null;
      requiresMarketingConsent: boolean;
      customFields: unknown;
      createdAt: Date;
      updatedAt: Date;
    },
    leadCount: number,
    conversionCount: number,
  ): OfferCampaignResponseDto {
    return {
      id: campaign.id,
      slug: campaign.slug,
      headline: campaign.headline,
      subheadline: campaign.subheadline ?? undefined,
      offerType: campaign.offerType as OfferType,
      discountValue: campaign.discountValue ?? undefined,
      status: campaign.status as OfferStatus,
      serviceCategoryId: campaign.serviceCategoryId ?? undefined,
      regionId: campaign.regionId ?? undefined,
      heroImageUrl: campaign.heroImageUrl ?? undefined,
      termsText: campaign.termsText ?? undefined,
      expiresAt: campaign.expiresAt ?? undefined,
      requiresMarketingConsent: campaign.requiresMarketingConsent,
      customFields: campaign.customFields as string[] | undefined,
      leadCount,
      conversionCount,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }
}
