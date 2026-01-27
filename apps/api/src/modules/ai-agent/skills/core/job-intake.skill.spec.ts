import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobIntakeSkill } from './job-intake.skill';

describe('JobIntakeSkill', () => {
  let skill: JobIntakeSkill;

  beforeEach(() => {
    vi.clearAllMocks();
    skill = new JobIntakeSkill();
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(skill.name).toBe('JobIntake');
    });

    it('should have required permissions', () => {
      expect(skill.requiredPermissions).toContain('booking:read');
    });

    it('should have required flags', () => {
      expect(skill.requiredFlags).toContain('BOOKING_ENABLED');
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
      permissions: ['booking:read'],
      flags: { BOOKING_ENABLED: true },
    };

    it('should collect basic job requirements', async () => {
      const result = await skill.execute(
        {
          serviceType: 'PLUMBING',
          description: 'Leaking faucet in kitchen',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.summary.serviceType).toBe('PLUMBING');
      expect(result.data.summary.description).toBe('Leaking faucet in kitchen');
    });

    it('should identify missing location info', async () => {
      const result = await skill.execute(
        {
          serviceType: 'PLUMBING',
          description: 'Fix leak',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.missingInfo).toContain('Service location address');
    });

    it('should identify missing contact info', async () => {
      const result = await skill.execute(
        {
          serviceType: 'PLUMBING',
          description: 'Fix leak',
          location: {
            address: '123 Main St',
          },
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.missingInfo).toContain('Contact phone or email');
    });

    it('should handle complete job intake', async () => {
      const result = await skill.execute(
        {
          serviceType: 'PLUMBING',
          description: 'Leaking faucet in kitchen',
          location: {
            address: '123 Main St',
            city: 'Toronto',
            postalCode: 'M5V 1A1',
          },
          contactInfo: {
            name: 'John Doe',
            phone: '416-555-1234',
            email: 'john@example.com',
          },
          preferredSchedule: {
            date: '2024-01-15',
            timeOfDay: 'MORNING',
          },
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.summary.hasLocation).toBe(true);
      expect(result.data.summary.hasContact).toBe(true);
      expect(result.data.summary.hasSchedulePreference).toBe(true);
      expect(result.data.missingInfo.length).toBe(0);
    });

    it('should handle urgent requests', async () => {
      const result = await skill.execute(
        {
          serviceType: 'PLUMBING',
          description: 'Burst pipe flooding basement',
          urgency: 'EMERGENCY',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.summary.urgency).toBe('EMERGENCY');
    });

    it('should default urgency to NORMAL', async () => {
      const result = await skill.execute(
        {
          serviceType: 'ELECTRICAL',
          description: 'Outlet not working',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.summary.urgency).toBe('NORMAL');
    });

    it('should include next steps', async () => {
      const result = await skill.execute(
        {
          serviceType: 'HVAC',
          description: 'AC not cooling',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.nextSteps).toBeDefined();
      expect(Array.isArray(result.data.nextSteps)).toBe(true);
    });

    it('should generate job intake ID', async () => {
      const result = await skill.execute(
        {
          serviceType: 'PLUMBING',
          description: 'Fix leak',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data.jobIntakeId).toBeDefined();
      expect(typeof result.data.jobIntakeId).toBe('string');
    });

    it('should handle special requirements', async () => {
      const result = await skill.execute(
        {
          serviceType: 'PLUMBING',
          description: 'Fix toilet',
          specialRequirements: ['Need licensed plumber', 'Pet-friendly'],
        },
        mockContext,
      );

      expect(result.success).toBe(true);
    });

    it('should validate required fields', async () => {
      const result = await skill.execute(
        {
          // Missing required serviceType and description
        } as any,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
