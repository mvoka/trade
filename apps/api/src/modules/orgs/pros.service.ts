import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { calculateDistance, calculateProRankingScore } from '@trades/shared';
import {
  CreateProProfileDto,
  UpdateProProfileDto,
  ServiceAreaDto,
  ServiceHoursItemDto,
  ProProfileResponseDto,
  ProProfileWithDistanceResponseDto,
} from './dto/pros.dto';

@Injectable()
export class ProsService {
  private readonly logger = new Logger(ProsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new pro profile for a user
   */
  async createProProfile(
    userId: string,
    dto: CreateProProfileDto,
  ): Promise<ProProfileResponseDto> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if pro profile already exists
    const existingProfile = await this.prisma.proProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException('Pro profile already exists for this user');
    }

    // Validate org if provided
    if (dto.orgId) {
      const org = await this.prisma.org.findUnique({
        where: { id: dto.orgId },
      });
      if (!org) {
        throw new NotFoundException(`Organization with ID ${dto.orgId} not found`);
      }
    }

    // Validate region if provided
    if (dto.regionId) {
      const region = await this.prisma.region.findUnique({
        where: { id: dto.regionId },
      });
      if (!region) {
        throw new NotFoundException(`Region with ID ${dto.regionId} not found`);
      }
    }

    // Validate service categories if provided
    if (dto.serviceCategoryIds && dto.serviceCategoryIds.length > 0) {
      const categories = await this.prisma.serviceCategory.findMany({
        where: { id: { in: dto.serviceCategoryIds } },
      });
      if (categories.length !== dto.serviceCategoryIds.length) {
        throw new BadRequestException('One or more service categories not found');
      }
    }

    // Create pro profile with all related data in a transaction
    const proProfile = await this.prisma.$transaction(async (tx) => {
      // Create the pro profile
      const profile = await tx.proProfile.create({
        data: {
          userId,
          orgId: dto.orgId,
          regionId: dto.regionId,
          businessName: dto.businessName,
          businessPhone: dto.businessPhone,
          businessEmail: dto.businessEmail || user.email,
          bio: dto.bio,
          yearsExperience: dto.yearsExperience,
          serviceCategories:
            dto.serviceCategoryIds && dto.serviceCategoryIds.length > 0
              ? {
                  connect: dto.serviceCategoryIds.map((id) => ({ id })),
                }
              : undefined,
        },
      });

      // Create service area if provided
      if (dto.serviceArea) {
        await tx.serviceArea.create({
          data: {
            proProfileId: profile.id,
            centerLat: dto.serviceArea.centerLat,
            centerLng: dto.serviceArea.centerLng,
            radiusKm: dto.serviceArea.radiusKm,
          },
        });
      }

      // Create service hours if provided
      if (dto.serviceHours && dto.serviceHours.length > 0) {
        await tx.serviceHours.createMany({
          data: dto.serviceHours.map((h) => ({
            proProfileId: profile.id,
            dayOfWeek: h.dayOfWeek as any,
            startTime: h.startTime,
            endTime: h.endTime,
            isActive: h.isActive ?? true,
          })),
        });
      }

      return profile;
    });

    this.logger.log(`Pro profile created: ${proProfile.id} for user: ${userId}`);

    // Fetch and return the full profile
    return this.getProProfile(userId);
  }

  /**
   * Get pro profile by user ID
   */
  async getProProfile(userId: string): Promise<ProProfileResponseDto> {
    const profile = await this.prisma.proProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        serviceArea: true,
        serviceHours: {
          where: { isActive: true },
          orderBy: { dayOfWeek: 'asc' },
        },
        serviceCategories: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Pro profile not found for user ${userId}`);
    }

    return this.formatProProfileResponse(profile);
  }

  /**
   * Get pro profile by profile ID
   */
  async getProProfileById(profileId: string): Promise<ProProfileResponseDto> {
    const profile = await this.prisma.proProfile.findUnique({
      where: { id: profileId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        serviceArea: true,
        serviceHours: {
          where: { isActive: true },
          orderBy: { dayOfWeek: 'asc' },
        },
        serviceCategories: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Pro profile not found with ID ${profileId}`);
    }

    return this.formatProProfileResponse(profile);
  }

  /**
   * Update pro profile
   */
  async updateProProfile(
    userId: string,
    dto: UpdateProProfileDto,
  ): Promise<ProProfileResponseDto> {
    // Check if profile exists
    const existingProfile = await this.prisma.proProfile.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      throw new NotFoundException(`Pro profile not found for user ${userId}`);
    }

    // Validate org if provided
    if (dto.orgId) {
      const org = await this.prisma.org.findUnique({
        where: { id: dto.orgId },
      });
      if (!org) {
        throw new NotFoundException(`Organization with ID ${dto.orgId} not found`);
      }
    }

    // Validate region if provided
    if (dto.regionId) {
      const region = await this.prisma.region.findUnique({
        where: { id: dto.regionId },
      });
      if (!region) {
        throw new NotFoundException(`Region with ID ${dto.regionId} not found`);
      }
    }

    // Validate service categories if provided
    if (dto.serviceCategoryIds && dto.serviceCategoryIds.length > 0) {
      const categories = await this.prisma.serviceCategory.findMany({
        where: { id: { in: dto.serviceCategoryIds } },
      });
      if (categories.length !== dto.serviceCategoryIds.length) {
        throw new BadRequestException('One or more service categories not found');
      }
    }

    // Update pro profile
    await this.prisma.proProfile.update({
      where: { userId },
      data: {
        orgId: dto.orgId,
        regionId: dto.regionId,
        businessName: dto.businessName,
        businessPhone: dto.businessPhone,
        businessEmail: dto.businessEmail,
        bio: dto.bio,
        yearsExperience: dto.yearsExperience,
        isActive: dto.isActive,
        serviceCategories:
          dto.serviceCategoryIds !== undefined
            ? {
                set: dto.serviceCategoryIds.map((id) => ({ id })),
              }
            : undefined,
      },
    });

    this.logger.log(`Pro profile updated for user: ${userId}`);

    return this.getProProfile(userId);
  }

  /**
   * Update service area
   */
  async updateServiceArea(
    proProfileId: string,
    dto: ServiceAreaDto,
  ): Promise<ProProfileResponseDto> {
    // Check if profile exists
    const profile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!profile) {
      throw new NotFoundException(`Pro profile not found with ID ${proProfileId}`);
    }

    // Upsert service area
    await this.prisma.serviceArea.upsert({
      where: { proProfileId },
      create: {
        proProfileId,
        centerLat: dto.centerLat,
        centerLng: dto.centerLng,
        radiusKm: dto.radiusKm,
      },
      update: {
        centerLat: dto.centerLat,
        centerLng: dto.centerLng,
        radiusKm: dto.radiusKm,
      },
    });

    this.logger.log(`Service area updated for profile: ${proProfileId}`);

    return this.getProProfileById(proProfileId);
  }

  /**
   * Update service hours
   */
  async updateServiceHours(
    proProfileId: string,
    hours: ServiceHoursItemDto[],
  ): Promise<ProProfileResponseDto> {
    // Check if profile exists
    const profile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!profile) {
      throw new NotFoundException(`Pro profile not found with ID ${proProfileId}`);
    }

    // Delete existing service hours and create new ones
    await this.prisma.$transaction(async (tx) => {
      await tx.serviceHours.deleteMany({
        where: { proProfileId },
      });

      if (hours.length > 0) {
        await tx.serviceHours.createMany({
          data: hours.map((h) => ({
            proProfileId,
            dayOfWeek: h.dayOfWeek as any,
            startTime: h.startTime,
            endTime: h.endTime,
            isActive: h.isActive ?? true,
          })),
        });
      }
    });

    this.logger.log(`Service hours updated for profile: ${proProfileId}`);

    return this.getProProfileById(proProfileId);
  }

  /**
   * Get pros by service category
   */
  async getProsByCategory(
    categoryId: string,
    onlyVerified = true,
  ): Promise<ProProfileResponseDto[]> {
    // Validate category exists
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Service category with ID ${categoryId} not found`);
    }

    const profiles = await this.prisma.proProfile.findMany({
      where: {
        serviceCategories: {
          some: { id: categoryId },
        },
        isActive: true,
        ...(onlyVerified ? { verificationStatus: 'APPROVED' } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        serviceArea: true,
        serviceHours: {
          where: { isActive: true },
        },
        serviceCategories: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return profiles.map((p) => this.formatProProfileResponse(p));
  }

  /**
   * Find pros within a radius of a given location
   */
  async getProsInRadius(
    lat: number,
    lng: number,
    radiusKm: number,
    categoryId?: string,
  ): Promise<ProProfileWithDistanceResponseDto[]> {
    // Build the base query
    const whereClause: any = {
      isActive: true,
      verificationStatus: 'APPROVED',
      serviceArea: {
        isNot: null,
      },
    };

    // Filter by category if provided
    if (categoryId) {
      const category = await this.prisma.serviceCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Service category with ID ${categoryId} not found`);
      }
      whereClause.serviceCategories = {
        some: { id: categoryId },
      };
    }

    // Get all active pros with service areas
    const profiles = await this.prisma.proProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        serviceArea: true,
        serviceHours: {
          where: { isActive: true },
        },
        serviceCategories: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Filter by distance and calculate metrics
    const prosInRadius: ProProfileWithDistanceResponseDto[] = [];

    for (const profile of profiles) {
      if (!profile.serviceArea) continue;

      // Calculate distance from search point to pro's service center
      const distance = calculateDistance(
        lat,
        lng,
        profile.serviceArea.centerLat,
        profile.serviceArea.centerLng,
      );

      // Check if the search point is within the pro's service area
      // AND if the pro's service center is within the search radius
      const isWithinProServiceArea = distance <= profile.serviceArea.radiusKm;
      const isWithinSearchRadius = distance <= radiusKm;

      if (isWithinProServiceArea || isWithinSearchRadius) {
        // Calculate ranking score
        const rankingScore = calculateProRankingScore(
          distance,
          profile.avgResponseMinutes,
          profile.completionRate,
          profile.totalJobsCompleted,
        );

        prosInRadius.push({
          ...this.formatProProfileResponse(profile),
          distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
          rankingScore: Math.round(rankingScore * 1000) / 1000, // Round to 3 decimal places
        });
      }
    }

    // Sort by ranking score (descending) then distance (ascending)
    prosInRadius.sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) {
        return (b.rankingScore || 0) - (a.rankingScore || 0);
      }
      return a.distance - b.distance;
    });

    this.logger.log(
      `Found ${prosInRadius.length} pros within ${radiusKm}km of (${lat}, ${lng})`,
    );

    return prosInRadius;
  }

  /**
   * Format pro profile response
   */
  private formatProProfileResponse(profile: any): ProProfileResponseDto {
    return {
      id: profile.id,
      userId: profile.userId,
      orgId: profile.orgId,
      regionId: profile.regionId,
      businessName: profile.businessName,
      businessPhone: profile.businessPhone,
      businessEmail: profile.businessEmail,
      bio: profile.bio,
      yearsExperience: profile.yearsExperience,
      verificationStatus: profile.verificationStatus,
      verifiedAt: profile.verifiedAt,
      avgResponseMinutes: profile.avgResponseMinutes,
      completionRate: profile.completionRate,
      totalJobsCompleted: profile.totalJobsCompleted,
      isActive: profile.isActive,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      serviceArea: profile.serviceArea
        ? {
            id: profile.serviceArea.id,
            centerLat: profile.serviceArea.centerLat,
            centerLng: profile.serviceArea.centerLng,
            radiusKm: profile.serviceArea.radiusKm,
          }
        : null,
      serviceHours: profile.serviceHours?.map((h: any) => ({
        id: h.id,
        dayOfWeek: h.dayOfWeek,
        startTime: h.startTime,
        endTime: h.endTime,
        isActive: h.isActive,
      })),
      serviceCategories: profile.serviceCategories?.map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code,
      })),
      user: profile.user
        ? {
            id: profile.user.id,
            email: profile.user.email,
            firstName: profile.user.firstName,
            lastName: profile.user.lastName,
          }
        : undefined,
    };
  }
}
