import { Injectable, Logger } from '@nestjs/common';
import { calculateProRankingScore } from '@trades/shared';
import { MatchedPro } from './matching.service';

/**
 * Interface for a ranked pro with score
 */
export interface RankedPro extends MatchedPro {
  score: number;
}

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  /**
   * Rank matched pros based on multiple factors:
   * - Distance (closer is better) - 40% weight
   * - Average response time (faster is better) - 30% weight
   * - Completion rate (higher is better) - 20% weight
   * - Total jobs completed (more experience is better) - 10% weight
   *
   * @param pros Array of matched pros to rank
   * @param jobLat Job latitude (for distance calculation if not already computed)
   * @param jobLng Job longitude (for distance calculation if not already computed)
   * @returns Array of pros sorted by ranking score (highest first)
   */
  rankPros(
    pros: MatchedPro[],
    jobLat?: number | null,
    jobLng?: number | null,
  ): RankedPro[] {
    this.logger.log(`Ranking ${pros.length} pros`);

    if (pros.length === 0) {
      return [];
    }

    // Calculate ranking scores for each pro
    const rankedPros: RankedPro[] = pros.map((pro) => {
      const score = calculateProRankingScore(
        pro.distance,
        pro.avgResponseMinutes,
        pro.completionRate,
        pro.totalJobsCompleted,
      );

      this.logger.debug(
        `Pro ${pro.id}: distance=${pro.distance.toFixed(2)}km, ` +
          `responseTime=${pro.avgResponseMinutes ?? 'N/A'}min, ` +
          `completionRate=${pro.completionRate ?? 'N/A'}, ` +
          `jobsCompleted=${pro.totalJobsCompleted}, ` +
          `score=${score.toFixed(4)}`,
      );

      return {
        ...pro,
        score,
      };
    });

    // Sort by score descending (highest score = best match)
    rankedPros.sort((a, b) => b.score - a.score);

    this.logger.log(
      `Ranking complete. Top pro: ${rankedPros[0]?.id} with score ${rankedPros[0]?.score.toFixed(4)}`,
    );

    return rankedPros;
  }

  /**
   * Get the top N ranked pros
   */
  getTopPros(rankedPros: RankedPro[], count: number): RankedPro[] {
    return rankedPros.slice(0, count);
  }

  /**
   * Get pros for a specific escalation step
   * Escalation steps are typically [1, 2, 5] meaning:
   * - Step 1: Top 1 pro
   * - Step 2: Next 2 pros
   * - Step 3: Next 5 pros
   *
   * @param rankedPros All ranked pros
   * @param escalationSteps Array of escalation step sizes [1, 2, 5]
   * @param currentStep Current escalation step (0-indexed)
   * @param alreadyDispatchedIds Pro IDs already dispatched to
   */
  getProsForEscalationStep(
    rankedPros: RankedPro[],
    escalationSteps: number[],
    currentStep: number,
    alreadyDispatchedIds: string[],
  ): RankedPro[] {
    // Filter out already dispatched pros
    const availablePros = rankedPros.filter(
      (pro) => !alreadyDispatchedIds.includes(pro.id),
    );

    if (availablePros.length === 0) {
      this.logger.warn('No available pros for escalation step');
      return [];
    }

    // Calculate start index for this step
    let startIndex = 0;
    for (let i = 0; i < currentStep; i++) {
      startIndex += escalationSteps[i] || 0;
    }

    // Get the count for this step
    const count = escalationSteps[currentStep] || escalationSteps[escalationSteps.length - 1] || 1;

    // Get pros for this step
    const prosForStep = availablePros.slice(startIndex, startIndex + count);

    this.logger.log(
      `Escalation step ${currentStep}: returning ${prosForStep.length} pros ` +
        `(indices ${startIndex} to ${startIndex + count - 1})`,
    );

    return prosForStep;
  }

  /**
   * Calculate ranking score breakdown for display/debugging
   */
  getRankingBreakdown(pro: MatchedPro): {
    distanceScore: number;
    responseScore: number;
    completionScore: number;
    experienceScore: number;
    totalScore: number;
  } {
    // Weights for different factors
    const distanceWeight = 0.4;
    const responseWeight = 0.3;
    const completionWeight = 0.2;
    const experienceWeight = 0.1;

    // Normalize distance (closer is better, max 50km)
    const distanceScore = Math.max(0, 1 - pro.distance / 50);

    // Normalize response time (faster is better, max 30 minutes)
    const responseScore = pro.avgResponseMinutes
      ? Math.max(0, 1 - pro.avgResponseMinutes / 30)
      : 0.5; // Default if no data

    // Completion rate is already 0-1
    const completionScore = pro.completionRate ?? 0.5;

    // Normalize experience (more is better, diminishing returns after 100 jobs)
    const experienceScore = Math.min(1, pro.totalJobsCompleted / 100);

    const totalScore =
      distanceScore * distanceWeight +
      responseScore * responseWeight +
      completionScore * completionWeight +
      experienceScore * experienceWeight;

    return {
      distanceScore,
      responseScore,
      completionScore,
      experienceScore,
      totalScore,
    };
  }
}
