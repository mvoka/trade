import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PolicyService } from '../feature-flags/policy.service';
import { SlotComputationService } from './slot-computation.service';
import { BookingMode, BookingStatus, JobStatus, POLICY_KEYS, DEFAULT_POLICIES } from '@trades/shared';
import { Booking, Job } from '@trades/prisma';

export interface BookingWithRelations extends Booking {
  job?: Job;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface BookingResult {
  booking: Booking;
  message: string;
}

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly slotComputationService: SlotComputationService,
  ) {}

  /**
   * Create an exact slot booking
   * @param jobId - The job ID
   * @param proProfileId - The pro profile ID
   * @param slotStart - Exact slot start time
   * @param slotEnd - Exact slot end time
   * @returns The created booking
   */
  async createExactBooking(
    jobId: string,
    proProfileId: string,
    slotStart: Date,
    slotEnd: Date,
  ): Promise<BookingResult> {
    // Validate job and pro profile
    const { job, proProfile } = await this.validateBookingPrerequisites(jobId, proProfileId);

    // Check if slot is available
    const isAvailable = await this.slotComputationService.isSlotAvailable(
      proProfileId,
      slotStart,
      slotEnd,
    );

    if (!isAvailable) {
      throw new ConflictException('The requested time slot is not available');
    }

    // Check for existing active booking for this job
    await this.checkExistingBooking(jobId);

    // Create the booking
    const booking = await this.prisma.booking.create({
      data: {
        jobId,
        proProfileId,
        mode: 'EXACT' as BookingMode,
        status: 'CONFIRMED' as BookingStatus, // EXACT bookings are immediately confirmed
        slotStart,
        slotEnd,
        confirmedAt: new Date(),
      },
    });

    // Update job status to SCHEDULED
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'SCHEDULED' as JobStatus,
        scheduledAt: new Date(),
      },
    });

    return {
      booking,
      message: 'Booking created successfully. The exact time slot has been confirmed.',
    };
  }

  /**
   * Create a time window booking (requires pro confirmation)
   * @param jobId - The job ID
   * @param proProfileId - The pro profile ID
   * @param windowStart - Window start time
   * @param windowEnd - Window end time
   * @returns The created booking (pending confirmation)
   */
  async createWindowBooking(
    jobId: string,
    proProfileId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<BookingResult> {
    // Validate job and pro profile
    const { job, proProfile } = await this.validateBookingPrerequisites(jobId, proProfileId);

    // Validate window duration (must be reasonable)
    const windowDuration = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60);
    if (windowDuration < 30) {
      throw new BadRequestException('Time window must be at least 30 minutes');
    }
    if (windowDuration > 480) {
      throw new BadRequestException('Time window cannot exceed 8 hours');
    }

    // Check for existing active booking for this job
    await this.checkExistingBooking(jobId);

    // Create the booking (pending confirmation)
    const booking = await this.prisma.booking.create({
      data: {
        jobId,
        proProfileId,
        mode: 'WINDOW' as BookingMode,
        status: 'PENDING_CONFIRMATION' as BookingStatus,
        windowStart,
        windowEnd,
      },
    });

    return {
      booking,
      message: 'Booking created. Waiting for pro to confirm the exact arrival time.',
    };
  }

  /**
   * Confirm a window booking with exact times (Pro only)
   * @param bookingId - The booking ID
   * @param confirmedStart - Confirmed arrival start time
   * @param confirmedEnd - Confirmed arrival end time
   * @param proProfileId - The pro profile ID (for authorization)
   * @returns The updated booking
   */
  async confirmWindowBooking(
    bookingId: string,
    confirmedStart: Date,
    confirmedEnd: Date,
    proProfileId: string,
  ): Promise<BookingResult> {
    // Get the booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { job: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    // Verify authorization
    if (booking.proProfileId !== proProfileId) {
      throw new ForbiddenException('You are not authorized to confirm this booking');
    }

    // Verify booking is in the correct state
    if (booking.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException(
        `Cannot confirm booking with status ${booking.status}. Only PENDING_CONFIRMATION bookings can be confirmed.`,
      );
    }

    if (booking.mode !== 'WINDOW') {
      throw new BadRequestException('Only WINDOW mode bookings require confirmation');
    }

    // Validate confirmed times are within the window
    if (confirmedStart < booking.windowStart! || confirmedEnd > booking.windowEnd!) {
      throw new BadRequestException('Confirmed times must be within the agreed time window');
    }

    // Check if the exact slot is still available
    const isAvailable = await this.slotComputationService.isSlotAvailable(
      proProfileId,
      confirmedStart,
      confirmedEnd,
    );

    if (!isAvailable) {
      throw new ConflictException('The confirmed time slot is no longer available');
    }

    // Update the booking
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED' as BookingStatus,
        confirmedStart,
        confirmedEnd,
        confirmedAt: new Date(),
      },
    });

    // Update job status to SCHEDULED
    await this.prisma.job.update({
      where: { id: booking.jobId },
      data: {
        status: 'SCHEDULED' as JobStatus,
        scheduledAt: new Date(),
      },
    });

    return {
      booking: updatedBooking,
      message: 'Booking confirmed successfully with the specified arrival time.',
    };
  }

  /**
   * Cancel a booking
   * @param bookingId - The booking ID
   * @param reason - Cancellation reason
   * @param userId - The user requesting cancellation
   * @param userRole - The user's role
   * @param proProfileId - Optional pro profile ID (for pros)
   * @returns The cancelled booking
   */
  async cancelBooking(
    bookingId: string,
    reason: string,
    userId: string,
    userRole: string,
    proProfileId?: string,
  ): Promise<BookingResult> {
    // Get the booking with job details
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        job: {
          include: {
            createdBy: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    // Authorization check
    const isOwner = booking.job.createdById === userId;
    const isPro = proProfileId && booking.proProfileId === proProfileId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'OPERATOR';

    if (!isOwner && !isPro && !isAdmin) {
      throw new ForbiddenException('You are not authorized to cancel this booking');
    }

    // Check if booking can be cancelled
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    // Check cancellation policy (for non-admins)
    if (!isAdmin) {
      const orgId = booking.job.createdBy
        ? await this.getUserOrgId(booking.job.createdById)
        : undefined;

      const cancellationHours = await this.policyService.getValue<number>(
        POLICY_KEYS.CANCELLATION_HOURS,
        { orgId },
      ) ?? DEFAULT_POLICIES[POLICY_KEYS.CANCELLATION_HOURS];

      const bookingTime = booking.slotStart || booking.windowStart;
      if (bookingTime) {
        const now = new Date();
        const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilBooking < cancellationHours) {
          throw new BadRequestException(
            `Bookings must be cancelled at least ${cancellationHours} hours in advance`,
          );
        }
      }
    }

    // Cancel the booking
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED' as BookingStatus,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    // Update job status back to ACCEPTED (if it was scheduled)
    if (booking.job.status === 'SCHEDULED') {
      await this.prisma.job.update({
        where: { id: booking.jobId },
        data: {
          status: 'ACCEPTED' as JobStatus,
          scheduledAt: null,
        },
      });
    }

    return {
      booking: updatedBooking,
      message: 'Booking cancelled successfully.',
    };
  }

  /**
   * Get booking by ID
   * @param id - The booking ID
   * @returns The booking with relations
   */
  async getBooking(id: string): Promise<BookingWithRelations> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        job: true,
        proProfile: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return booking;
  }

  /**
   * Get all bookings for a job
   * @param jobId - The job ID
   * @returns Array of bookings for the job
   */
  async getBookingsByJob(jobId: string): Promise<Booking[]> {
    // Verify job exists
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return this.prisma.booking.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get bookings for a pro profile
   * @param proProfileId - The pro profile ID
   * @param dateRange - Optional date range filter
   * @param status - Optional status filter
   * @param page - Page number
   * @param pageSize - Items per page
   * @returns Paginated bookings for the pro
   */
  async getBookingsByPro(
    proProfileId: string,
    options?: {
      dateRange?: DateRange;
      status?: BookingStatus;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{
    bookings: BookingWithRelations[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    // Verify pro profile exists
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
    }

    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = { proProfileId };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.dateRange) {
      where.OR = [
        {
          slotStart: {
            gte: options.dateRange.startDate,
            lte: options.dateRange.endDate,
          },
        },
        {
          windowStart: {
            gte: options.dateRange.startDate,
            lte: options.dateRange.endDate,
          },
        },
      ];
    }

    // Get total count
    const total = await this.prisma.booking.count({ where });

    // Get bookings
    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            jobNumber: true,
            title: true,
            contactName: true,
            serviceAddressLine1: true,
            serviceCity: true,
            status: true,
          },
        },
      },
      orderBy: [
        { slotStart: 'asc' },
        { windowStart: 'asc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: pageSize,
    });

    return {
      bookings: bookings as BookingWithRelations[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Mark a booking as completed
   * @param bookingId - The booking ID
   * @returns The updated booking
   */
  async completeBooking(bookingId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Only confirmed bookings can be marked as completed');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'COMPLETED' as BookingStatus,
      },
    });
  }

  /**
   * Mark a booking as no-show
   * @param bookingId - The booking ID
   * @returns The updated booking
   */
  async markNoShow(bookingId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Only confirmed bookings can be marked as no-show');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'NO_SHOW' as BookingStatus,
      },
    });
  }

  /**
   * Validate prerequisites for creating a booking
   */
  private async validateBookingPrerequisites(
    jobId: string,
    proProfileId: string,
  ): Promise<{ job: Job; proProfile: any }> {
    // Get job with assignment details
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        dispatchAssignment: true,
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    // Verify job is in a bookable state
    if (!['ACCEPTED', 'SCHEDULED'].includes(job.status)) {
      throw new BadRequestException(
        `Cannot create booking for job with status ${job.status}. Job must be ACCEPTED or SCHEDULED.`,
      );
    }

    // Verify pro profile exists and is active
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      include: {
        user: true,
      },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
    }

    if (!proProfile.isActive) {
      throw new BadRequestException('Pro profile is not active');
    }

    // Verify the pro is assigned to this job or is preferred
    const isAssigned = job.dispatchAssignment?.proProfileId === proProfileId;
    const isPreferred = await this.isPreferredContractor(job.createdById, proProfileId);

    if (!isAssigned && !isPreferred) {
      throw new ForbiddenException(
        'The pro must be assigned to this job or be a preferred contractor',
      );
    }

    return { job, proProfile };
  }

  /**
   * Check if there's already an active booking for a job
   */
  private async checkExistingBooking(jobId: string): Promise<void> {
    const existingBooking = await this.prisma.booking.findFirst({
      where: {
        jobId,
        status: {
          in: ['PENDING_CONFIRMATION', 'CONFIRMED'],
        },
      },
    });

    if (existingBooking) {
      throw new ConflictException(
        'An active booking already exists for this job. Cancel it first to create a new booking.',
      );
    }
  }

  /**
   * Check if a pro is a preferred contractor for a user
   */
  private async isPreferredContractor(
    smbUserId: string,
    proProfileId: string,
  ): Promise<boolean> {
    const preferred = await this.prisma.preferredContractor.findUnique({
      where: {
        smbUserId_proProfileId: {
          smbUserId,
          proProfileId,
        },
      },
    });

    return !!preferred;
  }

  /**
   * Get user's org ID
   */
  private async getUserOrgId(userId: string): Promise<string | undefined> {
    const membership = await this.prisma.orgMember.findFirst({
      where: { userId, isActive: true },
    });

    return membership?.orgId;
  }
}
