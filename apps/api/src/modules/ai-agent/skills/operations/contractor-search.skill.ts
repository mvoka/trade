import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for ContractorSearch skill
 */
const ContractorSearchInputSchema = z.object({
  serviceType: z.string().describe('Type of service required'),
  location: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
  }),
  radiusKm: z.number().optional().default(25),
  filters: z.object({
    minRating: z.number().min(1).max(5).optional(),
    maxDistance: z.number().optional(),
    availableNow: z.boolean().optional(),
    availableDate: z.string().optional(),
    certifications: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    maxResponseTime: z.number().optional(),
  }).optional(),
  sortBy: z.enum(['DISTANCE', 'RATING', 'RESPONSE_TIME', 'JOBS_COMPLETED', 'AVAILABILITY']).optional().default('DISTANCE'),
  limit: z.number().optional().default(10),
});

type ContractorSearchInput = z.infer<typeof ContractorSearchInputSchema>;

/**
 * Contractor search result
 */
interface ContractorResult {
  proProfileId: string;
  name: string;
  businessName?: string;
  serviceTypes: string[];
  distance: number;
  estimatedTravelTime: number;
  rating: number;
  reviewCount: number;
  jobsCompleted: number;
  responseTimeMinutes: number;
  availability: {
    availableNow: boolean;
    nextAvailable?: string;
    todaySlots: number;
  };
  certifications: string[];
  languages: string[];
  pricing: {
    hourlyRate: number;
    calloutFee: number;
  };
  matchScore: number;
}

/**
 * ContractorSearch Skill
 *
 * Searches for available contractors based on criteria.
 * Used by Dispatch Optimizer agent.
 */
export class ContractorSearchSkill extends BaseSkill {
  readonly name = 'ContractorSearch';
  readonly description = 'Search for available contractors based on service type, location, availability, and other criteria';
  readonly requiredFlags = ['DISPATCH_ENABLED'];
  readonly requiredPermissions = ['dispatch:read', 'contractor:search'];
  readonly inputSchema: SkillInputSchema = ContractorSearchInputSchema;

  protected async executeInternal(
    input: ContractorSearchInput,
    context: SkillExecutionContext,
  ): Promise<{
    success: boolean;
    contractors: ContractorResult[];
    searchCriteria: {
      serviceType: string;
      location: string;
      radius: number;
      filters: string[];
    };
    summary: {
      totalFound: number;
      availableNow: number;
      averageRating: number;
      averageDistance: number;
      recommendedContractor?: ContractorResult;
    };
    message: string;
  }> {
    this.logger.debug('Searching for contractors', {
      serviceType: input.serviceType,
      location: input.location,
    });

    // Generate mock contractor results
    const contractors = this.generateContractors(input);

    // Sort by specified criteria
    this.sortContractors(contractors, input.sortBy || 'DISTANCE');

    // Limit results
    const limitedResults = contractors.slice(0, input.limit || 10);

    // Calculate summary
    const availableNow = limitedResults.filter(c => c.availability.availableNow).length;
    const avgRating = limitedResults.length > 0
      ? limitedResults.reduce((sum, c) => sum + c.rating, 0) / limitedResults.length
      : 0;
    const avgDistance = limitedResults.length > 0
      ? limitedResults.reduce((sum, c) => sum + c.distance, 0) / limitedResults.length
      : 0;

    // Determine recommended contractor
    const recommended = this.findRecommended(limitedResults);

    // Format location string
    const locationStr = input.location.city || input.location.postalCode || 'specified location';

    // Format applied filters
    const appliedFilters: string[] = [];
    if (input.filters?.minRating) {
      appliedFilters.push(`Min rating: ${input.filters.minRating}`);
    }
    if (input.filters?.availableNow) {
      appliedFilters.push('Available now');
    }
    if (input.filters?.certifications?.length) {
      appliedFilters.push(`Certifications: ${input.filters.certifications.join(', ')}`);
    }

    return {
      success: true,
      contractors: limitedResults,
      searchCriteria: {
        serviceType: input.serviceType,
        location: locationStr,
        radius: input.radiusKm || 25,
        filters: appliedFilters,
      },
      summary: {
        totalFound: limitedResults.length,
        availableNow,
        averageRating: Math.round(avgRating * 10) / 10,
        averageDistance: Math.round(avgDistance * 10) / 10,
        recommendedContractor: recommended,
      },
      message: `Found ${limitedResults.length} contractor(s) for ${input.serviceType} within ${input.radiusKm || 25}km. ${availableNow} available now.`,
    };
  }

  private generateContractors(input: ContractorSearchInput): ContractorResult[] {
    const firstNames = ['John', 'Mike', 'Sarah', 'David', 'James', 'Robert', 'Emily', 'Lisa', 'Chris', 'Tom'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor'];
    const businessSuffixes = ['Plumbing', 'Services', 'Pro', 'Solutions', 'Experts', 'Masters'];

    const contractors: ContractorResult[] = [];
    const numContractors = Math.floor(Math.random() * 10) + 5;

    for (let i = 0; i < numContractors; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const hasBusinessName = Math.random() > 0.5;

      const distance = 1 + Math.random() * (input.radiusKm || 25);
      const rating = 3.5 + Math.random() * 1.5;
      const availableNow = Math.random() > 0.4;

      const contractor: ContractorResult = {
        proProfileId: `pro_${Date.now()}_${i}`,
        name: `${firstName} ${lastName}`,
        businessName: hasBusinessName
          ? `${lastName}'s ${businessSuffixes[Math.floor(Math.random() * businessSuffixes.length)]}`
          : undefined,
        serviceTypes: [input.serviceType, ...(Math.random() > 0.5 ? ['GENERAL'] : [])],
        distance: Math.round(distance * 10) / 10,
        estimatedTravelTime: Math.round(distance * 2 + Math.random() * 10),
        rating: Math.round(rating * 10) / 10,
        reviewCount: Math.floor(Math.random() * 200) + 10,
        jobsCompleted: Math.floor(Math.random() * 500) + 50,
        responseTimeMinutes: Math.floor(Math.random() * 30) + 5,
        availability: {
          availableNow,
          nextAvailable: availableNow
            ? undefined
            : new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          todaySlots: availableNow ? Math.floor(Math.random() * 3) + 1 : 0,
        },
        certifications: this.generateCertifications(input.serviceType),
        languages: ['English', ...(Math.random() > 0.7 ? ['French'] : []), ...(Math.random() > 0.8 ? ['Spanish'] : [])],
        pricing: {
          hourlyRate: 65 + Math.floor(Math.random() * 50),
          calloutFee: 25 + Math.floor(Math.random() * 25),
        },
        matchScore: 0,
      };

      // Calculate match score
      contractor.matchScore = this.calculateMatchScore(contractor, input);

      // Apply filters
      if (this.passesFilters(contractor, input.filters)) {
        contractors.push(contractor);
      }
    }

    return contractors;
  }

  private generateCertifications(serviceType: string): string[] {
    const certMap: Record<string, string[]> = {
      PLUMBING: ['Licensed Plumber', 'Gas Fitter', 'Backflow Prevention'],
      ELECTRICAL: ['Licensed Electrician', 'Master Electrician', 'Low Voltage'],
      HVAC: ['HVAC Technician', 'EPA Certified', 'Gas Fitter'],
      GENERAL: ['Handyman Certified', 'Home Inspector'],
    };

    const certs = certMap[serviceType.toUpperCase()] || certMap.GENERAL;
    const numCerts = Math.floor(Math.random() * certs.length) + 1;
    return certs.slice(0, numCerts);
  }

  private calculateMatchScore(contractor: ContractorResult, input: ContractorSearchInput): number {
    let score = 50; // Base score

    // Distance factor (closer = better)
    const maxRadius = input.radiusKm || 25;
    score += (1 - contractor.distance / maxRadius) * 20;

    // Rating factor
    score += (contractor.rating / 5) * 15;

    // Availability factor
    if (contractor.availability.availableNow) {
      score += 10;
    }

    // Response time factor
    score += Math.max(0, 5 - contractor.responseTimeMinutes / 10);

    return Math.round(score);
  }

  private passesFilters(
    contractor: ContractorResult,
    filters?: {
      minRating?: number;
      maxDistance?: number;
      availableNow?: boolean;
      certifications?: string[];
      languages?: string[];
      maxResponseTime?: number;
    },
  ): boolean {
    if (!filters) return true;

    if (filters.minRating && contractor.rating < filters.minRating) {
      return false;
    }

    if (filters.maxDistance && contractor.distance > filters.maxDistance) {
      return false;
    }

    if (filters.availableNow && !contractor.availability.availableNow) {
      return false;
    }

    if (filters.certifications?.length) {
      const hasCerts = filters.certifications.some(cert =>
        contractor.certifications.some(c => c.toLowerCase().includes(cert.toLowerCase()))
      );
      if (!hasCerts) return false;
    }

    if (filters.languages?.length) {
      const hasLang = filters.languages.some(lang =>
        contractor.languages.some(l => l.toLowerCase() === lang.toLowerCase())
      );
      if (!hasLang) return false;
    }

    if (filters.maxResponseTime && contractor.responseTimeMinutes > filters.maxResponseTime) {
      return false;
    }

    return true;
  }

  private sortContractors(contractors: ContractorResult[], sortBy: string): void {
    switch (sortBy) {
      case 'DISTANCE':
        contractors.sort((a, b) => a.distance - b.distance);
        break;
      case 'RATING':
        contractors.sort((a, b) => b.rating - a.rating);
        break;
      case 'RESPONSE_TIME':
        contractors.sort((a, b) => a.responseTimeMinutes - b.responseTimeMinutes);
        break;
      case 'JOBS_COMPLETED':
        contractors.sort((a, b) => b.jobsCompleted - a.jobsCompleted);
        break;
      case 'AVAILABILITY':
        contractors.sort((a, b) => {
          if (a.availability.availableNow && !b.availability.availableNow) return -1;
          if (!a.availability.availableNow && b.availability.availableNow) return 1;
          return a.distance - b.distance;
        });
        break;
    }
  }

  private findRecommended(contractors: ContractorResult[]): ContractorResult | undefined {
    if (contractors.length === 0) return undefined;

    // Find contractor with highest match score
    return contractors.reduce((best, current) =>
      current.matchScore > best.matchScore ? current : best
    );
  }
}

export { ContractorSearchInputSchema };
