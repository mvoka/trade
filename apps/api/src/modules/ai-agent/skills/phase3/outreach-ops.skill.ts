import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';
import { FEATURE_FLAGS } from '@trades/shared';

/**
 * Input schema for OutreachOps skill
 */
const OutreachOpsInputSchema = z.object({
  action: z.enum([
    'list_campaigns',
    'create_campaign',
    'activate_campaign',
    'pause_campaign',
    'get_campaign_stats',
    'get_leads',
    'update_lead_status',
    'record_follow_up',
    'get_follow_up_queue',
    'check_compliance',
    'process_opt_out',
  ]).describe('The outreach operation to perform'),
  campaignId: z.string().optional().describe('Campaign ID'),
  leadId: z.string().optional().describe('Lead ID'),
  slug: z.string().optional().describe('Campaign slug'),
  headline: z.string().optional().describe('Campaign headline'),
  subheadline: z.string().optional().describe('Campaign subheadline'),
  offerType: z.enum([
    'DISCOUNT_PERCENT',
    'DISCOUNT_FIXED',
    'FREE_ADDON',
    'FREE_CONSULTATION',
    'SEASONAL',
  ]).optional().describe('Type of offer'),
  discountValue: z.number().optional().describe('Discount value'),
  requiresMarketingConsent: z.boolean().optional().describe('Require marketing consent'),
  leadStatus: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']).optional().describe('Lead status'),
  notes: z.string().optional().describe('Notes for follow-up or status change'),
  email: z.string().optional().describe('Email for opt-out processing'),
});

type OutreachOpsInput = z.infer<typeof OutreachOpsInputSchema>;

/**
 * OutreachOps Skill
 *
 * Manages offer campaigns and lead outreach via AI agent.
 * Used by OUTREACH_COORDINATOR agent.
 *
 * Feature Flag: AGENT_OUTREACH_OPS_ENABLED
 */
export class OutreachOpsSkill extends BaseSkill {
  readonly name = 'OutreachOps';
  readonly description = 'Manage offer campaigns, lead capture, follow-up tracking, and marketing compliance';
  readonly requiredFlags = [FEATURE_FLAGS.AGENT_OUTREACH_OPS_ENABLED];
  readonly requiredPermissions = ['offers:manage'];
  readonly inputSchema: SkillInputSchema = OutreachOpsInputSchema;

  protected async executeInternal(
    input: OutreachOpsInput,
    context: SkillExecutionContext,
  ): Promise<unknown> {
    this.logger.debug(`OutreachOps: ${input.action}`, { sessionId: context.sessionId });

    switch (input.action) {
      case 'list_campaigns':
        return this.listCampaigns();

      case 'create_campaign':
        return this.createCampaign(input, context);

      case 'activate_campaign':
        return this.activateCampaign(input, context);

      case 'pause_campaign':
        return this.pauseCampaign(input, context);

      case 'get_campaign_stats':
        return this.getCampaignStats(input);

      case 'get_leads':
        return this.getLeads(input);

      case 'update_lead_status':
        return this.updateLeadStatus(input, context);

      case 'record_follow_up':
        return this.recordFollowUp(input, context);

      case 'get_follow_up_queue':
        return this.getFollowUpQueue();

      case 'check_compliance':
        return this.checkCompliance(input);

      case 'process_opt_out':
        return this.processOptOut(input, context);

      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  }

  private async listCampaigns() {
    // Stub: would call OffersService.listCampaigns()
    return {
      action: 'list_campaigns',
      status: 'success',
      campaigns: [
        { id: 'camp_1', slug: 'spring-pool-opening', headline: 'Spring Pool Opening Special', status: 'ACTIVE', leads: 15 },
        { id: 'camp_2', slug: 'fall-maintenance', headline: 'Fall Maintenance Package', status: 'DRAFT', leads: 0 },
      ],
      message: 'Campaigns retrieved',
    };
  }

  private async createCampaign(input: OutreachOpsInput, context: SkillExecutionContext) {
    const missingFields: string[] = [];
    if (!input.slug) missingFields.push('slug');
    if (!input.headline) missingFields.push('headline');
    if (!input.offerType) missingFields.push('offerType');

    if (missingFields.length > 0) {
      return {
        action: 'create_campaign',
        status: 'incomplete',
        missingFields,
        message: `Please provide: ${missingFields.join(', ')}`,
      };
    }

    // Stub: would call OffersService.createCampaign()
    return {
      action: 'create_campaign',
      status: 'success',
      campaignId: `camp_${Date.now()}_stub`,
      slug: input.slug,
      offerUrl: `/offers/${input.slug}`,
      message: `Campaign "${input.headline}" created. Activate it to make it live.`,
    };
  }

  private async activateCampaign(input: OutreachOpsInput, context: SkillExecutionContext) {
    if (!input.campaignId) {
      return { action: 'activate_campaign', status: 'error', message: 'campaignId is required' };
    }

    // Stub: would call OffersService.activateCampaign()
    return {
      action: 'activate_campaign',
      status: 'success',
      campaignId: input.campaignId,
      message: 'Campaign is now live and accepting leads',
    };
  }

  private async pauseCampaign(input: OutreachOpsInput, context: SkillExecutionContext) {
    if (!input.campaignId) {
      return { action: 'pause_campaign', status: 'error', message: 'campaignId is required' };
    }

    // Stub: would call OffersService.pauseCampaign()
    return {
      action: 'pause_campaign',
      status: 'success',
      campaignId: input.campaignId,
      message: 'Campaign has been paused',
    };
  }

  private async getCampaignStats(input: OutreachOpsInput) {
    if (!input.campaignId) {
      return { action: 'get_campaign_stats', status: 'error', message: 'campaignId is required' };
    }

    // Stub: would call OffersService.getCampaignStats()
    return {
      action: 'get_campaign_stats',
      status: 'success',
      stats: {
        totalLeads: 25,
        newLeads: 5,
        contactedLeads: 10,
        qualifiedLeads: 7,
        convertedLeads: 3,
        conversionRate: 12.0,
        leadsWithConsent: 20,
      },
      message: 'Campaign statistics retrieved',
    };
  }

  private async getLeads(input: OutreachOpsInput) {
    if (!input.campaignId) {
      return { action: 'get_leads', status: 'error', message: 'campaignId is required' };
    }

    // Stub: would call OfferLeadsService.getLeadsForCampaign()
    return {
      action: 'get_leads',
      status: 'success',
      leads: [
        { id: 'lead_1', name: 'John Smith', status: 'NEW', hasConsent: true },
        { id: 'lead_2', name: 'Jane Doe', status: 'CONTACTED', hasConsent: true },
      ],
      total: 2,
      message: 'Leads retrieved',
    };
  }

  private async updateLeadStatus(input: OutreachOpsInput, context: SkillExecutionContext) {
    if (!input.leadId || !input.leadStatus) {
      return {
        action: 'update_lead_status',
        status: 'error',
        message: 'leadId and leadStatus are required',
      };
    }

    // Stub: would call OfferLeadsService.updateLeadStatus()
    return {
      action: 'update_lead_status',
      status: 'success',
      leadId: input.leadId,
      newStatus: input.leadStatus,
      message: `Lead status updated to ${input.leadStatus}`,
    };
  }

  private async recordFollowUp(input: OutreachOpsInput, context: SkillExecutionContext) {
    if (!input.leadId) {
      return { action: 'record_follow_up', status: 'error', message: 'leadId is required' };
    }

    // Stub: would call OfferLeadsService.recordFollowUp()
    return {
      action: 'record_follow_up',
      status: 'success',
      leadId: input.leadId,
      followUpCount: 2,
      maxFollowUps: 3,
      notes: input.notes ?? 'Follow-up recorded',
      message: 'Follow-up contact recorded (2 of 3 max)',
    };
  }

  private async getFollowUpQueue() {
    // Stub: would call OfferLeadsService.getLeadsRequiringFollowUp()
    return {
      action: 'get_follow_up_queue',
      status: 'success',
      queue: [
        { id: 'lead_3', name: 'Bob Wilson', campaign: 'Spring Special', daysSinceLastContact: 2 },
        { id: 'lead_4', name: 'Alice Brown', campaign: 'Spring Special', daysSinceLastContact: 3 },
      ],
      message: '2 leads need follow-up',
    };
  }

  private async checkCompliance(input: OutreachOpsInput) {
    if (!input.campaignId) {
      return { action: 'check_compliance', status: 'error', message: 'campaignId is required' };
    }

    // Stub: would call OfferComplianceService
    return {
      action: 'check_compliance',
      status: 'success',
      compliance: {
        isCompliant: true,
        complianceScore: 95,
        issues: [],
        recommendations: ['Consider adding terms and conditions text'],
      },
      message: 'Campaign is compliant with a score of 95/100',
    };
  }

  private async processOptOut(input: OutreachOpsInput, context: SkillExecutionContext) {
    if (!input.email) {
      return { action: 'process_opt_out', status: 'error', message: 'email is required' };
    }

    // Stub: would call OfferComplianceService.processOptOut()
    return {
      action: 'process_opt_out',
      status: 'success',
      email: input.email,
      leadsUpdated: 2,
      message: `Marketing opt-out processed for ${input.email}. 2 lead records updated.`,
    };
  }
}

export { OutreachOpsInputSchema };
