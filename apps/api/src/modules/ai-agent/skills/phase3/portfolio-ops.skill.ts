import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';
import { FEATURE_FLAGS } from '@trades/shared';

/**
 * Input schema for PortfolioOps skill
 */
const PortfolioOpsInputSchema = z.object({
  action: z.enum([
    'get_portfolio',
    'update_settings',
    'add_item',
    'publish',
    'unpublish',
    'request_opt_in',
    'get_stats',
    'check_slug',
  ]).describe('The portfolio operation to perform'),
  proProfileId: z.string().optional().describe('Pro profile ID'),
  slug: z.string().optional().describe('Portfolio URL slug'),
  headline: z.string().optional().describe('Portfolio headline'),
  bio: z.string().optional().describe('Portfolio bio/description'),
  theme: z.enum(['DEFAULT', 'MODERN', 'CLASSIC', 'MINIMAL']).optional().describe('Portfolio theme'),
  jobId: z.string().optional().describe('Job ID for adding items'),
  title: z.string().optional().describe('Item title'),
  description: z.string().optional().describe('Item description'),
  customerOptIn: z.boolean().optional().describe('Customer opt-in for public display'),
  showReviews: z.boolean().optional().describe('Show reviews on portfolio'),
  message: z.string().optional().describe('Message for opt-in request'),
});

type PortfolioOpsInput = z.infer<typeof PortfolioOpsInputSchema>;

/**
 * PortfolioOps Skill
 *
 * Manages pro portfolio operations via AI agent.
 * Used by PORTFOLIO_ASSISTANT agent.
 *
 * Feature Flag: AGENT_PORTFOLIO_OPS_ENABLED
 */
export class PortfolioOpsSkill extends BaseSkill {
  readonly name = 'PortfolioOps';
  readonly description = 'Manage pro portfolio including settings, items, publishing, and customer opt-in requests';
  readonly requiredFlags = [FEATURE_FLAGS.AGENT_PORTFOLIO_OPS_ENABLED];
  readonly requiredPermissions = ['portfolio:manage'];
  readonly inputSchema: SkillInputSchema = PortfolioOpsInputSchema;

  protected async executeInternal(
    input: PortfolioOpsInput,
    context: SkillExecutionContext,
  ): Promise<unknown> {
    this.logger.debug(`PortfolioOps: ${input.action}`, { sessionId: context.sessionId });

    switch (input.action) {
      case 'get_portfolio':
        return this.getPortfolio(input, context);

      case 'update_settings':
        return this.updateSettings(input, context);

      case 'add_item':
        return this.addItem(input, context);

      case 'publish':
        return this.publish(input, context);

      case 'unpublish':
        return this.unpublish(input, context);

      case 'request_opt_in':
        return this.requestOptIn(input, context);

      case 'get_stats':
        return this.getStats(input, context);

      case 'check_slug':
        return this.checkSlug(input);

      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  }

  private async getPortfolio(input: PortfolioOpsInput, context: SkillExecutionContext) {
    if (!input.proProfileId) {
      return { action: 'get_portfolio', status: 'error', message: 'proProfileId is required' };
    }

    // Stub: would call PortfolioService.getOrCreatePortfolio()
    return {
      action: 'get_portfolio',
      status: 'success',
      portfolio: {
        id: `portfolio_${input.proProfileId}_stub`,
        slug: 'my-plumbing-co',
        isPublished: false,
        theme: 'DEFAULT',
        headline: null,
        itemCount: 3,
        viewCount: 42,
      },
      message: 'Portfolio retrieved',
    };
  }

  private async updateSettings(input: PortfolioOpsInput, context: SkillExecutionContext) {
    if (!input.proProfileId) {
      return { action: 'update_settings', status: 'error', message: 'proProfileId is required' };
    }

    // Stub: would call PortfolioService.updateSettings()
    const updates: Record<string, unknown> = {};
    if (input.slug) updates.slug = input.slug;
    if (input.headline) updates.headline = input.headline;
    if (input.bio) updates.bio = input.bio;
    if (input.theme) updates.theme = input.theme;
    if (input.showReviews !== undefined) updates.showReviews = input.showReviews;

    return {
      action: 'update_settings',
      status: 'success',
      updates,
      message: `Portfolio settings updated: ${Object.keys(updates).join(', ')}`,
    };
  }

  private async addItem(input: PortfolioOpsInput, context: SkillExecutionContext) {
    if (!input.proProfileId || !input.jobId) {
      return {
        action: 'add_item',
        status: 'incomplete',
        missingFields: [
          ...(!input.proProfileId ? ['proProfileId'] : []),
          ...(!input.jobId ? ['jobId'] : []),
        ],
        message: 'proProfileId and jobId are required to add a portfolio item',
      };
    }

    if (input.customerOptIn === undefined) {
      return {
        action: 'add_item',
        status: 'incomplete',
        missingFields: ['customerOptIn'],
        message: 'Customer opt-in confirmation is required to add photos to the portfolio',
      };
    }

    // Stub: would call PortfolioService.addItemFromJob()
    return {
      action: 'add_item',
      status: 'success',
      jobId: input.jobId,
      customerOptIn: input.customerOptIn,
      message: input.customerOptIn
        ? 'Photos from the job have been added to the portfolio'
        : 'Photos added but marked as pending customer opt-in',
    };
  }

  private async publish(input: PortfolioOpsInput, context: SkillExecutionContext) {
    if (!input.proProfileId) {
      return { action: 'publish', status: 'error', message: 'proProfileId is required' };
    }

    // Stub: would call PortfolioService.publishPortfolio()
    return {
      action: 'publish',
      status: 'success',
      slug: 'my-plumbing-co',
      url: '/portfolio/my-plumbing-co',
      message: 'Portfolio has been published and is now publicly visible',
    };
  }

  private async unpublish(input: PortfolioOpsInput, context: SkillExecutionContext) {
    if (!input.proProfileId) {
      return { action: 'unpublish', status: 'error', message: 'proProfileId is required' };
    }

    // Stub: would call PortfolioService.unpublishPortfolio()
    return {
      action: 'unpublish',
      status: 'success',
      message: 'Portfolio has been unpublished and is no longer publicly visible',
    };
  }

  private async requestOptIn(input: PortfolioOpsInput, context: SkillExecutionContext) {
    if (!input.jobId) {
      return { action: 'request_opt_in', status: 'error', message: 'jobId is required' };
    }

    // Stub: would send opt-in request to customer
    return {
      action: 'request_opt_in',
      status: 'success',
      jobId: input.jobId,
      requestSent: true,
      message: input.message
        ? `Opt-in request sent with custom message: "${input.message}"`
        : 'Standard opt-in request sent to customer',
    };
  }

  private async getStats(input: PortfolioOpsInput, context: SkillExecutionContext) {
    if (!input.proProfileId) {
      return { action: 'get_stats', status: 'error', message: 'proProfileId is required' };
    }

    // Stub: would call PortfolioService.getPortfolioStats()
    return {
      action: 'get_stats',
      status: 'success',
      stats: {
        totalViews: 156,
        totalItems: 12,
        publishedItems: 8,
        pendingOptIns: 2,
        isPublished: true,
      },
      message: 'Portfolio stats retrieved',
    };
  }

  private async checkSlug(input: PortfolioOpsInput) {
    if (!input.slug) {
      return { action: 'check_slug', status: 'error', message: 'slug is required' };
    }

    // Stub: would call PortfolioService.checkSlugAvailability()
    return {
      action: 'check_slug',
      status: 'success',
      slug: input.slug,
      available: true,
      message: `The slug "${input.slug}" is available`,
    };
  }
}

export { PortfolioOpsInputSchema };
