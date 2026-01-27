import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportGenerationSkill } from './report-generation.skill';

describe('ReportGenerationSkill', () => {
  let skill: ReportGenerationSkill;

  beforeEach(() => {
    vi.clearAllMocks();
    skill = new ReportGenerationSkill();
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(skill.name).toBe('ReportGeneration');
    });

    it('should have required permissions', () => {
      expect(skill.requiredPermissions).toContain('analytics:view');
    });

    it('should have empty required flags', () => {
      expect(skill.requiredFlags).toEqual([]);
    });
  });

  describe('execute', () => {
    const mockContext = {
      sessionId: 'session_123',
      userId: 'user_456',
      orgId: 'org_789',
      permissions: ['analytics:view'],
      flags: {},
    };

    it('should generate executive summary report', async () => {
      const result = await skill.execute(
        {
          reportType: 'EXECUTIVE_SUMMARY',
          period: 'THIS_WEEK',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.report).toBeDefined();
      expect(result.data.report.reportType).toBe('EXECUTIVE_SUMMARY');
      expect(result.data.report.title).toBe('Executive Summary Report');
      expect(result.data.report.keyMetrics).toBeDefined();
      expect(result.data.report.insights).toBeDefined();
      expect(result.data.report.recommendations).toBeDefined();
    });

    it('should generate operational metrics report', async () => {
      const result = await skill.execute(
        {
          reportType: 'OPERATIONAL_METRICS',
          period: 'THIS_MONTH',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.report.reportType).toBe('OPERATIONAL_METRICS');
      expect(result.data.report.keyMetrics.length).toBeGreaterThan(0);
    });

    it('should generate financial performance report', async () => {
      const result = await skill.execute(
        {
          reportType: 'FINANCIAL_PERFORMANCE',
          period: 'LAST_MONTH',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.report.reportType).toBe('FINANCIAL_PERFORMANCE');

      // Should include revenue metrics
      const metrics = result.data.report.keyMetrics;
      expect(metrics.some((m: any) => m.label.includes('Revenue'))).toBe(true);
    });

    it('should generate customer satisfaction report', async () => {
      const result = await skill.execute(
        {
          reportType: 'CUSTOMER_SATISFACTION',
          period: 'THIS_WEEK',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.report.reportType).toBe('CUSTOMER_SATISFACTION');

      // Should include satisfaction metrics
      const metrics = result.data.report.keyMetrics;
      expect(metrics.some((m: any) => m.label.includes('Satisfaction') || m.label.includes('NPS'))).toBe(true);
    });

    it('should generate contractor performance report', async () => {
      const result = await skill.execute(
        {
          reportType: 'CONTRACTOR_PERFORMANCE',
          period: 'THIS_QUARTER',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.report.reportType).toBe('CONTRACTOR_PERFORMANCE');
    });

    it('should generate SLA compliance report', async () => {
      const result = await skill.execute(
        {
          reportType: 'SLA_COMPLIANCE',
          period: 'THIS_WEEK',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.report.reportType).toBe('SLA_COMPLIANCE');

      // Should include SLA metrics
      const metrics = result.data.report.keyMetrics;
      expect(metrics.some((m: any) => m.label.includes('SLA'))).toBe(true);
    });

    it('should generate capacity analysis report', async () => {
      const result = await skill.execute(
        {
          reportType: 'CAPACITY_ANALYSIS',
          period: 'THIS_MONTH',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.report.reportType).toBe('CAPACITY_ANALYSIS');
    });

    it('should include chart data when requested', async () => {
      const result = await skill.execute(
        {
          reportType: 'EXECUTIVE_SUMMARY',
          period: 'THIS_WEEK',
          includeChartData: true,
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.report.charts).toBeDefined();
      expect(result.data.report.charts.length).toBeGreaterThan(0);
    });

    it('should exclude chart data when not requested', async () => {
      const result = await skill.execute(
        {
          reportType: 'EXECUTIVE_SUMMARY',
          period: 'THIS_WEEK',
          includeChartData: false,
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.report.charts).toBeUndefined();
    });

    it('should handle custom date range', async () => {
      const result = await skill.execute(
        {
          reportType: 'EXECUTIVE_SUMMARY',
          period: 'CUSTOM',
          customDateRange: {
            start: '2024-01-01',
            end: '2024-01-31',
          },
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.report.period).toBe('Custom Period');
    });

    it('should apply region filter', async () => {
      const result = await skill.execute(
        {
          reportType: 'OPERATIONAL_METRICS',
          period: 'THIS_WEEK',
          filters: {
            region: 'Toronto',
          },
        },
        mockContext,
      );

      expect(result.success).toBe(true);
    });

    it('should include metric trends', async () => {
      const result = await skill.execute(
        {
          reportType: 'EXECUTIVE_SUMMARY',
          period: 'THIS_WEEK',
        },
        mockContext,
      );

      expect(result.success).toBe(true);

      result.data.report.keyMetrics.forEach((metric: any) => {
        expect(metric).toHaveProperty('trend');
        expect(['UP', 'DOWN', 'STABLE']).toContain(metric.trend);
        expect(metric).toHaveProperty('changePercent');
      });
    });

    it('should have report ID format', async () => {
      const result = await skill.execute(
        { reportType: 'EXECUTIVE_SUMMARY', period: 'TODAY' },
        mockContext,
      );

      expect(result.data.report.reportId).toBeDefined();
      expect(result.data.report.reportId).toMatch(/^report_\d+$/);
    });

    it('should have generatedAt timestamp', async () => {
      const result = await skill.execute(
        { reportType: 'EXECUTIVE_SUMMARY', period: 'TODAY' },
        mockContext,
      );

      expect(result.data.report.generatedAt).toBeDefined();
      // Should be valid ISO timestamp
      expect(() => new Date(result.data.report.generatedAt)).not.toThrow();
    });
  });
});
