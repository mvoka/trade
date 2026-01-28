import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { AuditService } from '../audit/audit.service';
import { ConsumerProfileService } from './consumer-profile.service';
import { FEATURE_FLAGS, AUDIT_ACTIONS, ERROR_CODES } from '@trades/shared';
import * as bcrypt from 'bcrypt';
import {
  RegisterHomeownerDto,
  UpdateConsumerProfileDto,
  HomeownerResponseDto,
  HomeownerSubscriptionsResponseDto,
  HomeownerJobsResponseDto,
  HomeownerJobsQueryDto,
} from './dto/homeowner.dto';

/**
 * HomeownerService - Manages homeowner/consumer operations
 *
 * This module is gated by HOMEOWNER_MARKETPLACE_ENABLED feature flag.
 * Admins can enable/disable per region.
 *
 * Provides:
 * - Homeowner registration (separate from SMB flow)
 * - Profile management
 * - Subscription listing
 * - Job history
 */
@Injectable()
export class HomeownerService {
  private readonly logger = new Logger(HomeownerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly auditService: AuditService,
    private readonly consumerProfileService: ConsumerProfileService,
  ) {}

  /**
   * Check if homeowner marketplace is enabled
   */
  async isMarketplaceEnabled(regionId?: string): Promise<boolean> {
    return this.featureFlagsService.isEnabled(
      FEATURE_FLAGS.HOMEOWNER_MARKETPLACE_ENABLED,
      { regionId },
    );
  }

  /**
   * Ensure marketplace is enabled, throw ForbiddenException if not
   */
  async ensureMarketplaceEnabled(regionId?: string): Promise<void> {
    const enabled = await this.isMarketplaceEnabled(regionId);
    if (!enabled) {
      throw new ForbiddenException({
        message: 'Homeowner marketplace is not enabled in this region',
        errorCode: ERROR_CODES.HOMEOWNER_MARKETPLACE_DISABLED,
      });
    }
  }

  /**
   * Register a new homeowner
   */
  async register(
    dto: RegisterHomeownerDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    user: HomeownerResponseDto;
    accessToken: string;
    refreshToken: string;
  }> {
    // Check if marketplace is enabled globally (region context not available at registration)
    await this.ensureMarketplaceEnabled();

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user and consumer profile in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user with CONSUMER type
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: 'SMB_USER', // Use SMB_USER role but CONSUMER type
          userType: 'CONSUMER',
          emailVerified: false,
        },
        include: {
          consumerProfile: true,
        },
      });

      // Create consumer profile
      const consumerProfile = await tx.consumerProfile.create({
        data: {
          userId: user.id,
          propertyType: dto.propertyType,
          propertyAddressLine1: dto.propertyAddressLine1,
          propertyAddressLine2: dto.propertyAddressLine2,
          propertyCity: dto.propertyCity,
          propertyProvince: dto.propertyProvince,
          propertyPostalCode: dto.propertyPostalCode,
          marketingOptIn: dto.marketingOptIn ?? false,
          marketingOptInAt: dto.marketingOptIn ? new Date() : null,
        },
      });

      return { user, consumerProfile };
    });

    // Audit log
    await this.auditService.log({
      action: AUDIT_ACTIONS.HOMEOWNER_REGISTERED,
      actorId: result.user.id,
      targetType: 'User',
      targetId: result.user.id,
      details: {
        email: result.user.email,
        marketingOptIn: dto.marketingOptIn ?? false,
      },
      ipAddress,
      userAgent,
    });

    this.logger.log(`Homeowner registered: ${result.user.email}`);

    // Generate tokens (stub - actual implementation would use AuthService)
    // P2: Integrate with AuthService for proper token generation
    const accessToken = `stub_access_token_${result.user.id}`;
    const refreshToken = `stub_refresh_token_${result.user.id}`;

    return {
      user: this.mapToHomeownerResponse(result.user, result.consumerProfile),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Get homeowner profile
   */
  async getProfile(userId: string): Promise<HomeownerResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        consumerProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.userType !== 'CONSUMER') {
      throw new ForbiddenException('User is not a consumer');
    }

    return this.mapToHomeownerResponse(user, user.consumerProfile);
  }

  /**
   * Update homeowner profile
   */
  async updateProfile(
    userId: string,
    dto: UpdateConsumerProfileDto,
  ): Promise<HomeownerResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        consumerProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.userType !== 'CONSUMER') {
      throw new ForbiddenException('User is not a consumer');
    }

    // Update user fields if provided
    const userUpdateData: Record<string, unknown> = {};
    if (dto.firstName !== undefined) userUpdateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) userUpdateData.lastName = dto.lastName;
    if (dto.phone !== undefined) userUpdateData.phone = dto.phone;

    if (Object.keys(userUpdateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }

    // Update consumer profile
    if (user.consumerProfile) {
      await this.consumerProfileService.updateProfile(userId, dto, userId);
    }

    // Fetch updated data
    return this.getProfile(userId);
  }

  /**
   * Get homeowner subscriptions
   */
  async getSubscriptions(userId: string): Promise<HomeownerSubscriptionsResponseDto> {
    // Check if subscriptions are enabled
    const subscriptionsEnabled = await this.featureFlagsService.isEnabled(
      FEATURE_FLAGS.SUBSCRIPTIONS_ENABLED,
    );

    if (!subscriptionsEnabled) {
      return { subscriptions: [], total: 0 };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        consumerProfile: {
          include: {
            subscriptions: {
              include: {
                servicePlan: true,
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!user || !user.consumerProfile) {
      return { subscriptions: [], total: 0 };
    }

    const subscriptions = user.consumerProfile.subscriptions.map((sub) => ({
      id: sub.id,
      planName: sub.servicePlan.name,
      status: sub.status,
      startDate: sub.startDate,
      nextBillingDate: sub.nextBillingDate ?? undefined,
      pricePerIntervalCents: sub.servicePlan.pricePerIntervalCents,
      billingInterval: sub.servicePlan.billingInterval,
    }));

    return {
      subscriptions,
      total: subscriptions.length,
    };
  }

  /**
   * Get homeowner jobs
   */
  async getJobs(
    userId: string,
    query: HomeownerJobsQueryDto,
  ): Promise<HomeownerJobsResponseDto> {
    const { status, page = 1, pageSize = 20 } = query;

    // Build where clause
    const where: Record<string, unknown> = {
      createdById: userId,
    };

    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * pageSize;

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          serviceCategory: {
            select: { name: true },
          },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        jobNumber: job.jobNumber,
        title: job.title ?? undefined,
        status: job.status,
        serviceCategory: job.serviceCategory.name,
        scheduledAt: job.scheduledAt ?? undefined,
        completedAt: job.completedAt ?? undefined,
        createdAt: job.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Map user and consumer profile to response
   */
  private mapToHomeownerResponse(
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      role: string;
      userType: string;
      emailVerified: boolean;
      isActive: boolean;
      createdAt: Date;
    },
    consumerProfile: {
      id: string;
      userId: string;
      propertyType: string | null;
      propertyAddressLine1: string | null;
      propertyAddressLine2: string | null;
      propertyCity: string | null;
      propertyProvince: string | null;
      propertyPostalCode: string | null;
      propertyCountry: string;
      propertyLat: number | null;
      propertyLng: number | null;
      marketingOptIn: boolean;
      marketingOptInAt: Date | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null,
  ): HomeownerResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      phone: user.phone ?? undefined,
      role: user.role,
      userType: user.userType,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
      consumerProfile: consumerProfile
        ? {
            id: consumerProfile.id,
            userId: consumerProfile.userId,
            propertyType: consumerProfile.propertyType ?? undefined,
            propertyAddressLine1: consumerProfile.propertyAddressLine1 ?? undefined,
            propertyAddressLine2: consumerProfile.propertyAddressLine2 ?? undefined,
            propertyCity: consumerProfile.propertyCity ?? undefined,
            propertyProvince: consumerProfile.propertyProvince ?? undefined,
            propertyPostalCode: consumerProfile.propertyPostalCode ?? undefined,
            propertyCountry: consumerProfile.propertyCountry,
            propertyLat: consumerProfile.propertyLat ?? undefined,
            propertyLng: consumerProfile.propertyLng ?? undefined,
            marketingOptIn: consumerProfile.marketingOptIn,
            marketingOptInAt: consumerProfile.marketingOptInAt ?? undefined,
            isActive: consumerProfile.isActive,
            createdAt: consumerProfile.createdAt,
            updatedAt: consumerProfile.updatedAt,
          }
        : undefined,
    };
  }
}
