import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  calculateDistance,
  isWithinServiceHours,
  getDayOfWeek,
  VerificationStatus,
} from '@trades/shared';

/**
 * Interface for job data needed for matching
 */
export interface JobForMatching {
  id: string;
  serviceCategoryId: string;
  serviceLat?: number | null;
  serviceLng?: number | null;
}

/**
 * Interface for a matched pro profile
 */
export interface MatchedPro {
  id: string;
  userId: string;
  businessName: string | null;
  avgResponseMinutes: number | null;
  completionRate: number | null;
  totalJobsCompleted: number;
  distance: number;
  serviceArea: {
    centerLat: number;
    centerLng: number;
    radiusKm: number;
  };
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find pros matching job criteria
   * Criteria:
   * - Service category matches
   * - Verification status is APPROVED
   * - Service area includes job location
   * - Currently within service hours
   */
  async findMatchingPros(job: JobForMatching): Promise<MatchedPro[]> {
    this.logger.log(`Finding matching pros for job ${job.id}`);

    // Get the current day and time for service hours check
    const now = new Date();
    const currentDayOfWeek = getDayOfWeek(now);

    // Fetch all verified pros with the matching service category
    const pros = await this.prisma.proProfile.findMany({
      where: {
        isActive: true,
        verificationStatus: VerificationStatus.APPROVED,
        serviceCategories: {
          some: {
            id: job.serviceCategoryId,
          },
        },
        serviceArea: {
          isNot: null,
        },
      },
      include: {
        serviceArea: true,
        serviceHours: {
          where: {
            dayOfWeek: currentDayOfWeek as any,
            isActive: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    this.logger.debug(`Found ${pros.length} verified pros with matching service category`);

    // Filter pros based on service area and service hours
    const matchedPros: MatchedPro[] = [];

    for (const pro of pros) {
      // Skip if no service area defined
      if (!pro.serviceArea) {
        continue;
      }

      // Skip if job has no coordinates
      if (!job.serviceLat || !job.serviceLng) {
        this.logger.warn(`Job ${job.id} has no coordinates, skipping distance check`);
        continue;
      }

      // Calculate distance from job to pro's service center
      const distance = calculateDistance(
        pro.serviceArea.centerLat,
        pro.serviceArea.centerLng,
        job.serviceLat,
        job.serviceLng,
      );

      // Check if job is within service area radius
      if (distance > pro.serviceArea.radiusKm) {
        this.logger.debug(
          `Pro ${pro.id} service area (${pro.serviceArea.radiusKm}km) doesn't cover job (${distance.toFixed(2)}km away)`,
        );
        continue;
      }

      // Check if currently within service hours
      const todayHours = pro.serviceHours.find(
        (h) => h.dayOfWeek === currentDayOfWeek,
      );

      if (!todayHours) {
        this.logger.debug(`Pro ${pro.id} has no service hours for ${currentDayOfWeek}`);
        continue;
      }

      if (!isWithinServiceHours(todayHours.startTime, todayHours.endTime, now)) {
        this.logger.debug(
          `Pro ${pro.id} is outside service hours (${todayHours.startTime}-${todayHours.endTime})`,
        );
        continue;
      }

      // Pro matches all criteria
      matchedPros.push({
        id: pro.id,
        userId: pro.userId,
        businessName: pro.businessName,
        avgResponseMinutes: pro.avgResponseMinutes,
        completionRate: pro.completionRate,
        totalJobsCompleted: pro.totalJobsCompleted,
        distance,
        serviceArea: {
          centerLat: pro.serviceArea.centerLat,
          centerLng: pro.serviceArea.centerLng,
          radiusKm: pro.serviceArea.radiusKm,
        },
        user: pro.user,
      });
    }

    this.logger.log(`Found ${matchedPros.length} matching pros for job ${job.id}`);
    return matchedPros;
  }

  /**
   * Validate if a specific pro can be matched to a job
   * Returns true if the pro meets all matching criteria
   */
  async validateProForJob(
    proProfileId: string,
    job: JobForMatching,
  ): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    this.logger.log(`Validating pro ${proProfileId} for job ${job.id}`);

    const pro = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      include: {
        serviceArea: true,
        serviceHours: true,
        serviceCategories: {
          where: {
            id: job.serviceCategoryId,
          },
        },
      },
    });

    // Check if pro exists
    if (!pro) {
      return { isValid: false, reason: 'Pro profile not found' };
    }

    // Check if pro is active
    if (!pro.isActive) {
      return { isValid: false, reason: 'Pro profile is not active' };
    }

    // Check verification status
    if (pro.verificationStatus !== VerificationStatus.APPROVED) {
      return {
        isValid: false,
        reason: `Pro verification status is ${pro.verificationStatus}`,
      };
    }

    // Check service category match
    if (pro.serviceCategories.length === 0) {
      return {
        isValid: false,
        reason: 'Pro does not offer this service category',
      };
    }

    // Check service area
    if (!pro.serviceArea) {
      return { isValid: false, reason: 'Pro has no service area defined' };
    }

    if (job.serviceLat && job.serviceLng) {
      const distance = calculateDistance(
        pro.serviceArea.centerLat,
        pro.serviceArea.centerLng,
        job.serviceLat,
        job.serviceLng,
      );

      if (distance > pro.serviceArea.radiusKm) {
        return {
          isValid: false,
          reason: `Job location is ${distance.toFixed(2)}km away, outside service area radius of ${pro.serviceArea.radiusKm}km`,
        };
      }
    }

    // Check service hours
    const now = new Date();
    const currentDayOfWeek = getDayOfWeek(now);
    const todayHours = pro.serviceHours.find(
      (h) => h.dayOfWeek === currentDayOfWeek && h.isActive,
    );

    if (!todayHours) {
      return {
        isValid: false,
        reason: `Pro has no service hours for ${currentDayOfWeek}`,
      };
    }

    if (!isWithinServiceHours(todayHours.startTime, todayHours.endTime, now)) {
      return {
        isValid: false,
        reason: `Pro is outside service hours (${todayHours.startTime}-${todayHours.endTime})`,
      };
    }

    return { isValid: true };
  }

  /**
   * Get pros who have already been dispatched for a job
   * Used to exclude them from new dispatch attempts
   */
  async getDispatchedProIds(jobId: string): Promise<string[]> {
    const attempts = await this.prisma.dispatchAttempt.findMany({
      where: { jobId },
      select: { proProfileId: true },
    });

    return attempts.map((a) => a.proProfileId);
  }

  /**
   * Check if a pro has a pending dispatch for a job
   */
  async hasPendingDispatch(
    proProfileId: string,
    jobId: string,
  ): Promise<boolean> {
    const pending = await this.prisma.dispatchAttempt.findFirst({
      where: {
        proProfileId,
        jobId,
        status: 'PENDING',
      },
    });

    return !!pending;
  }
}
