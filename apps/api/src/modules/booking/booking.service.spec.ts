import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { BookingService } from './booking.service';

describe('BookingService', () => {
  let service: BookingService;
  let mockPrisma: any;
  let mockPolicy: any;
  let mockSlotComputation: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      job: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      booking: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      proProfile: {
        findUnique: vi.fn(),
      },
      preferredContractor: {
        findUnique: vi.fn(),
      },
      orgMember: {
        findFirst: vi.fn(),
      },
    };

    mockPolicy = {
      getValue: vi.fn(),
    };

    mockSlotComputation = {
      isSlotAvailable: vi.fn(),
    };

    // Directly instantiate the service with mocks
    service = new BookingService(mockPrisma, mockPolicy, mockSlotComputation);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createExactBooking', () => {
    const mockJob = {
      id: 'job-123',
      status: 'ACCEPTED',
      createdById: 'user-1',
      dispatchAssignment: { proProfileId: 'pro-1' },
    };

    const mockProProfile = {
      id: 'pro-1',
      isActive: true,
      user: { id: 'user-pro-1' },
    };

    const slotStart = new Date('2025-01-27T09:00:00Z');
    const slotEnd = new Date('2025-01-27T10:00:00Z');

    it('should create an exact booking successfully', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockPrisma.proProfile.findUnique.mockResolvedValue(mockProProfile);
      mockSlotComputation.isSlotAvailable.mockResolvedValue(true);
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        jobId: 'job-123',
        proProfileId: 'pro-1',
        mode: 'EXACT',
        status: 'CONFIRMED',
        slotStart,
        slotEnd,
      });
      mockPrisma.job.update.mockResolvedValue({});

      const result = await service.createExactBooking('job-123', 'pro-1', slotStart, slotEnd);

      expect(result.booking.status).toBe('CONFIRMED');
      expect(result.booking.mode).toBe('EXACT');
      expect(mockPrisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({ status: 'SCHEDULED' }),
      });
    });

    it('should throw NotFoundException for non-existent job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      await expect(
        service.createExactBooking('nonexistent', 'pro-1', slotStart, slotEnd),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for job not in ACCEPTED status', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ...mockJob,
        status: 'DRAFT',
      });

      await expect(
        service.createExactBooking('job-123', 'pro-1', slotStart, slotEnd),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent pro profile', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockPrisma.proProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.createExactBooking('job-123', 'nonexistent', slotStart, slotEnd),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for inactive pro profile', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockPrisma.proProfile.findUnique.mockResolvedValue({
        ...mockProProfile,
        isActive: false,
      });

      await expect(
        service.createExactBooking('job-123', 'pro-1', slotStart, slotEnd),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if pro is not assigned to job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ...mockJob,
        dispatchAssignment: { proProfileId: 'other-pro' },
      });
      mockPrisma.proProfile.findUnique.mockResolvedValue(mockProProfile);
      mockPrisma.preferredContractor.findUnique.mockResolvedValue(null);

      await expect(
        service.createExactBooking('job-123', 'pro-1', slotStart, slotEnd),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow booking if pro is preferred contractor', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        ...mockJob,
        dispatchAssignment: null,
      });
      mockPrisma.proProfile.findUnique.mockResolvedValue(mockProProfile);
      mockPrisma.preferredContractor.findUnique.mockResolvedValue({
        smbUserId: 'user-1',
        proProfileId: 'pro-1',
      });
      mockSlotComputation.isSlotAvailable.mockResolvedValue(true);
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        status: 'CONFIRMED',
        mode: 'EXACT',
      });
      mockPrisma.job.update.mockResolvedValue({});

      const result = await service.createExactBooking('job-123', 'pro-1', slotStart, slotEnd);

      expect(result.booking.status).toBe('CONFIRMED');
    });

    it('should throw ConflictException if slot is not available', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockPrisma.proProfile.findUnique.mockResolvedValue(mockProProfile);
      mockSlotComputation.isSlotAvailable.mockResolvedValue(false);

      await expect(
        service.createExactBooking('job-123', 'pro-1', slotStart, slotEnd),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if active booking already exists', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockPrisma.proProfile.findUnique.mockResolvedValue(mockProProfile);
      mockSlotComputation.isSlotAvailable.mockResolvedValue(true);
      mockPrisma.booking.findFirst.mockResolvedValue({
        id: 'existing-booking',
        status: 'CONFIRMED',
      });

      await expect(
        service.createExactBooking('job-123', 'pro-1', slotStart, slotEnd),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createWindowBooking', () => {
    const mockJob = {
      id: 'job-123',
      status: 'ACCEPTED',
      createdById: 'user-1',
      dispatchAssignment: { proProfileId: 'pro-1' },
    };

    const mockProProfile = {
      id: 'pro-1',
      isActive: true,
      user: { id: 'user-pro-1' },
    };

    const windowStart = new Date('2025-01-27T09:00:00Z');
    const windowEnd = new Date('2025-01-27T12:00:00Z');

    it('should create a window booking successfully', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockPrisma.proProfile.findUnique.mockResolvedValue(mockProProfile);
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        jobId: 'job-123',
        proProfileId: 'pro-1',
        mode: 'WINDOW',
        status: 'PENDING_CONFIRMATION',
        windowStart,
        windowEnd,
      });

      const result = await service.createWindowBooking('job-123', 'pro-1', windowStart, windowEnd);

      expect(result.booking.status).toBe('PENDING_CONFIRMATION');
      expect(result.booking.mode).toBe('WINDOW');
      expect(mockPrisma.job.update).not.toHaveBeenCalled(); // Job not updated until confirmed
    });

    it('should throw BadRequestException for window less than 30 minutes', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockPrisma.proProfile.findUnique.mockResolvedValue(mockProProfile);

      const shortWindowEnd = new Date(windowStart.getTime() + 20 * 60 * 1000); // 20 minutes

      await expect(
        service.createWindowBooking('job-123', 'pro-1', windowStart, shortWindowEnd),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for window exceeding 8 hours', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(mockJob);
      mockPrisma.proProfile.findUnique.mockResolvedValue(mockProProfile);

      const longWindowEnd = new Date(windowStart.getTime() + 9 * 60 * 60 * 1000); // 9 hours

      await expect(
        service.createWindowBooking('job-123', 'pro-1', windowStart, longWindowEnd),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmWindowBooking', () => {
    const mockBooking = {
      id: 'booking-1',
      jobId: 'job-123',
      proProfileId: 'pro-1',
      mode: 'WINDOW',
      status: 'PENDING_CONFIRMATION',
      windowStart: new Date('2025-01-27T09:00:00Z'),
      windowEnd: new Date('2025-01-27T12:00:00Z'),
      job: { id: 'job-123' },
    };

    const confirmedStart = new Date('2025-01-27T10:00:00Z');
    const confirmedEnd = new Date('2025-01-27T11:00:00Z');

    it('should confirm a window booking successfully', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockSlotComputation.isSlotAvailable.mockResolvedValue(true);
      mockPrisma.booking.update.mockResolvedValue({
        ...mockBooking,
        status: 'CONFIRMED',
        confirmedStart,
        confirmedEnd,
      });
      mockPrisma.job.update.mockResolvedValue({});

      const result = await service.confirmWindowBooking(
        'booking-1',
        confirmedStart,
        confirmedEnd,
        'pro-1',
      );

      expect(result.booking.status).toBe('CONFIRMED');
      expect(mockPrisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({ status: 'SCHEDULED' }),
      });
    });

    it('should throw NotFoundException for non-existent booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmWindowBooking('nonexistent', confirmedStart, confirmedEnd, 'pro-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if pro does not match', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.confirmWindowBooking('booking-1', confirmedStart, confirmedEnd, 'other-pro'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if booking is not PENDING_CONFIRMATION', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: 'CONFIRMED',
      });

      await expect(
        service.confirmWindowBooking('booking-1', confirmedStart, confirmedEnd, 'pro-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if booking mode is not WINDOW', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        mode: 'EXACT',
      });

      await expect(
        service.confirmWindowBooking('booking-1', confirmedStart, confirmedEnd, 'pro-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if confirmed times are outside window', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);

      const outsideStart = new Date('2025-01-27T08:00:00Z'); // Before window
      const outsideEnd = new Date('2025-01-27T09:00:00Z');

      await expect(
        service.confirmWindowBooking('booking-1', outsideStart, outsideEnd, 'pro-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if slot is no longer available', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockSlotComputation.isSlotAvailable.mockResolvedValue(false);

      await expect(
        service.confirmWindowBooking('booking-1', confirmedStart, confirmedEnd, 'pro-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('cancelBooking', () => {
    const mockBooking = {
      id: 'booking-1',
      jobId: 'job-123',
      proProfileId: 'pro-1',
      status: 'CONFIRMED',
      slotStart: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      job: {
        id: 'job-123',
        status: 'SCHEDULED',
        createdById: 'user-1',
        createdBy: { id: 'user-1' },
      },
    };

    it('should cancel booking as job owner', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.orgMember.findFirst.mockResolvedValue(null);
      mockPolicy.getValue.mockResolvedValue(2); // 2 hours cancellation policy
      mockPrisma.booking.update.mockResolvedValue({
        ...mockBooking,
        status: 'CANCELLED',
      });
      mockPrisma.job.update.mockResolvedValue({});

      const result = await service.cancelBooking(
        'booking-1',
        'Changed plans',
        'user-1',
        'SMB_USER',
      );

      expect(result.booking.status).toBe('CANCELLED');
    });

    it('should cancel booking as assigned pro', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.orgMember.findFirst.mockResolvedValue(null);
      mockPolicy.getValue.mockResolvedValue(2);
      mockPrisma.booking.update.mockResolvedValue({
        ...mockBooking,
        status: 'CANCELLED',
      });
      mockPrisma.job.update.mockResolvedValue({});

      const result = await service.cancelBooking(
        'booking-1',
        'Emergency',
        'user-pro-1',
        'PRO_USER',
        'pro-1',
      );

      expect(result.booking.status).toBe('CANCELLED');
    });

    it('should cancel booking as admin without policy check', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        slotStart: new Date(Date.now() + 60 * 60 * 1000), // Only 1 hour from now
      });
      mockPrisma.booking.update.mockResolvedValue({
        ...mockBooking,
        status: 'CANCELLED',
      });
      mockPrisma.job.update.mockResolvedValue({});

      const result = await service.cancelBooking(
        'booking-1',
        'Admin override',
        'admin-1',
        'ADMIN',
      );

      expect(result.booking.status).toBe('CANCELLED');
      expect(mockPolicy.getValue).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelBooking('nonexistent', 'Reason', 'user-1', 'SMB_USER'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not authorized', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.cancelBooking('booking-1', 'Reason', 'other-user', 'SMB_USER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if already cancelled', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: 'CANCELLED',
      });

      await expect(
        service.cancelBooking('booking-1', 'Reason', 'user-1', 'SMB_USER'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if booking is completed', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: 'COMPLETED',
      });

      await expect(
        service.cancelBooking('booking-1', 'Reason', 'user-1', 'SMB_USER'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if cancellation is too late', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        slotStart: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      });
      mockPrisma.orgMember.findFirst.mockResolvedValue(null);
      mockPolicy.getValue.mockResolvedValue(2); // 2 hours required

      await expect(
        service.cancelBooking('booking-1', 'Reason', 'user-1', 'SMB_USER'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should revert job status to ACCEPTED when cancelling', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.orgMember.findFirst.mockResolvedValue(null);
      mockPolicy.getValue.mockResolvedValue(2);
      mockPrisma.booking.update.mockResolvedValue({
        ...mockBooking,
        status: 'CANCELLED',
      });
      mockPrisma.job.update.mockResolvedValue({});

      await service.cancelBooking('booking-1', 'Reason', 'user-1', 'SMB_USER');

      expect(mockPrisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: { status: 'ACCEPTED', scheduledAt: null },
      });
    });
  });

  describe('getBooking', () => {
    it('should return booking with relations', async () => {
      const mockBooking = {
        id: 'booking-1',
        jobId: 'job-123',
        proProfileId: 'pro-1',
        job: { id: 'job-123', title: 'Test Job' },
        proProfile: {
          id: 'pro-1',
          user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
        },
      };

      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);

      const result = await service.getBooking('booking-1');

      expect(result.id).toBe('booking-1');
      expect(result.job).toBeDefined();
      expect(result.proProfile).toBeDefined();
    });

    it('should throw NotFoundException for non-existent booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.getBooking('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBookingsByJob', () => {
    it('should return bookings for a job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({ id: 'job-123' });
      mockPrisma.booking.findMany.mockResolvedValue([
        { id: 'booking-1', jobId: 'job-123' },
        { id: 'booking-2', jobId: 'job-123' },
      ]);

      const result = await service.getBookingsByJob('job-123');

      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException for non-existent job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      await expect(service.getBookingsByJob('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBookingsByPro', () => {
    it('should return paginated bookings for a pro', async () => {
      mockPrisma.proProfile.findUnique.mockResolvedValue({ id: 'pro-1' });
      mockPrisma.booking.count.mockResolvedValue(25);
      mockPrisma.booking.findMany.mockResolvedValue([
        { id: 'booking-1' },
        { id: 'booking-2' },
      ]);

      const result = await service.getBookingsByPro('pro-1', { page: 1, pageSize: 10 });

      expect(result.bookings).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
    });

    it('should throw NotFoundException for non-existent pro profile', async () => {
      mockPrisma.proProfile.findUnique.mockResolvedValue(null);

      await expect(service.getBookingsByPro('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeBooking', () => {
    it('should mark booking as completed', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: 'CONFIRMED',
      });
      mockPrisma.booking.update.mockResolvedValue({
        id: 'booking-1',
        status: 'COMPLETED',
      });

      const result = await service.completeBooking('booking-1');

      expect(result.status).toBe('COMPLETED');
    });

    it('should throw BadRequestException if booking is not confirmed', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: 'PENDING_CONFIRMATION',
      });

      await expect(service.completeBooking('booking-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('markNoShow', () => {
    it('should mark booking as no-show', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: 'CONFIRMED',
      });
      mockPrisma.booking.update.mockResolvedValue({
        id: 'booking-1',
        status: 'NO_SHOW',
      });

      const result = await service.markNoShow('booking-1');

      expect(result.status).toBe('NO_SHOW');
    });

    it('should throw BadRequestException if booking is not confirmed', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: 'CANCELLED',
      });

      await expect(service.markNoShow('booking-1')).rejects.toThrow(BadRequestException);
    });
  });
});
