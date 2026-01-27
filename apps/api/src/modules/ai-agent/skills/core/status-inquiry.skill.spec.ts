import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusInquirySkill } from './status-inquiry.skill';

describe('StatusInquirySkill', () => {
  let skill: StatusInquirySkill;

  beforeEach(() => {
    vi.clearAllMocks();
    skill = new StatusInquirySkill();
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(skill.name).toBe('StatusInquiry');
    });

    it('should have required permissions', () => {
      expect(skill.requiredPermissions).toContain('booking:read');
      expect(skill.requiredPermissions).toContain('dispatch:read');
    });

    it('should have input schema', () => {
      expect(skill.inputSchema).toBeDefined();
    });
  });

  describe('execute', () => {
    const mockContext = {
      sessionId: 'session_123',
      userId: 'user_456',
      orgId: 'org_789',
      permissions: ['booking:read', 'dispatch:read'],
      flags: {},
    };

    it('should return job status by entity ID', async () => {
      const result = await skill.execute(
        {
          entityType: 'JOB',
          entityId: 'job_123',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.entityId).toBe('job_123');
      expect(result.data.entityType).toBe('JOB');
      expect(result.data.currentStatus).toBeDefined();
    });

    it('should return booking status', async () => {
      const result = await skill.execute(
        {
          entityType: 'BOOKING',
          entityId: 'booking_456',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.entityType).toBe('BOOKING');
      expect(result.data.currentStatus).toBeDefined();
    });

    it('should return dispatch status', async () => {
      const result = await skill.execute(
        {
          entityType: 'DISPATCH',
          entityId: 'dispatch_789',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.entityType).toBe('DISPATCH');
    });

    it('should return payment status', async () => {
      const result = await skill.execute(
        {
          entityType: 'PAYMENT',
          entityId: 'payment_101',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.entityType).toBe('PAYMENT');
    });

    it('should include timeline when includeHistory is true', async () => {
      const result = await skill.execute(
        {
          entityType: 'JOB',
          entityId: 'job_with_history',
          includeHistory: true,
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.timeline).toBeDefined();
      expect(Array.isArray(result.data.timeline)).toBe(true);
    });

    it('should include details when includeDetails is true', async () => {
      const result = await skill.execute(
        {
          entityType: 'JOB',
          entityId: 'job_with_details',
          includeDetails: true,
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.details).toBeDefined();
    });

    it('should include status description', async () => {
      const result = await skill.execute(
        {
          entityType: 'JOB',
          entityId: 'job_123',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.statusDescription).toBeDefined();
      expect(typeof result.data.statusDescription).toBe('string');
    });

    it('should include lastUpdated timestamp', async () => {
      const result = await skill.execute(
        {
          entityType: 'JOB',
          entityId: 'job_123',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.lastUpdated).toBeDefined();
    });

    it('should handle validation error for missing entityType', async () => {
      const result = await skill.execute(
        {
          entityId: 'job_123',
        } as any,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle validation error for invalid entityType', async () => {
      const result = await skill.execute(
        {
          entityType: 'INVALID_TYPE',
          entityId: 'job_123',
        } as any,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
