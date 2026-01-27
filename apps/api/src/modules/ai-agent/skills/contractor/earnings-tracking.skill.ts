import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for EarningsTracking skill
 */
const EarningsTrackingInputSchema = z.object({
  action: z.enum(['GET_SUMMARY', 'GET_DETAILS', 'GET_PAYOUTS', 'GET_PROJECTIONS']),
  period: z.enum(['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM']).optional().default('THIS_WEEK'),
  customDateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  includeBreakdown: z.boolean().optional().default(true),
});

type EarningsTrackingInput = z.infer<typeof EarningsTrackingInputSchema>;

/**
 * Earnings breakdown by category
 */
interface EarningsBreakdown {
  laborEarnings: number;
  tips: number;
  bonuses: number;
  deductions: {
    platformFee: number;
    taxes: number;
    other: number;
  };
  netEarnings: number;
}

/**
 * Job earnings detail
 */
interface JobEarning {
  jobId: string;
  date: string;
  serviceType: string;
  customerName: string;
  grossAmount: number;
  netAmount: number;
  status: 'PENDING' | 'PROCESSED' | 'PAID';
  tip?: number;
}

/**
 * Payout record
 */
interface PayoutRecord {
  payoutId: string;
  date: string;
  amount: number;
  status: 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  method: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * EarningsTracking Skill
 *
 * Tracks contractor earnings, payouts, and financial projections.
 * Used by Earnings Optimizer agent.
 */
export class EarningsTrackingSkill extends BaseSkill {
  readonly name = 'EarningsTracking';
  readonly description = 'Track earnings, view payout history, and get financial projections for contractors';
  readonly requiredFlags = [];
  readonly requiredPermissions = ['contractor:earnings'];
  readonly inputSchema: SkillInputSchema = EarningsTrackingInputSchema;

  protected async executeInternal(
    input: EarningsTrackingInput,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    period: string;
    summary?: {
      grossEarnings: number;
      netEarnings: number;
      jobsCompleted: number;
      averagePerJob: number;
      comparisonToPrevious: {
        percentChange: number;
        direction: 'UP' | 'DOWN' | 'SAME';
      };
    };
    breakdown?: EarningsBreakdown;
    jobEarnings?: JobEarning[];
    payouts?: PayoutRecord[];
    projections?: {
      estimatedWeekly: number;
      estimatedMonthly: number;
      potentialWithMoreHours: number;
      topEarningServiceType: string;
    };
    message: string;
  }> {
    this.logger.debug('Processing earnings action', { action: input.action, period: input.period });

    const dateRange = this.getDateRange(input.period, input.customDateRange as { start: string; end: string } | undefined);

    switch (input.action) {
      case 'GET_SUMMARY':
        return this.getSummary(dateRange, input.includeBreakdown, context);
      case 'GET_DETAILS':
        return this.getDetails(dateRange, context);
      case 'GET_PAYOUTS':
        return this.getPayouts(dateRange, context);
      case 'GET_PROJECTIONS':
        return this.getProjections(context);
      default:
        return {
          action: input.action,
          success: false,
          period: input.period,
          message: 'Unknown action',
        };
    }
  }

  private getDateRange(
    period: string,
    customRange?: { start: string; end: string },
  ): { start: Date; end: Date; label: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case 'TODAY':
        return { start: today, end: now, label: 'Today' };
      case 'THIS_WEEK': {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return { start: weekStart, end: now, label: 'This Week' };
      }
      case 'THIS_MONTH': {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: monthStart, end: now, label: 'This Month' };
      }
      case 'LAST_MONTH': {
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return { start: lastMonthStart, end: lastMonthEnd, label: 'Last Month' };
      }
      case 'CUSTOM':
        if (customRange) {
          return {
            start: new Date(customRange.start),
            end: new Date(customRange.end),
            label: 'Custom Period',
          };
        }
        // Fall through to default if customRange not provided
        return { start: today, end: now, label: 'Today' };
      default:
        return { start: today, end: now, label: 'Today' };
    }
  }

  private async getSummary(
    dateRange: { start: Date; end: Date; label: string },
    includeBreakdown: boolean,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    period: string;
    summary: {
      grossEarnings: number;
      netEarnings: number;
      jobsCompleted: number;
      averagePerJob: number;
      comparisonToPrevious: {
        percentChange: number;
        direction: 'UP' | 'DOWN' | 'SAME';
      };
    };
    breakdown?: EarningsBreakdown;
    message: string;
  }> {
    // Generate mock earnings data
    const jobsCompleted = Math.floor(Math.random() * 15) + 5;
    const averagePerJob = 95 + Math.random() * 60;
    const grossEarnings = Math.round(jobsCompleted * averagePerJob * 100) / 100;

    const platformFee = Math.round(grossEarnings * 0.15 * 100) / 100;
    const taxes = Math.round(grossEarnings * 0.05 * 100) / 100;
    const tips = Math.round(jobsCompleted * (Math.random() * 10) * 100) / 100;
    const bonuses = Math.random() > 0.7 ? Math.round(Math.random() * 50 * 100) / 100 : 0;

    const netEarnings = Math.round((grossEarnings - platformFee - taxes + tips + bonuses) * 100) / 100;

    const percentChange = Math.round((Math.random() * 30 - 10) * 10) / 10;

    const result: {
      action: string;
      success: boolean;
      period: string;
      summary: {
        grossEarnings: number;
        netEarnings: number;
        jobsCompleted: number;
        averagePerJob: number;
        comparisonToPrevious: {
          percentChange: number;
          direction: 'UP' | 'DOWN' | 'SAME';
        };
      };
      breakdown?: EarningsBreakdown;
      message: string;
    } = {
      action: 'GET_SUMMARY',
      success: true,
      period: dateRange.label,
      summary: {
        grossEarnings,
        netEarnings,
        jobsCompleted,
        averagePerJob: Math.round(averagePerJob * 100) / 100,
        comparisonToPrevious: {
          percentChange: Math.abs(percentChange),
          direction: percentChange > 1 ? 'UP' : percentChange < -1 ? 'DOWN' : 'SAME',
        },
      },
      message: `${dateRange.label}: $${netEarnings.toFixed(2)} net earnings from ${jobsCompleted} jobs`,
    };

    if (includeBreakdown) {
      result.breakdown = {
        laborEarnings: grossEarnings,
        tips,
        bonuses,
        deductions: {
          platformFee,
          taxes,
          other: 0,
        },
        netEarnings,
      };
    }

    return result;
  }

  private async getDetails(
    dateRange: { start: Date; end: Date; label: string },
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    period: string;
    jobEarnings: JobEarning[];
    message: string;
  }> {
    // Generate mock job earnings
    const serviceTypes = ['PLUMBING', 'ELECTRICAL', 'HVAC', 'GENERAL'];
    const firstNames = ['John', 'Sarah', 'Mike', 'Emily', 'David', 'Lisa'];
    const jobEarnings: JobEarning[] = [];

    const numJobs = Math.floor(Math.random() * 10) + 3;
    const currentDate = new Date(dateRange.end);

    for (let i = 0; i < numJobs; i++) {
      const grossAmount = 80 + Math.random() * 120;
      const tip = Math.random() > 0.5 ? Math.round(Math.random() * 20 * 100) / 100 : undefined;
      const netAmount = Math.round((grossAmount * 0.85 + (tip || 0)) * 100) / 100;

      jobEarnings.push({
        jobId: `job_${Date.now()}_${i}`,
        date: new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        serviceType: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
        customerName: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.`,
        grossAmount: Math.round(grossAmount * 100) / 100,
        netAmount,
        status: i === 0 ? 'PENDING' : (Math.random() > 0.3 ? 'PAID' : 'PROCESSED'),
        tip,
      });
    }

    const totalNet = jobEarnings.reduce((sum, j) => sum + j.netAmount, 0);

    return {
      action: 'GET_DETAILS',
      success: true,
      period: dateRange.label,
      jobEarnings,
      message: `${jobEarnings.length} jobs totaling $${totalNet.toFixed(2)} net`,
    };
  }

  private async getPayouts(
    dateRange: { start: Date; end: Date; label: string },
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    period: string;
    payouts: PayoutRecord[];
    message: string;
  }> {
    // Generate mock payout records
    const payouts: PayoutRecord[] = [];
    const numPayouts = Math.floor(Math.random() * 4) + 1;
    const currentDate = new Date();

    for (let i = 0; i < numPayouts; i++) {
      const payoutDate = new Date(currentDate.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const periodEnd = new Date(payoutDate.getTime() - 24 * 60 * 60 * 1000);
      const periodStart = new Date(periodEnd.getTime() - 6 * 24 * 60 * 60 * 1000);

      payouts.push({
        payoutId: `payout_${Date.now()}_${i}`,
        date: payoutDate.toISOString().split('T')[0],
        amount: Math.round((500 + Math.random() * 800) * 100) / 100,
        status: i === 0 ? 'SCHEDULED' : 'COMPLETED',
        method: 'Direct Deposit',
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      });
    }

    const totalPaid = payouts.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = payouts.filter(p => p.status === 'SCHEDULED').reduce((sum, p) => sum + p.amount, 0);

    return {
      action: 'GET_PAYOUTS',
      success: true,
      period: dateRange.label,
      payouts,
      message: `${payouts.length} payouts. Total paid: $${totalPaid.toFixed(2)}. Pending: $${pendingAmount.toFixed(2)}`,
    };
  }

  private async getProjections(context: SkillExecutionContext): Promise<{
    action: string;
    success: boolean;
    period: string;
    projections: {
      estimatedWeekly: number;
      estimatedMonthly: number;
      potentialWithMoreHours: number;
      topEarningServiceType: string;
    };
    message: string;
  }> {
    const weeklyAverage = 800 + Math.random() * 400;
    const monthlyEstimate = weeklyAverage * 4.33;
    const potentialIncrease = weeklyAverage * 1.3;

    return {
      action: 'GET_PROJECTIONS',
      success: true,
      period: 'Projections',
      projections: {
        estimatedWeekly: Math.round(weeklyAverage * 100) / 100,
        estimatedMonthly: Math.round(monthlyEstimate * 100) / 100,
        potentialWithMoreHours: Math.round(potentialIncrease * 100) / 100,
        topEarningServiceType: 'PLUMBING',
      },
      message: `Based on your recent activity, you could earn up to $${Math.round(monthlyEstimate)} this month. Adding 5 more hours/week could increase earnings to $${Math.round(potentialIncrease)}/week.`,
    };
  }
}

export { EarningsTrackingInputSchema };
