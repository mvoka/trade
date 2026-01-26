import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PolicyService } from '../feature-flags/policy.service';
import { AvailabilityService, AvailabilityRule } from './availability.service';
import { DayOfWeek, timeToMinutes, minutesToTime, POLICY_KEYS, DEFAULT_POLICIES } from '@trades/shared';
import { TimeSlotDto, AvailableSlotResponseDto } from './dto/booking.dto';

export interface BookingPolicies {
  leadTimeMinutes: number;
  bufferMinutes: number;
  maxPerDay: number;
}

export interface ComputedSlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
}

@Injectable()
export class SlotComputationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  /**
   * Get bookable slots for a pro on a specific date
   * @param proProfileId - The pro profile ID
   * @param date - The date to check (YYYY-MM-DD or Date object)
   * @param durationMinutes - Duration of the booking in minutes
   * @returns Array of available time slots
   */
  async getBookableSlots(
    proProfileId: string,
    date: string | Date,
    durationMinutes: number,
  ): Promise<ComputedSlot[]> {
    // Verify pro profile exists
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      include: {
        org: true,
      },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
    }

    // Parse the date
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const dateStr = this.formatDateString(dateObj);
    const dayOfWeek = this.getDayOfWeekFromDate(dateObj);

    // Get policies
    const policies = await this.getBookingPolicies(proProfile.orgId || undefined);

    // Get availability rule for the day
    const availabilityRule = await this.availabilityService.getAvailabilityRuleForDay(
      proProfileId,
      dayOfWeek,
    );

    // Get base slots (from rule or empty if no rule)
    let baseSlots = this.getBaseSlotsForDate(availabilityRule, dateStr);

    // If no slots available (blocked day or no rule), return empty
    if (baseSlots.length === 0) {
      return [];
    }

    // Get existing bookings for the date
    const existingBookings = await this.getExistingBookings(proProfileId, dateObj);

    // Generate time slots from base availability
    const allSlots = this.generateTimeSlots(baseSlots, dateObj, durationMinutes);

    // Remove slots that conflict with existing bookings
    const availableSlots = this.removeBookingConflicts(
      allSlots,
      existingBookings,
      policies.bufferMinutes,
    );

    // Apply lead time policy
    const finalSlots = this.applyLeadTimePolicy(
      availableSlots,
      policies.leadTimeMinutes,
    );

    return finalSlots;
  }

  /**
   * Check if a specific time slot is available
   * @param proProfileId - The pro profile ID
   * @param startTime - Slot start time
   * @param endTime - Slot end time
   * @returns Whether the slot is available
   */
  async isSlotAvailable(
    proProfileId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<boolean> {
    // Verify pro profile exists
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      include: {
        org: true,
      },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
    }

    // Get policies
    const policies = await this.getBookingPolicies(proProfile.orgId || undefined);

    // Check lead time
    const now = new Date();
    const leadTimeThreshold = new Date(now.getTime() + policies.leadTimeMinutes * 60 * 1000);
    if (startTime < leadTimeThreshold) {
      return false;
    }

    // Get the date and day of week
    const dateStr = this.formatDateString(startTime);
    const dayOfWeek = this.getDayOfWeekFromDate(startTime);

    // Get availability rule for the day
    const availabilityRule = await this.availabilityService.getAvailabilityRuleForDay(
      proProfileId,
      dayOfWeek,
    );

    // Get base slots for the date
    const baseSlots = this.getBaseSlotsForDate(availabilityRule, dateStr);

    // Check if the requested slot falls within available hours
    const slotStartMinutes = startTime.getHours() * 60 + startTime.getMinutes();
    const slotEndMinutes = endTime.getHours() * 60 + endTime.getMinutes();

    const isWithinAvailability = baseSlots.some((slot) => {
      const availStart = timeToMinutes(slot.startTime);
      const availEnd = timeToMinutes(slot.endTime);
      return slotStartMinutes >= availStart && slotEndMinutes <= availEnd;
    });

    if (!isWithinAvailability) {
      return false;
    }

    // Check for conflicts with existing bookings
    const existingBookings = await this.getExistingBookings(proProfileId, startTime);
    const hasConflict = this.hasBookingConflict(
      startTime,
      endTime,
      existingBookings,
      policies.bufferMinutes,
    );

    return !hasConflict;
  }

  /**
   * Apply booking policies to a list of slots
   * @param slots - Array of computed slots
   * @param policies - Booking policies to apply
   * @returns Filtered slots after applying policies
   */
  applyBookingPolicies(
    slots: ComputedSlot[],
    policies: BookingPolicies,
  ): ComputedSlot[] {
    // Apply lead time policy
    return this.applyLeadTimePolicy(slots, policies.leadTimeMinutes);
  }

  /**
   * Get booking policies for a scope
   */
  async getBookingPolicies(orgId?: string): Promise<BookingPolicies> {
    const scopeContext = orgId ? { orgId } : {};

    const [leadTimeMinutes, bufferMinutes, maxPerDay] = await Promise.all([
      this.policyService.getValue<number>(POLICY_KEYS.LEAD_TIME_MINUTES, scopeContext),
      this.policyService.getValue<number>(POLICY_KEYS.BUFFER_MINUTES, scopeContext),
      this.policyService.getValue<number>(POLICY_KEYS.MAX_BOOKINGS_PER_DAY, scopeContext),
    ]);

    return {
      leadTimeMinutes: leadTimeMinutes ?? DEFAULT_POLICIES[POLICY_KEYS.LEAD_TIME_MINUTES],
      bufferMinutes: bufferMinutes ?? DEFAULT_POLICIES[POLICY_KEYS.BUFFER_MINUTES],
      maxPerDay: maxPerDay ?? DEFAULT_POLICIES[POLICY_KEYS.MAX_BOOKINGS_PER_DAY],
    };
  }

  /**
   * Get base slots for a specific date (considering exceptions)
   */
  private getBaseSlotsForDate(
    rule: AvailabilityRule | null,
    dateStr: string,
  ): TimeSlotDto[] {
    if (!rule || !rule.isActive) {
      return [];
    }

    // Check for exception on this date
    const exception = rule.exceptions?.[dateStr];

    if (exception) {
      // If blocked, return no slots
      if (exception.isBlocked) {
        return [];
      }
      // If custom slots, use those
      if (exception.slots && exception.slots.length > 0) {
        return exception.slots;
      }
    }

    // Use regular slots
    return rule.slots || [];
  }

  /**
   * Get existing bookings for a pro on a specific date
   */
  private async getExistingBookings(
    proProfileId: string,
    date: Date,
  ): Promise<Array<{ start: Date; end: Date }>> {
    // Get start and end of the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        proProfileId,
        status: {
          in: ['PENDING_CONFIRMATION', 'CONFIRMED'],
        },
        OR: [
          // EXACT mode bookings
          {
            mode: 'EXACT',
            slotStart: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          // WINDOW mode bookings (use the window times)
          {
            mode: 'WINDOW',
            windowStart: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        ],
      },
    });

    return bookings.map((booking) => {
      if (booking.mode === 'EXACT') {
        return {
          start: booking.slotStart!,
          end: booking.slotEnd!,
        };
      } else {
        // For WINDOW mode, use confirmed times if available, otherwise the window
        return {
          start: booking.confirmedStart || booking.windowStart!,
          end: booking.confirmedEnd || booking.windowEnd!,
        };
      }
    });
  }

  /**
   * Generate time slots from base availability
   */
  private generateTimeSlots(
    baseSlots: TimeSlotDto[],
    date: Date,
    durationMinutes: number,
  ): ComputedSlot[] {
    const slots: ComputedSlot[] = [];
    const slotInterval = 30; // Generate slots every 30 minutes

    for (const baseSlot of baseSlots) {
      const startMinutes = timeToMinutes(baseSlot.startTime);
      const endMinutes = timeToMinutes(baseSlot.endTime);

      // Generate slots within this availability window
      for (let minutes = startMinutes; minutes + durationMinutes <= endMinutes; minutes += slotInterval) {
        const slotStart = new Date(date);
        slotStart.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

        const slotEnd = new Date(date);
        const endMins = minutes + durationMinutes;
        slotEnd.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0);

        slots.push({
          startTime: slotStart,
          endTime: slotEnd,
          available: true,
        });
      }
    }

    return slots;
  }

  /**
   * Remove slots that conflict with existing bookings
   */
  private removeBookingConflicts(
    slots: ComputedSlot[],
    existingBookings: Array<{ start: Date; end: Date }>,
    bufferMinutes: number,
  ): ComputedSlot[] {
    return slots.map((slot) => {
      const hasConflict = this.hasBookingConflict(
        slot.startTime,
        slot.endTime,
        existingBookings,
        bufferMinutes,
      );

      return {
        ...slot,
        available: !hasConflict,
      };
    });
  }

  /**
   * Check if a slot conflicts with any existing booking
   */
  private hasBookingConflict(
    slotStart: Date,
    slotEnd: Date,
    existingBookings: Array<{ start: Date; end: Date }>,
    bufferMinutes: number,
  ): boolean {
    const bufferMs = bufferMinutes * 60 * 1000;

    return existingBookings.some((booking) => {
      // Add buffer around the existing booking
      const bookingStartWithBuffer = new Date(booking.start.getTime() - bufferMs);
      const bookingEndWithBuffer = new Date(booking.end.getTime() + bufferMs);

      // Check for overlap
      return slotStart < bookingEndWithBuffer && slotEnd > bookingStartWithBuffer;
    });
  }

  /**
   * Apply lead time policy to remove slots that are too soon
   */
  private applyLeadTimePolicy(
    slots: ComputedSlot[],
    leadTimeMinutes: number,
  ): ComputedSlot[] {
    const now = new Date();
    const leadTimeThreshold = new Date(now.getTime() + leadTimeMinutes * 60 * 1000);

    return slots.map((slot) => ({
      ...slot,
      available: slot.available && slot.startTime >= leadTimeThreshold,
    }));
  }

  /**
   * Format date to YYYY-MM-DD string
   */
  private formatDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get day of week enum from Date object
   */
  private getDayOfWeekFromDate(date: Date): DayOfWeek {
    const days: DayOfWeek[] = [
      'SUNDAY' as DayOfWeek,
      'MONDAY' as DayOfWeek,
      'TUESDAY' as DayOfWeek,
      'WEDNESDAY' as DayOfWeek,
      'THURSDAY' as DayOfWeek,
      'FRIDAY' as DayOfWeek,
      'SATURDAY' as DayOfWeek,
    ];
    return days[date.getDay()];
  }
}
