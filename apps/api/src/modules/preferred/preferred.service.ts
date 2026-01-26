import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { FEATURE_FLAGS } from '@trades/shared';
import {
  PreferredResponseDto,
  PreferredByResponseDto,
  IsPreferredResponseDto,
  ProProfileSummaryDto,
  SmbUserSummaryDto,
} from './dto/preferred.dto';

@Injectable()
export class PreferredService {
  private readonly logger = new Logger(PreferredService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  /**
   * Check if the preferred contractor feature is enabled
   * Throws ForbiddenException if disabled
   */
  private async ensureFeatureEnabled(): Promise<void> {
    const isEnabled = await this.featureFlagsService.isEnabled(
      FEATURE_FLAGS.ENABLE_PREFERRED_CONTRACTOR,
    );

    if (!isEnabled) {
      throw new ForbiddenException(
        'Preferred contractor feature is not enabled',
      );
    }
  }

  /**
   * Add a pro to an SMB's preferred contractors list
   */
  async addPreferred(
    smbUserId: string,
    proProfileId: string,
    notes?: string,
  ): Promise<PreferredResponseDto> {
    await this.ensureFeatureEnabled();

    // Verify pro profile exists
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!proProfile) {
      throw new NotFoundException(
        `Pro profile with ID '${proProfileId}' not found`,
      );
    }

    // Check if already preferred
    const existing = await this.prisma.preferredContractor.findUnique({
      where: {
        smbUserId_proProfileId: {
          smbUserId,
          proProfileId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'This contractor is already in your preferred list',
      );
    }

    // Create preferred contractor entry
    const preferred = await this.prisma.preferredContractor.create({
      data: {
        smbUserId,
        proProfileId,
        notes,
      },
      include: {
        proProfile: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(
      `SMB ${smbUserId} added pro ${proProfileId} to preferred list`,
    );

    return this.mapToPreferredResponse(preferred);
  }

  /**
   * Remove a pro from an SMB's preferred contractors list
   */
  async removePreferred(
    smbUserId: string,
    proProfileId: string,
  ): Promise<{ message: string }> {
    await this.ensureFeatureEnabled();

    // Find the preferred entry
    const preferred = await this.prisma.preferredContractor.findUnique({
      where: {
        smbUserId_proProfileId: {
          smbUserId,
          proProfileId,
        },
      },
    });

    if (!preferred) {
      throw new NotFoundException(
        'This contractor is not in your preferred list',
      );
    }

    // Delete the entry
    await this.prisma.preferredContractor.delete({
      where: {
        smbUserId_proProfileId: {
          smbUserId,
          proProfileId,
        },
      },
    });

    this.logger.log(
      `SMB ${smbUserId} removed pro ${proProfileId} from preferred list`,
    );

    return { message: 'Contractor removed from preferred list' };
  }

  /**
   * Get all preferred contractors for an SMB user
   */
  async getPreferredContractors(
    smbUserId: string,
  ): Promise<PreferredResponseDto[]> {
    await this.ensureFeatureEnabled();

    const preferredList = await this.prisma.preferredContractor.findMany({
      where: { smbUserId },
      include: {
        proProfile: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return preferredList.map((p) => this.mapToPreferredResponse(p));
  }

  /**
   * Check if a pro is in an SMB's preferred list
   */
  async isPreferred(
    smbUserId: string,
    proProfileId: string,
  ): Promise<IsPreferredResponseDto> {
    await this.ensureFeatureEnabled();

    const preferred = await this.prisma.preferredContractor.findUnique({
      where: {
        smbUserId_proProfileId: {
          smbUserId,
          proProfileId,
        },
      },
      include: {
        proProfile: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return {
      isPreferred: !!preferred,
      preferred: preferred ? this.mapToPreferredResponse(preferred) : null,
    };
  }

  /**
   * Get all SMB users who have favorited a specific pro
   * Useful for pros to see who has added them to preferred list
   */
  async getPreferredByPro(proProfileId: string): Promise<PreferredByResponseDto[]> {
    await this.ensureFeatureEnabled();

    // Verify pro profile exists
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile) {
      throw new NotFoundException(
        `Pro profile with ID '${proProfileId}' not found`,
      );
    }

    const preferredByList = await this.prisma.preferredContractor.findMany({
      where: { proProfileId },
      include: {
        smbUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return preferredByList.map((p) => this.mapToPreferredByResponse(p));
  }

  /**
   * Map database entity to PreferredResponseDto
   */
  private mapToPreferredResponse(preferred: {
    id: string;
    smbUserId: string;
    proProfileId: string;
    notes: string | null;
    createdAt: Date;
    proProfile?: {
      id: string;
      businessName: string | null;
      businessPhone: string | null;
      businessEmail: string | null;
      bio: string | null;
      yearsExperience: number | null;
      verificationStatus: string;
      avgResponseMinutes: number | null;
      completionRate: number | null;
      totalJobsCompleted: number;
      user?: {
        firstName: string | null;
        lastName: string | null;
      };
    };
  }): PreferredResponseDto {
    const response: PreferredResponseDto = {
      id: preferred.id,
      smbUserId: preferred.smbUserId,
      proProfileId: preferred.proProfileId,
      notes: preferred.notes,
      createdAt: preferred.createdAt,
    };

    if (preferred.proProfile) {
      response.proProfile = this.mapToProProfileSummary(preferred.proProfile);
    }

    return response;
  }

  /**
   * Map database entity to PreferredByResponseDto
   */
  private mapToPreferredByResponse(preferred: {
    id: string;
    smbUserId: string;
    proProfileId: string;
    notes: string | null;
    createdAt: Date;
    smbUser?: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
    };
  }): PreferredByResponseDto {
    const response: PreferredByResponseDto = {
      id: preferred.id,
      smbUserId: preferred.smbUserId,
      proProfileId: preferred.proProfileId,
      notes: preferred.notes,
      createdAt: preferred.createdAt,
    };

    if (preferred.smbUser) {
      response.smbUser = this.mapToSmbUserSummary(preferred.smbUser);
    }

    return response;
  }

  /**
   * Map pro profile to summary DTO
   */
  private mapToProProfileSummary(proProfile: {
    id: string;
    businessName: string | null;
    businessPhone: string | null;
    businessEmail: string | null;
    bio: string | null;
    yearsExperience: number | null;
    verificationStatus: string;
    avgResponseMinutes: number | null;
    completionRate: number | null;
    totalJobsCompleted: number;
    user?: {
      firstName: string | null;
      lastName: string | null;
    };
  }): ProProfileSummaryDto {
    return {
      id: proProfile.id,
      businessName: proProfile.businessName,
      businessPhone: proProfile.businessPhone,
      businessEmail: proProfile.businessEmail,
      bio: proProfile.bio,
      yearsExperience: proProfile.yearsExperience,
      verificationStatus: proProfile.verificationStatus,
      avgResponseMinutes: proProfile.avgResponseMinutes,
      completionRate: proProfile.completionRate,
      totalJobsCompleted: proProfile.totalJobsCompleted,
      firstName: proProfile.user?.firstName,
      lastName: proProfile.user?.lastName,
    };
  }

  /**
   * Map SMB user to summary DTO
   */
  private mapToSmbUserSummary(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  }): SmbUserSummaryDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    };
  }
}
