import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PolicyService } from '../feature-flags/policy.service';
import { AuditService } from '../audit/audit.service';
import { POLICY_KEYS, AUDIT_ACTIONS } from '@trades/shared';

/**
 * OfferComplianceService - Ensures compliant lead generation
 *
 * Handles:
 * - Marketing consent validation
 * - Follow-up limits
 * - Data retention compliance
 * - Opt-out processing
 */
@Injectable()
export class OfferComplianceService {
  private readonly logger = new Logger(OfferComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Check if a lead can be contacted for marketing
   */
  async canContactForMarketing(leadId: string): Promise<{
    canContact: boolean;
    reason?: string;
  }> {
    const lead = await this.prisma.offerLead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return { canContact: false, reason: 'Lead not found' };
    }

    if (!lead.marketingConsentGranted) {
      return { canContact: false, reason: 'Marketing consent not granted' };
    }

    // Check follow-up limits
    const maxFollowUps = await this.policyService.getValue<number>(
      POLICY_KEYS.OFFER_MAX_FOLLOWUPS,
      {},
    ) ?? 3;

    if (lead.followUpCount >= maxFollowUps) {
      return { canContact: false, reason: 'Maximum follow-up attempts reached' };
    }

    // Check if lead has been converted or lost
    if (lead.status === 'CONVERTED' || lead.status === 'LOST') {
      return { canContact: false, reason: `Lead status is ${lead.status}` };
    }

    return { canContact: true };
  }

  /**
   * Process opt-out request for a lead
   */
  async processOptOut(email: string, actorId?: string): Promise<{
    processed: number;
    leads: string[];
  }> {
    // Find all leads with this email
    const leads = await this.prisma.offerLead.findMany({
      where: { email: email.toLowerCase() },
    });

    const updatedLeadIds: string[] = [];

    for (const lead of leads) {
      if (lead.marketingConsentGranted) {
        await this.prisma.offerLead.update({
          where: { id: lead.id },
          data: {
            marketingConsentGranted: false,
            status: 'LOST',
          },
        });

        updatedLeadIds.push(lead.id);

        await this.auditService.log({
          action: AUDIT_ACTIONS.OFFER_LEAD_OPT_OUT,
          actorId,
          targetType: 'OfferLead',
          targetId: lead.id,
          details: { email },
        });
      }
    }

    this.logger.log(`Processed opt-out for ${email}: ${updatedLeadIds.length} leads updated`);

    return {
      processed: updatedLeadIds.length,
      leads: updatedLeadIds,
    };
  }

  /**
   * Get compliance report for a campaign
   */
  async getCampaignComplianceReport(campaignId: string): Promise<{
    totalLeads: number;
    withConsent: number;
    withoutConsent: number;
    optedOut: number;
    maxFollowUpsReached: number;
    averageFollowUps: number;
    complianceScore: number;
  }> {
    const leads = await this.prisma.offerLead.findMany({
      where: { campaignId },
    });

    const maxFollowUps = await this.policyService.getValue<number>(
      POLICY_KEYS.OFFER_MAX_FOLLOWUPS,
      {},
    ) ?? 3;

    const stats = {
      totalLeads: leads.length,
      withConsent: 0,
      withoutConsent: 0,
      optedOut: 0,
      maxFollowUpsReached: 0,
      totalFollowUps: 0,
    };

    for (const lead of leads) {
      if (lead.marketingConsentGranted) {
        stats.withConsent++;
      } else {
        stats.withoutConsent++;
      }

      if (lead.status === 'LOST' && !lead.marketingConsentGranted) {
        stats.optedOut++;
      }

      if (lead.followUpCount >= maxFollowUps) {
        stats.maxFollowUpsReached++;
      }

      stats.totalFollowUps += lead.followUpCount;
    }

    const averageFollowUps = stats.totalLeads > 0
      ? Math.round((stats.totalFollowUps / stats.totalLeads) * 100) / 100
      : 0;

    // Calculate compliance score (0-100)
    // Based on: consent rate, respecting opt-outs, not exceeding follow-up limits
    let complianceScore = 100;

    // Deduct for leads without consent (unless they opted out)
    const nonOptOutWithoutConsent = stats.withoutConsent - stats.optedOut;
    if (stats.totalLeads > 0 && nonOptOutWithoutConsent > 0) {
      complianceScore -= (nonOptOutWithoutConsent / stats.totalLeads) * 30;
    }

    // Deduct for exceeding follow-up limits
    if (stats.totalLeads > 0 && stats.maxFollowUpsReached > 0) {
      complianceScore -= (stats.maxFollowUpsReached / stats.totalLeads) * 20;
    }

    return {
      totalLeads: stats.totalLeads,
      withConsent: stats.withConsent,
      withoutConsent: stats.withoutConsent,
      optedOut: stats.optedOut,
      maxFollowUpsReached: stats.maxFollowUpsReached,
      averageFollowUps,
      complianceScore: Math.max(0, Math.round(complianceScore)),
    };
  }

  /**
   * Validate campaign configuration for compliance
   */
  async validateCampaignCompliance(campaignId: string): Promise<{
    isCompliant: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const campaign = await this.prisma.offerCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return {
        isCompliant: false,
        issues: ['Campaign not found'],
        recommendations: [],
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check required consent flag
    if (!campaign.requiresMarketingConsent) {
      recommendations.push('Consider requiring marketing consent for better compliance');
    }

    // Check for terms text
    if (!campaign.termsText) {
      recommendations.push('Add terms and conditions text for transparency');
    }

    // Check expiration date
    if (!campaign.expiresAt) {
      recommendations.push('Set an expiration date to limit offer validity');
    }

    // Check for proper offer value disclosure
    if (campaign.offerType === 'DISCOUNT_PERCENT' || campaign.offerType === 'DISCOUNT_FIXED') {
      if (!campaign.discountValue) {
        issues.push('Discount value not specified for discount offer type');
      }
    }

    return {
      isCompliant: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Archive old leads for data retention compliance
   */
  async archiveOldLeads(daysOld: number = 365): Promise<{
    archived: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Find leads older than cutoff that are LOST or CONVERTED
    const oldLeads = await this.prisma.offerLead.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: ['LOST', 'CONVERTED'] },
      },
    });

    // For compliance, we don't delete but anonymize
    for (const lead of oldLeads) {
      await this.prisma.offerLead.update({
        where: { id: lead.id },
        data: {
          email: `archived-${lead.id}@archived.local`,
          name: 'Archived',
          phone: null,
          address: null,
          notes: null,
          customFieldValues: {},
        },
      });

      await this.auditService.log({
        action: 'OFFER_LEAD_ARCHIVED',
        targetType: 'OfferLead',
        targetId: lead.id,
        details: { reason: 'Data retention policy' },
      });
    }

    this.logger.log(`Archived ${oldLeads.length} old leads`);

    return { archived: oldLeads.length };
  }
}
