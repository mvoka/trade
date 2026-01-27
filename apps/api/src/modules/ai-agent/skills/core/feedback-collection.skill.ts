import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for FeedbackCollection skill
 */
const FeedbackCollectionInputSchema = z.object({
  feedbackType: z.enum(['JOB_COMPLETION', 'CONTRACTOR_RATING', 'SERVICE_QUALITY', 'PLATFORM_EXPERIENCE', 'GENERAL']),
  relatedEntityType: z.enum(['JOB', 'BOOKING', 'CONTRACTOR']).optional(),
  relatedEntityId: z.string().optional(),
  overallRating: z.number().min(1).max(5).describe('Rating from 1-5'),
  categoryRatings: z.object({
    professionalism: z.number().min(1).max(5).optional(),
    quality: z.number().min(1).max(5).optional(),
    timeliness: z.number().min(1).max(5).optional(),
    communication: z.number().min(1).max(5).optional(),
    value: z.number().min(1).max(5).optional(),
  }).optional(),
  comments: z.string().optional(),
  wouldRecommend: z.boolean().optional(),
  allowPublicDisplay: z.boolean().optional().default(false),
  followUpRequested: z.boolean().optional().default(false),
});

type FeedbackCollectionInput = z.infer<typeof FeedbackCollectionInputSchema>;

/**
 * Feedback record
 */
interface FeedbackRecord {
  feedbackId: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'PUBLISHED' | 'FLAGGED';
  submittedAt: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  npsCategory?: 'PROMOTER' | 'PASSIVE' | 'DETRACTOR';
  publicReviewUrl?: string;
}

/**
 * FeedbackCollection Skill
 *
 * Collects and processes customer feedback.
 * Used by Quality Assurance agent.
 */
export class FeedbackCollectionSkill extends BaseSkill {
  readonly name = 'FeedbackCollection';
  readonly description = 'Collect customer feedback including ratings, comments, and recommendations after service completion';
  readonly requiredFlags = [];
  readonly requiredPermissions = [];
  readonly inputSchema: SkillInputSchema = FeedbackCollectionInputSchema;

  protected async executeInternal(
    input: FeedbackCollectionInput,
    context: SkillExecutionContext,
  ): Promise<{
    feedback: FeedbackRecord;
    acknowledgment: string;
    insights: {
      averageRating: number;
      sentiment: string;
      keyStrengths: string[];
      areasForImprovement: string[];
    };
    followUp?: {
      scheduled: boolean;
      reason: string;
    };
  }> {
    this.logger.debug('Processing feedback', {
      feedbackType: input.feedbackType,
      rating: input.overallRating,
    });

    // Analyze sentiment
    const sentiment = this.analyzeSentiment(input.overallRating, input.comments);

    // Calculate NPS category if recommendation data available
    const npsCategory = input.wouldRecommend !== undefined
      ? this.calculateNpsCategory(input.overallRating, input.wouldRecommend)
      : undefined;

    // Generate feedback ID
    const feedbackId = `FB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Determine if feedback needs review (low ratings or flagged content)
    const needsReview = input.overallRating <= 2 || this.containsFlaggedContent(input.comments);

    const feedback: FeedbackRecord = {
      feedbackId,
      status: needsReview ? 'UNDER_REVIEW' : (input.allowPublicDisplay ? 'PUBLISHED' : 'SUBMITTED'),
      submittedAt: new Date().toISOString(),
      sentiment,
      npsCategory,
      publicReviewUrl: input.allowPublicDisplay ? `https://reviews.example.com/${feedbackId}` : undefined,
    };

    // Generate insights
    const insights = this.generateInsights(input);

    // Generate acknowledgment
    const acknowledgment = this.generateAcknowledgment(input, feedback);

    const result: {
      feedback: FeedbackRecord;
      acknowledgment: string;
      insights: typeof insights;
      followUp?: { scheduled: boolean; reason: string };
    } = {
      feedback,
      acknowledgment,
      insights,
    };

    // Schedule follow-up if requested or if there are concerns
    if (input.followUpRequested || input.overallRating <= 2) {
      result.followUp = {
        scheduled: true,
        reason: input.followUpRequested
          ? 'Customer requested follow-up'
          : 'Low rating requires attention',
      };
    }

    return result;
  }

  private analyzeSentiment(rating: number, comments?: string): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' {
    // Primary: use rating
    if (rating >= 4) return 'POSITIVE';
    if (rating <= 2) return 'NEGATIVE';

    // Secondary: analyze comments if available
    if (comments) {
      const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'happy', 'satisfied', 'recommend'];
      const negativeWords = ['bad', 'terrible', 'awful', 'disappointed', 'poor', 'worst', 'never', 'avoid'];

      const lowerComments = comments.toLowerCase();
      const positiveCount = positiveWords.filter(w => lowerComments.includes(w)).length;
      const negativeCount = negativeWords.filter(w => lowerComments.includes(w)).length;

      if (positiveCount > negativeCount) return 'POSITIVE';
      if (negativeCount > positiveCount) return 'NEGATIVE';
    }

    return 'NEUTRAL';
  }

  private calculateNpsCategory(rating: number, wouldRecommend: boolean): 'PROMOTER' | 'PASSIVE' | 'DETRACTOR' {
    if (rating >= 4 && wouldRecommend) return 'PROMOTER';
    if (rating <= 2 || !wouldRecommend) return 'DETRACTOR';
    return 'PASSIVE';
  }

  private containsFlaggedContent(comments?: string): boolean {
    if (!comments) return false;

    const flaggedPatterns = [
      /scam/i,
      /fraud/i,
      /lawsuit/i,
      /lawyer/i,
      /sue/i,
      /report.*bbb/i,
      /dangerous/i,
      /unsafe/i,
    ];

    return flaggedPatterns.some(pattern => pattern.test(comments));
  }

  private generateInsights(input: FeedbackCollectionInput): {
    averageRating: number;
    sentiment: string;
    keyStrengths: string[];
    areasForImprovement: string[];
  } {
    const keyStrengths: string[] = [];
    const areasForImprovement: string[] = [];

    // Analyze category ratings
    if (input.categoryRatings) {
      const categories = input.categoryRatings;

      if (categories.professionalism && categories.professionalism >= 4) {
        keyStrengths.push('Professional conduct');
      } else if (categories.professionalism && categories.professionalism <= 2) {
        areasForImprovement.push('Professionalism');
      }

      if (categories.quality && categories.quality >= 4) {
        keyStrengths.push('Quality of work');
      } else if (categories.quality && categories.quality <= 2) {
        areasForImprovement.push('Work quality');
      }

      if (categories.timeliness && categories.timeliness >= 4) {
        keyStrengths.push('Punctuality');
      } else if (categories.timeliness && categories.timeliness <= 2) {
        areasForImprovement.push('Timeliness');
      }

      if (categories.communication && categories.communication >= 4) {
        keyStrengths.push('Clear communication');
      } else if (categories.communication && categories.communication <= 2) {
        areasForImprovement.push('Communication');
      }

      if (categories.value && categories.value >= 4) {
        keyStrengths.push('Good value for money');
      } else if (categories.value && categories.value <= 2) {
        areasForImprovement.push('Value/pricing');
      }
    }

    // Add generic insights based on overall rating
    if (keyStrengths.length === 0 && input.overallRating >= 4) {
      keyStrengths.push('Overall positive experience');
    }
    if (areasForImprovement.length === 0 && input.overallRating <= 2) {
      areasForImprovement.push('Overall service experience');
    }

    // Calculate average from category ratings or use overall
    let averageRating = input.overallRating;
    if (input.categoryRatings) {
      const ratings = Object.values(input.categoryRatings).filter(r => r !== undefined) as number[];
      if (ratings.length > 0) {
        averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      }
    }

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      sentiment: this.analyzeSentiment(input.overallRating, input.comments),
      keyStrengths,
      areasForImprovement,
    };
  }

  private generateAcknowledgment(input: FeedbackCollectionInput, feedback: FeedbackRecord): string {
    let message = 'Thank you for taking the time to share your feedback! ';

    if (input.overallRating >= 4) {
      message += "We're thrilled to hear about your positive experience. ";
    } else if (input.overallRating <= 2) {
      message += "We're sorry to hear your experience didn't meet expectations. Your feedback helps us improve. ";
    } else {
      message += 'Your feedback is valuable and helps us continuously improve our service. ';
    }

    if (input.allowPublicDisplay && feedback.publicReviewUrl) {
      message += `Your review will be visible at: ${feedback.publicReviewUrl}. `;
    }

    if (input.wouldRecommend) {
      message += "We're grateful for your willingness to recommend us!";
    }

    return message;
  }
}

export { FeedbackCollectionInputSchema };
