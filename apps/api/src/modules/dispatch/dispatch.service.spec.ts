import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DispatchService } from './dispatch.service';

describe('DispatchService', () => {
  let service: DispatchService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockPolicy: any;
  let mockAudit: any;
  let mockMatching: any;
  let mockRanking: any;
  let mockEscalation: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      job: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      dispatchAttempt: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      dispatchAssignment: {
        create: vi.fn(),
      },
      declineReason: {
        findUnique: vi.fn(),
      },
      proProfile: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
    };

    mockPolicy = {
      getValue: vi.fn(),
    };

    mockAudit = {
      log: vi.fn(),
    };

    mockMatching = {
      findMatchingPros: vi.fn(),
      getDispatchedProIds: vi.fn(),
    };

    mockRanking = {
      rankPros: vi.fn(),
      getProsForEscalationStep: vi.fn(),
    };

    mockEscalation = {
      hasReachedMaxAttempts: vi.fn(),
      getCurrentEscalationStep: vi.fn(),
      getEscalationSteps: vi.fn(),
      shouldEscalate: vi.fn(),
      escalate: vi.fn(),
    };

    // Directly instantiate the service with mocks
    service = new DispatchService(
      mockPrisma,
      mockRedis,
      mockPolicy,
      mockAudit,
      mockMatching,
      mockRanking,
      mockEscalation,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSlaAcceptMinutes', () => {
    it('should return policy value for SLA accept minutes', async () => {
      mockPolicy.getValue.mockResolvedValue(10);

      const result = await service.getSlaAcceptMinutes('category-1');

      expect(result).toBe(10);
    });

    it('should return default value when policy fails', async () => {
      mockPolicy.getValue.mockRejectedValue(new Error('Policy not found'));

      const result = await service.getSlaAcceptMinutes();

      expect(result).toBe(5); // Default from DEFAULT_POLICIES
    });
  });

  describe('initiateDispatch', () => {
    const mockJob = {
      id: 'job-123',
      status: 'DRAFT',
      serviceCategoryId: 'electrical',
      serviceLat: 43.8971,
      serviceLng: -79.4428,
      dispatchAttempts: [],
      dispatchAssignment: null,
    };

    const mockMatchingPros = [
      { id: 'pro-1', distance: 5, score: 90 },
      { id: 'pro-2', distance: 8, score: 85 },
    ];

    it('should initiate dispatch successfully', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockEscalation.hasReachedMaxAttempts.mockResolvedValue(false);
      mockMatching.findMatchingPros.mockResolvedValue(mockMatchingPros);
      mockMatching.getDispatchedProIds.mockResolvedValue([]);
      mockRanking.rankPros.mockReturnValue(mockMatchingPros);
      mockEscalation.getCurrentEscalationStep.mockResolvedValue(1);
      mockEscalation.getEscalationSteps.mockResolvedValue([1, 2, 5]);
      mockRanking.getProsForEscalationStep.mockReturnValue([mockMatchingPros[0]]);
      mockPolicy.getValue.mockResolvedValue(5);
      mockPrisma.dispatchAttempt.create.mockResolvedValue({
        id: 'attempt-1',
        jobId: 'job-123',
        proProfileId: 'pro-1',
        attemptNumber: 1,
        status: 'PENDING',
        dispatchedAt: new Date(),
        slaDeadline: new Date(Date.now() + 300000),
        ranking: 90,
        distance: 5,
        createdAt: new Date(),
      });
      mockPrisma.job.update.mockResolvedValue({});

      const result = await service.initiateDispatch('job-123', 'operator-1');

      expect(result.success).toBe(true);
      expect(result.matchingProsCount).toBe(2);
      expect(mockPrisma.dispatchAttempt.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      await expect(service.initiateDispatch('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid job status', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ...mockJob,
        status: 'COMPLETED',
      });

      await expect(service.initiateDispatch('job-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException for already assigned job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ...mockJob,
        dispatchAssignment: { id: 'assignment-1' },
      });

      await expect(service.initiateDispatch('job-123')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when max attempts reached', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockEscalation.hasReachedMaxAttempts.mockResolvedValue(true);

      await expect(service.initiateDispatch('job-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return failure when no matching pros found', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockEscalation.hasReachedMaxAttempts.mockResolvedValue(false);
      mockMatching.findMatchingPros.mockResolvedValue([]);

      const result = await service.initiateDispatch('job-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('No matching pros');
    });

    it('should return failure when all pros already dispatched', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockEscalation.hasReachedMaxAttempts.mockResolvedValue(false);
      mockMatching.findMatchingPros.mockResolvedValue(mockMatchingPros);
      mockMatching.getDispatchedProIds.mockResolvedValue(['pro-1', 'pro-2']);

      const result = await service.initiateDispatch('job-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('All matching pros have already been dispatched');
    });
  });

  describe('acceptDispatch', () => {
    const mockAttempt = {
      id: 'attempt-1',
      jobId: 'job-123',
      proProfileId: 'pro-1',
      status: 'PENDING',
      attemptNumber: 1,
      dispatchedAt: new Date(),
      slaDeadline: new Date(Date.now() + 300000), // 5 minutes from now
      job: {
        id: 'job-123',
        status: 'DISPATCHED',
      },
    };

    it('should accept dispatch successfully', async () => {
      mockPrisma.dispatchAttempt.findFirst.mockResolvedValue(mockAttempt);
      mockPrisma.dispatchAttempt.update.mockResolvedValue({
        ...mockAttempt,
        status: 'ACCEPTED',
        respondedAt: new Date(),
      });
      mockPrisma.dispatchAssignment.create.mockResolvedValue({});
      mockPrisma.job.update.mockResolvedValue({});
      mockPrisma.dispatchAttempt.updateMany.mockResolvedValue({});
      mockPrisma.proProfile.findUnique.mockResolvedValue({
        avgResponseMinutes: 3,
        totalJobsCompleted: 10,
      });
      mockPrisma.proProfile.update.mockResolvedValue({});

      const result = await service.acceptDispatch('job-123', 'pro-1', 'user-1');

      expect(result.success).toBe(true);
      expect(mockPrisma.dispatchAssignment.create).toHaveBeenCalled();
      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACCEPTED',
          }),
        }),
      );
    });

    it('should throw NotFoundException when no pending dispatch found', async () => {
      mockPrisma.dispatchAttempt.findFirst.mockResolvedValue(null);

      await expect(service.acceptDispatch('job-123', 'pro-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when SLA has expired', async () => {
      mockPrisma.dispatchAttempt.findFirst.mockResolvedValue({
        ...mockAttempt,
        slaDeadline: new Date(Date.now() - 60000), // 1 minute ago
      });

      await expect(service.acceptDispatch('job-123', 'pro-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when job is no longer available', async () => {
      mockPrisma.dispatchAttempt.findFirst.mockResolvedValue({
        ...mockAttempt,
        job: { ...mockAttempt.job, status: 'ACCEPTED' },
      });

      await expect(service.acceptDispatch('job-123', 'pro-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should cancel other pending dispatch attempts', async () => {
      mockPrisma.dispatchAttempt.findFirst.mockResolvedValue(mockAttempt);
      mockPrisma.dispatchAttempt.update.mockResolvedValue({
        ...mockAttempt,
        status: 'ACCEPTED',
      });
      mockPrisma.dispatchAssignment.create.mockResolvedValue({});
      mockPrisma.job.update.mockResolvedValue({});
      mockPrisma.dispatchAttempt.updateMany.mockResolvedValue({});
      mockPrisma.proProfile.findUnique.mockResolvedValue({
        avgResponseMinutes: 3,
        totalJobsCompleted: 10,
      });
      mockPrisma.proProfile.update.mockResolvedValue({});

      await service.acceptDispatch('job-123', 'pro-1');

      expect(mockPrisma.dispatchAttempt.updateMany).toHaveBeenCalledWith({
        where: {
          jobId: 'job-123',
          id: { not: 'attempt-1' },
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          respondedAt: expect.any(Date),
        },
      });
    });
  });

  describe('declineDispatch', () => {
    const mockAttempt = {
      id: 'attempt-1',
      jobId: 'job-123',
      proProfileId: 'pro-1',
      status: 'PENDING',
      attemptNumber: 1,
      dispatchedAt: new Date(),
      job: {
        id: 'job-123',
        status: 'DISPATCHED',
      },
    };

    const mockDeclineReason = {
      id: 'reason-1',
      code: 'TOO_FAR',
      label: 'Too far away',
    };

    it('should decline dispatch successfully', async () => {
      mockPrisma.dispatchAttempt.findFirst.mockResolvedValue(mockAttempt);
      mockPrisma.declineReason.findUnique.mockResolvedValue(mockDeclineReason);
      mockPrisma.dispatchAttempt.update.mockResolvedValue({
        ...mockAttempt,
        status: 'DECLINED',
        declineReasonId: 'reason-1',
      });
      mockPrisma.job.findUnique.mockResolvedValue({ status: 'DISPATCHED' });
      mockEscalation.shouldEscalate.mockResolvedValue({ shouldEscalate: false });

      const result = await service.declineDispatch(
        'job-123',
        'pro-1',
        'reason-1',
        'Too far',
        'user-1',
      );

      expect(result.success).toBe(true);
      expect(mockAudit.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException when no pending dispatch found', async () => {
      mockPrisma.dispatchAttempt.findFirst.mockResolvedValue(null);

      await expect(
        service.declineDispatch('job-123', 'pro-1', 'reason-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when decline reason not found', async () => {
      mockPrisma.dispatchAttempt.findFirst.mockResolvedValue(mockAttempt);
      mockPrisma.declineReason.findUnique.mockResolvedValue(null);

      await expect(
        service.declineDispatch('job-123', 'pro-1', 'invalid-reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should check for escalation after decline', async () => {
      mockPrisma.dispatchAttempt.findFirst.mockResolvedValue(mockAttempt);
      mockPrisma.declineReason.findUnique.mockResolvedValue(mockDeclineReason);
      mockPrisma.dispatchAttempt.update.mockResolvedValue({
        ...mockAttempt,
        status: 'DECLINED',
      });
      mockPrisma.job.findUnique.mockResolvedValue({ status: 'DISPATCHED' });
      mockEscalation.shouldEscalate.mockResolvedValue({
        shouldEscalate: true,
        reason: 'Max attempts reached',
      });

      await service.declineDispatch('job-123', 'pro-1', 'reason-1');

      expect(mockEscalation.shouldEscalate).toHaveBeenCalledWith('job-123');
      expect(mockEscalation.escalate).toHaveBeenCalledWith('job-123');
    });
  });

  describe('handleTimeout', () => {
    it('should handle timeout and update attempt status', async () => {
      const mockAttempt = {
        id: 'attempt-1',
        jobId: 'job-123',
        proProfileId: 'pro-1',
        status: 'PENDING',
        attemptNumber: 1,
        slaDeadline: new Date(),
        job: { status: 'DISPATCHED' },
      };

      mockPrisma.dispatchAttempt.findUnique.mockResolvedValue(mockAttempt);
      mockPrisma.dispatchAttempt.update.mockResolvedValue({
        ...mockAttempt,
        status: 'TIMEOUT',
      });
      mockPrisma.job.findUnique.mockResolvedValue({ status: 'DISPATCHED' });
      mockEscalation.shouldEscalate.mockResolvedValue({ shouldEscalate: false });

      await service.handleTimeout('job-123', 'attempt-1');

      expect(mockPrisma.dispatchAttempt.update).toHaveBeenCalledWith({
        where: { id: 'attempt-1' },
        data: {
          status: 'TIMEOUT',
          respondedAt: expect.any(Date),
        },
      });
    });

    it('should skip timeout handling if attempt not found', async () => {
      mockPrisma.dispatchAttempt.findUnique.mockResolvedValue(null);

      await service.handleTimeout('job-123', 'attempt-1');

      expect(mockPrisma.dispatchAttempt.update).not.toHaveBeenCalled();
    });

    it('should skip timeout handling if attempt is no longer pending', async () => {
      mockPrisma.dispatchAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        status: 'ACCEPTED', // Already accepted
        job: { status: 'ACCEPTED' },
      });

      await service.handleTimeout('job-123', 'attempt-1');

      expect(mockPrisma.dispatchAttempt.update).not.toHaveBeenCalled();
    });
  });

  describe('getDispatchAttempts', () => {
    it('should return dispatch history for a job', async () => {
      const mockJob = {
        id: 'job-123',
        dispatchAttempts: [
          {
            id: 'attempt-1',
            jobId: 'job-123',
            proProfileId: 'pro-1',
            attemptNumber: 1,
            status: 'DECLINED',
            dispatchedAt: new Date(),
            respondedAt: new Date(),
            slaDeadline: new Date(),
            proProfile: {
              id: 'pro-1',
              businessName: 'Pro Business',
              businessPhone: '555-1234',
              user: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
            },
            declineReason: { code: 'TOO_FAR', label: 'Too far away' },
          },
          {
            id: 'attempt-2',
            jobId: 'job-123',
            proProfileId: 'pro-2',
            attemptNumber: 2,
            status: 'ACCEPTED',
            dispatchedAt: new Date(),
            respondedAt: new Date(),
            slaDeadline: new Date(),
            proProfile: {
              id: 'pro-2',
              businessName: 'Pro Business 2',
              businessPhone: '555-5678',
              user: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
            },
            declineReason: null,
          },
        ],
        dispatchAssignment: {
          id: 'assignment-1',
          proProfileId: 'pro-2',
          assignedAt: new Date(),
          isManual: false,
          proProfile: {
            id: 'pro-2',
            businessName: 'Pro Business 2',
            user: { firstName: 'Jane', lastName: 'Doe' },
          },
        },
      };

      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockEscalation.getCurrentEscalationStep.mockResolvedValue(2);

      const result = await service.getDispatchAttempts('job-123');

      expect(result.jobId).toBe('job-123');
      expect(result.totalAttempts).toBe(2);
      expect(result.currentEscalationStep).toBe(2);
      expect(result.attempts).toHaveLength(2);
      expect(result.assignment).not.toBeNull();
    });

    it('should throw NotFoundException for non-existent job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      await expect(service.getDispatchAttempts('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActiveDispatch', () => {
    it('should return pending dispatches for a pro', async () => {
      const mockAttempts = [
        {
          id: 'attempt-1',
          jobId: 'job-123',
          proProfileId: 'pro-1',
          attemptNumber: 1,
          status: 'PENDING',
          dispatchedAt: new Date(),
          slaDeadline: new Date(Date.now() + 300000),
          job: {
            id: 'job-123',
            jobNumber: 'JOB-001',
            title: 'Electrical repair',
            description: 'Fix outlet',
            serviceAddressLine1: '123 Main St',
            serviceCity: 'Toronto',
            serviceProvince: 'ON',
            servicePostalCode: 'M1M 1M1',
            urgency: 'MEDIUM',
            preferredDateStart: new Date(),
            preferredDateEnd: new Date(),
            serviceCategory: {
              id: 'electrical',
              name: 'Electrical',
              code: 'ELECTRICAL',
            },
          },
        },
      ];

      mockPrisma.dispatchAttempt.findMany.mockResolvedValue(mockAttempts);

      const result = await service.getActiveDispatch('pro-1');

      expect(result).toHaveLength(1);
      expect(result[0].dispatch.id).toBe('attempt-1');
      expect(result[0].job.id).toBe('job-123');
      expect(result[0].timeRemaining).toBeGreaterThan(0);
    });
  });

  describe('getTimedOutAttempts', () => {
    it('should return all timed out attempts', async () => {
      const mockAttempts = [
        {
          id: 'attempt-1',
          status: 'PENDING',
          slaDeadline: new Date(Date.now() - 60000),
          job: { id: 'job-123' },
          proProfile: { id: 'pro-1' },
        },
      ];

      mockPrisma.dispatchAttempt.findMany.mockResolvedValue(mockAttempts);

      const result = await service.getTimedOutAttempts();

      expect(result).toHaveLength(1);
      expect(mockPrisma.dispatchAttempt.findMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          slaDeadline: { lt: expect.any(Date) },
        },
        include: { job: true, proProfile: true },
      });
    });
  });
});
