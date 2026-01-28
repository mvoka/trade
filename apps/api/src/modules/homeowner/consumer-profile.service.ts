import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '@trades/shared';
import {
  UpdateConsumerProfileDto,
  ConsumerProfileResponseDto,
} from './dto/homeowner.dto';

/**
 * ConsumerProfileService - Manages consumer/homeowner profiles
 *
 * Provides:
 * - Profile CRUD operations
 * - Marketing opt-in management
 * - Property information management
 */
@Injectable()
export class ConsumerProfileService {
  private readonly logger = new Logger(ConsumerProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a consumer profile for a user
   */
  async createProfile(
    userId: string,
    data: {
      propertyType?: string;
      propertyAddressLine1?: string;
      propertyAddressLine2?: string;
      propertyCity?: string;
      propertyProvince?: string;
      propertyPostalCode?: string;
      propertyLat?: number;
      propertyLng?: number;
      marketingOptIn?: boolean;
    },
  ): Promise<ConsumerProfileResponseDto> {
    // Check if profile already exists
    const existing = await this.prisma.consumerProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('Consumer profile already exists for this user');
    }

    const profile = await this.prisma.consumerProfile.create({
      data: {
        userId,
        propertyType: data.propertyType,
        propertyAddressLine1: data.propertyAddressLine1,
        propertyAddressLine2: data.propertyAddressLine2,
        propertyCity: data.propertyCity,
        propertyProvince: data.propertyProvince,
        propertyPostalCode: data.propertyPostalCode,
        propertyLat: data.propertyLat,
        propertyLng: data.propertyLng,
        marketingOptIn: data.marketingOptIn ?? false,
        marketingOptInAt: data.marketingOptIn ? new Date() : null,
      },
    });

    this.logger.log(`Consumer profile created for user: ${userId}`);

    return this.mapToResponse(profile);
  }

  /**
   * Get consumer profile by user ID
   */
  async getProfileByUserId(userId: string): Promise<ConsumerProfileResponseDto> {
    const profile = await this.prisma.consumerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Consumer profile not found');
    }

    return this.mapToResponse(profile);
  }

  /**
   * Get consumer profile by ID
   */
  async getProfileById(id: string): Promise<ConsumerProfileResponseDto> {
    const profile = await this.prisma.consumerProfile.findUnique({
      where: { id },
    });

    if (!profile) {
      throw new NotFoundException('Consumer profile not found');
    }

    return this.mapToResponse(profile);
  }

  /**
   * Update consumer profile
   */
  async updateProfile(
    userId: string,
    dto: UpdateConsumerProfileDto,
    actorId?: string,
  ): Promise<ConsumerProfileResponseDto> {
    const existing = await this.prisma.consumerProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Consumer profile not found');
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (dto.propertyType !== undefined) {
      updateData.propertyType = dto.propertyType;
    }

    if (dto.propertyAddressLine1 !== undefined) {
      updateData.propertyAddressLine1 = dto.propertyAddressLine1;
    }

    if (dto.propertyAddressLine2 !== undefined) {
      updateData.propertyAddressLine2 = dto.propertyAddressLine2;
    }

    if (dto.propertyCity !== undefined) {
      updateData.propertyCity = dto.propertyCity;
    }

    if (dto.propertyProvince !== undefined) {
      updateData.propertyProvince = dto.propertyProvince;
    }

    if (dto.propertyPostalCode !== undefined) {
      updateData.propertyPostalCode = dto.propertyPostalCode;
    }

    if (dto.propertyLat !== undefined) {
      updateData.propertyLat = dto.propertyLat;
    }

    if (dto.propertyLng !== undefined) {
      updateData.propertyLng = dto.propertyLng;
    }

    // Handle marketing opt-in change
    if (dto.marketingOptIn !== undefined && dto.marketingOptIn !== existing.marketingOptIn) {
      updateData.marketingOptIn = dto.marketingOptIn;
      updateData.marketingOptInAt = dto.marketingOptIn ? new Date() : null;
    }

    const profile = await this.prisma.consumerProfile.update({
      where: { userId },
      data: updateData,
    });

    // Audit log
    await this.auditService.log({
      action: AUDIT_ACTIONS.HOMEOWNER_PROFILE_UPDATED,
      actorId: actorId ?? userId,
      targetType: 'ConsumerProfile',
      targetId: profile.id,
      details: { updatedFields: Object.keys(updateData) },
    });

    this.logger.log(`Consumer profile updated for user: ${userId}`);

    return this.mapToResponse(profile);
  }

  /**
   * Update marketing opt-in status
   */
  async updateMarketingOptIn(
    userId: string,
    optIn: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ConsumerProfileResponseDto> {
    const existing = await this.prisma.consumerProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Consumer profile not found');
    }

    const profile = await this.prisma.consumerProfile.update({
      where: { userId },
      data: {
        marketingOptIn: optIn,
        marketingOptInAt: optIn ? new Date() : null,
      },
    });

    // Audit log with consent details
    await this.auditService.log({
      action: optIn ? 'MARKETING_OPT_IN' : 'MARKETING_OPT_OUT',
      actorId: userId,
      targetType: 'ConsumerProfile',
      targetId: profile.id,
      details: { optIn },
      ipAddress,
      userAgent,
    });

    this.logger.log(`Marketing opt-${optIn ? 'in' : 'out'} for user: ${userId}`);

    return this.mapToResponse(profile);
  }

  /**
   * Check if user has a consumer profile
   */
  async hasProfile(userId: string): Promise<boolean> {
    const profile = await this.prisma.consumerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    return !!profile;
  }

  /**
   * Map database entity to response DTO
   */
  private mapToResponse(profile: {
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
  }): ConsumerProfileResponseDto {
    return {
      id: profile.id,
      userId: profile.userId,
      propertyType: profile.propertyType ?? undefined,
      propertyAddressLine1: profile.propertyAddressLine1 ?? undefined,
      propertyAddressLine2: profile.propertyAddressLine2 ?? undefined,
      propertyCity: profile.propertyCity ?? undefined,
      propertyProvince: profile.propertyProvince ?? undefined,
      propertyPostalCode: profile.propertyPostalCode ?? undefined,
      propertyCountry: profile.propertyCountry,
      propertyLat: profile.propertyLat ?? undefined,
      propertyLng: profile.propertyLng ?? undefined,
      marketingOptIn: profile.marketingOptIn,
      marketingOptInAt: profile.marketingOptInAt ?? undefined,
      isActive: profile.isActive,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
