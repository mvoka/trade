import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PolicyService } from '../feature-flags/policy.service';
import { AuditService } from '../audit/audit.service';
import { FEATURE_FLAGS, POLICY_KEYS, AUDIT_ACTIONS, ERROR_CODES } from '@trades/shared';
import {
  CreatePortfolioDto,
  UpdatePortfolioSettingsDto,
  AddPortfolioItemFromJobDto,
  PortfolioResponseDto,
  PublicPortfolioResponseDto,
  PortfolioStatsResponseDto,
  PortfolioTheme,
} from './dto/portfolio.dto';

/**
 * PortfolioService - Manages pro portfolios
 *
 * Feature Flag: PRO_PORTFOLIO_ENABLED
 *
 * Provides:
 * - Portfolio CRUD operations
 * - Public portfolio pages
 * - Portfolio item management
 * - Customer opt-in tracking
 */
@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Check if portfolio feature is enabled
   */
  private async checkFeatureEnabled(): Promise<void> {
    const enabled = await this.featureFlagsService.isEnabled(FEATURE_FLAGS.PRO_PORTFOLIO_ENABLED, {});
    if (!enabled) {
      throw new ForbiddenException(ERROR_CODES.PORTFOLIO_NOT_ENABLED);
    }
  }

  /**
   * Get or create portfolio for a pro profile
   */
  async getOrCreatePortfolio(proProfileId: string, userId: string): Promise<PortfolioResponseDto> {
    await this.checkFeatureEnabled();

    // Verify user owns the pro profile
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile || proProfile.userId !== userId) {
      throw new ForbiddenException('Access denied to this pro profile');
    }

    let portfolio = await this.prisma.proPortfolio.findUnique({
      where: { proProfileId },
    });

    if (!portfolio) {
      // Auto-create portfolio with default slug
      const baseSlug = this.generateSlug(proProfile.businessName ?? `pro-${proProfile.id.slice(0, 8)}`);
      const uniqueSlug = await this.ensureUniqueSlug(baseSlug);

      portfolio = await this.prisma.proPortfolio.create({
        data: {
          proProfileId,
          slug: uniqueSlug,
          theme: 'DEFAULT',
          isPublished: false,
          showReviews: true,
          viewCount: 0,
        },
      });

      await this.auditService.log({
        action: AUDIT_ACTIONS.PORTFOLIO_CREATED,
        actorId: userId,
        targetType: 'ProPortfolio',
        targetId: portfolio.id,
      });

      this.logger.log(`Portfolio created for pro profile: ${proProfileId}`);
    }

    return this.mapToResponse(portfolio);
  }

  /**
   * Update portfolio settings
   */
  async updateSettings(
    proProfileId: string,
    userId: string,
    dto: UpdatePortfolioSettingsDto,
  ): Promise<PortfolioResponseDto> {
    await this.checkFeatureEnabled();

    const portfolio = await this.getPortfolioForUser(proProfileId, userId);

    // If slug is being changed, ensure uniqueness
    if (dto.slug && dto.slug !== portfolio.slug) {
      const existing = await this.prisma.proPortfolio.findUnique({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new BadRequestException('Slug is already taken');
      }
    }

    const updated = await this.prisma.proPortfolio.update({
      where: { id: portfolio.id },
      data: {
        slug: dto.slug,
        headline: dto.headline,
        bio: dto.bio,
        displayEmail: dto.displayEmail,
        displayPhone: dto.displayPhone,
        showReviews: dto.showReviews,
        theme: dto.theme,
        socialLinks: dto.socialLinks ?? undefined,
      },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.PORTFOLIO_SETTINGS_UPDATED,
      actorId: userId,
      targetType: 'ProPortfolio',
      targetId: portfolio.id,
      details: { changes: dto },
    });

    this.logger.log(`Portfolio settings updated: ${portfolio.id}`);

    return this.mapToResponse(updated);
  }

  /**
   * Publish portfolio
   */
  async publishPortfolio(proProfileId: string, userId: string): Promise<PortfolioResponseDto> {
    await this.checkFeatureEnabled();

    const portfolio = await this.getPortfolioForUser(proProfileId, userId);

    if (portfolio.isPublished) {
      throw new BadRequestException('Portfolio is already published');
    }

    // Check if there are any public items
    const publicItemCount = await this.prisma.portfolioItem.count({
      where: {
        proProfileId,
        visibility: 'PUBLIC',
        optInGranted: true,
      },
    });

    if (publicItemCount === 0) {
      throw new BadRequestException('Cannot publish portfolio without any public items with customer opt-in');
    }

    const updated = await this.prisma.proPortfolio.update({
      where: { id: portfolio.id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.PORTFOLIO_PUBLISHED,
      actorId: userId,
      targetType: 'ProPortfolio',
      targetId: portfolio.id,
    });

    this.logger.log(`Portfolio published: ${portfolio.id}`);

    return this.mapToResponse(updated);
  }

  /**
   * Unpublish portfolio
   */
  async unpublishPortfolio(proProfileId: string, userId: string): Promise<PortfolioResponseDto> {
    await this.checkFeatureEnabled();

    const portfolio = await this.getPortfolioForUser(proProfileId, userId);

    if (!portfolio.isPublished) {
      throw new BadRequestException('Portfolio is not published');
    }

    const updated = await this.prisma.proPortfolio.update({
      where: { id: portfolio.id },
      data: {
        isPublished: false,
      },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.PORTFOLIO_UNPUBLISHED,
      actorId: userId,
      targetType: 'ProPortfolio',
      targetId: portfolio.id,
    });

    this.logger.log(`Portfolio unpublished: ${portfolio.id}`);

    return this.mapToResponse(updated);
  }

  /**
   * Get public portfolio by slug (no auth required)
   */
  async getPublicPortfolio(slug: string): Promise<PublicPortfolioResponseDto> {
    await this.checkFeatureEnabled();

    const portfolio = await this.prisma.proPortfolio.findUnique({
      where: { slug },
      include: {
        proProfile: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            serviceCategories: true,
          },
        },
      },
    });

    if (!portfolio || !portfolio.isPublished) {
      throw new NotFoundException('Portfolio not found');
    }

    // Get portfolio items
    const items = await this.prisma.portfolioItem.findMany({
      where: {
        proProfileId: portfolio.proProfileId,
        visibility: 'PUBLIC',
        optInGranted: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Get reviews if enabled
    let reviews: Array<{
      id: string;
      rating: number;
      comment: string | null;
      reviewerName: string;
      createdAt: Date;
    }> = [];
    let averageRating: number | undefined;
    let totalReviews = 0;

    if (portfolio.showReviews) {
      const reviewData = await this.prisma.review.findMany({
        where: {
          proProfileId: portfolio.proProfileId,
          isPublic: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          job: {
            select: {
              contactName: true,
            },
          },
        },
      });

      reviews = reviewData.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reviewerName: r.job?.contactName ?? 'Anonymous',
        createdAt: r.createdAt,
      }));

      // Calculate average rating
      const ratingStats = await this.prisma.review.aggregate({
        where: {
          proProfileId: portfolio.proProfileId,
          isPublic: true,
        },
        _avg: { rating: true },
        _count: true,
      });

      averageRating = ratingStats._avg.rating ?? undefined;
      totalReviews = ratingStats._count;
    }

    // Increment view count
    await this.prisma.proPortfolio.update({
      where: { id: portfolio.id },
      data: { viewCount: { increment: 1 } },
    });

    return {
      slug: portfolio.slug,
      theme: portfolio.theme as PortfolioTheme,
      headline: portfolio.headline ?? undefined,
      bio: portfolio.bio ?? undefined,
      displayEmail: portfolio.displayEmail ?? undefined,
      displayPhone: portfolio.displayPhone ?? undefined,
      showReviews: portfolio.showReviews,
      socialLinks: portfolio.socialLinks as Record<string, string> | undefined,
      proProfile: {
        businessName: portfolio.proProfile.businessName ?? undefined,
        avatarUrl: portfolio.proProfile.avatarUrl ?? undefined,
        verificationBadge: portfolio.proProfile.verificationBadge ?? undefined,
        serviceCategories: portfolio.proProfile.serviceCategories.map((sc) => sc.name),
        averageRating,
        totalReviews,
      },
      items: items.map((item) => ({
        id: item.id,
        title: item.title ?? undefined,
        description: item.description ?? undefined,
        mediaUrl: item.mediaUrl,
        mediaType: item.mediaType ?? undefined,
        sortOrder: item.sortOrder,
        serviceCategory: undefined, // Could be added if linked to job
        createdAt: item.createdAt,
      })),
      reviews: portfolio.showReviews
        ? reviews.map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment ?? undefined,
            reviewerName: r.reviewerName,
            createdAt: r.createdAt,
          }))
        : undefined,
    };
  }

  /**
   * Get portfolio stats
   */
  async getPortfolioStats(proProfileId: string, userId: string): Promise<PortfolioStatsResponseDto> {
    await this.checkFeatureEnabled();

    const portfolio = await this.getPortfolioForUser(proProfileId, userId);

    const [totalItems, publishedItems, pendingOptIns] = await Promise.all([
      this.prisma.portfolioItem.count({ where: { proProfileId } }),
      this.prisma.portfolioItem.count({
        where: { proProfileId, visibility: 'PUBLIC', optInGranted: true },
      }),
      this.prisma.portfolioItem.count({
        where: { proProfileId, visibility: 'PUBLIC', optInGranted: false },
      }),
    ]);

    return {
      totalViews: portfolio.viewCount,
      totalItems,
      publishedItems,
      pendingOptIns,
      isPublished: portfolio.isPublished,
      lastViewedAt: undefined, // Could add tracking for this
    };
  }

  /**
   * Add item to portfolio from completed job
   */
  async addItemFromJob(
    proProfileId: string,
    userId: string,
    dto: AddPortfolioItemFromJobDto,
  ): Promise<void> {
    await this.checkFeatureEnabled();

    // Verify user owns the pro profile
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile || proProfile.userId !== userId) {
      throw new ForbiddenException('Access denied to this pro profile');
    }

    // Check if opt-in is required
    const requireOptIn = await this.policyService.getValue<boolean>(
      POLICY_KEYS.PORTFOLIO_REQUIRE_OPT_IN,
      {},
    ) ?? true;

    // Verify job exists and belongs to this pro
    const job = await this.prisma.job.findFirst({
      where: {
        id: dto.jobId,
        assignedProId: proProfileId,
        status: 'COMPLETED',
      },
      include: {
        attachments: {
          where: {
            type: 'AFTER_PHOTO',
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Completed job not found or access denied');
    }

    // Get photo URLs to add
    let photoUrls = dto.photoUrls;
    if (!photoUrls || photoUrls.length === 0) {
      // Use all after photos from the job
      photoUrls = job.attachments.map((a) => a.fileUrl);
    }

    if (photoUrls.length === 0) {
      throw new BadRequestException('No photos available from this job');
    }

    // Get next sort order
    const maxSortOrder = await this.prisma.portfolioItem.aggregate({
      where: { proProfileId },
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1;

    // Create portfolio items
    for (let i = 0; i < photoUrls.length; i++) {
      await this.prisma.portfolioItem.create({
        data: {
          proProfileId,
          jobId: dto.jobId,
          title: dto.title,
          description: dto.description,
          mediaUrl: photoUrls[i],
          mediaType: 'image',
          visibility: 'PUBLIC',
          optInGranted: requireOptIn ? dto.customerOptIn : true,
          sortOrder: nextSortOrder + i,
        },
      });
    }

    await this.auditService.log({
      action: AUDIT_ACTIONS.PORTFOLIO_ITEM_ADDED,
      actorId: userId,
      targetType: 'ProPortfolio',
      targetId: proProfileId,
      details: {
        jobId: dto.jobId,
        itemCount: photoUrls.length,
        optInGranted: dto.customerOptIn,
      },
    });

    this.logger.log(`Added ${photoUrls.length} items from job ${dto.jobId} to portfolio`);
  }

  /**
   * Check slug availability
   */
  async checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
    const existing = await this.prisma.proPortfolio.findUnique({
      where: { slug },
      select: { id: true },
    });
    return { available: !existing };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async getPortfolioForUser(
    proProfileId: string,
    userId: string,
  ): Promise<{
    id: string;
    slug: string;
    isPublished: boolean;
    viewCount: number;
    showReviews: boolean;
  }> {
    // Verify user owns the pro profile
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile || proProfile.userId !== userId) {
      throw new ForbiddenException('Access denied to this pro profile');
    }

    const portfolio = await this.prisma.proPortfolio.findUnique({
      where: { proProfileId },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found. Create one first.');
    }

    return portfolio;
  }

  private generateSlug(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
  }

  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.proPortfolio.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;

      if (counter > 100) {
        throw new Error('Unable to generate unique slug');
      }
    }
  }

  private mapToResponse(portfolio: {
    id: string;
    proProfileId: string;
    slug: string;
    theme: string;
    isPublished: boolean;
    headline: string | null;
    bio: string | null;
    displayEmail: string | null;
    displayPhone: string | null;
    showReviews: boolean;
    socialLinks: unknown;
    viewCount: number;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PortfolioResponseDto {
    return {
      id: portfolio.id,
      proProfileId: portfolio.proProfileId,
      slug: portfolio.slug,
      theme: portfolio.theme as PortfolioTheme,
      isPublished: portfolio.isPublished,
      headline: portfolio.headline ?? undefined,
      bio: portfolio.bio ?? undefined,
      displayEmail: portfolio.displayEmail ?? undefined,
      displayPhone: portfolio.displayPhone ?? undefined,
      showReviews: portfolio.showReviews,
      socialLinks: portfolio.socialLinks as Record<string, string> | undefined,
      viewCount: portfolio.viewCount,
      publishedAt: portfolio.publishedAt ?? undefined,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    };
  }
}
