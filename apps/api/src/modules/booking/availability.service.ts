import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DayOfWeek } from '@trades/shared';
import { TimeSlotDto, AvailabilityExceptionDto } from './dto/booking.dto';

export interface AvailabilityRule {
  id: string;
  proProfileId: string;
  dayOfWeek: DayOfWeek;
  slots: TimeSlotDto[];
  exceptions?: Record<string, AvailabilityExceptionDto>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all availability rules for a pro profile
   * @param proProfileId - The pro profile ID
   * @returns Array of availability rules for each day
   */
  async getAvailabilityRules(proProfileId: string): Promise<AvailabilityRule[]> {
    // Verify pro profile exists
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
    }

    const rules = await this.prisma.availabilityRule.findMany({
      where: {
        proProfileId,
        isActive: true,
      },
      orderBy: {
        dayOfWeek: 'asc',
      },
    });

    return rules.map((rule) => ({
      id: rule.id,
      proProfileId: rule.proProfileId,
      dayOfWeek: rule.dayOfWeek as DayOfWeek,
      slots: (rule.slots as unknown as TimeSlotDto[]) || [],
      exceptions: (rule.exceptions as unknown as Record<string, AvailabilityExceptionDto>) || {},
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }));
  }

  /**
   * Get availability rule for a specific day
   * @param proProfileId - The pro profile ID
   * @param dayOfWeek - The day of the week
   * @returns The availability rule for the day
   */
  async getAvailabilityRuleForDay(
    proProfileId: string,
    dayOfWeek: DayOfWeek,
  ): Promise<AvailabilityRule | null> {
    const rule = await this.prisma.availabilityRule.findUnique({
      where: {
        proProfileId_dayOfWeek: {
          proProfileId,
          dayOfWeek,
        },
      },
    });

    if (!rule) {
      return null;
    }

    return {
      id: rule.id,
      proProfileId: rule.proProfileId,
      dayOfWeek: rule.dayOfWeek as DayOfWeek,
      slots: (rule.slots as unknown as TimeSlotDto[]) || [],
      exceptions: (rule.exceptions as unknown as Record<string, AvailabilityExceptionDto>) || {},
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  /**
   * Set availability rule for a specific day
   * @param proProfileId - The pro profile ID
   * @param dayOfWeek - The day of the week
   * @param slots - Array of time slots
   * @returns The updated or created availability rule
   */
  async setAvailabilityRule(
    proProfileId: string,
    dayOfWeek: DayOfWeek,
    slots: TimeSlotDto[],
  ): Promise<AvailabilityRule> {
    // Verify pro profile exists
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
    }

    // Validate slots
    this.validateSlots(slots);

    // Check for existing rule
    const existingRule = await this.prisma.availabilityRule.findUnique({
      where: {
        proProfileId_dayOfWeek: {
          proProfileId,
          dayOfWeek,
        },
      },
    });

    let rule;
    if (existingRule) {
      // Update existing rule
      rule = await this.prisma.availabilityRule.update({
        where: {
          proProfileId_dayOfWeek: {
            proProfileId,
            dayOfWeek,
          },
        },
        data: {
          slots: slots as unknown as any,
          isActive: true,
        },
      });
    } else {
      // Create new rule
      rule = await this.prisma.availabilityRule.create({
        data: {
          proProfileId,
          dayOfWeek,
          slots: slots as unknown as any,
          exceptions: {},
          isActive: true,
        },
      });
    }

    return {
      id: rule.id,
      proProfileId: rule.proProfileId,
      dayOfWeek: rule.dayOfWeek as DayOfWeek,
      slots: (rule.slots as unknown as TimeSlotDto[]) || [],
      exceptions: (rule.exceptions as unknown as Record<string, AvailabilityExceptionDto>) || {},
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  /**
   * Add an exception for a specific date
   * @param proProfileId - The pro profile ID
   * @param date - The date (YYYY-MM-DD)
   * @param slots - Optional custom slots for the date (if omitted, the date is blocked)
   * @returns The updated availability rule containing the exception
   */
  async addException(
    proProfileId: string,
    date: string,
    slots?: TimeSlotDto[],
  ): Promise<AvailabilityRule> {
    // Verify pro profile exists
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
    }

    // Parse the date and get day of week
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException(`Invalid date format: ${date}`);
    }

    const dayOfWeek = this.getDayOfWeekFromDate(dateObj);

    // Validate slots if provided
    if (slots && slots.length > 0) {
      this.validateSlots(slots);
    }

    // Get or create the availability rule for this day
    let rule = await this.prisma.availabilityRule.findUnique({
      where: {
        proProfileId_dayOfWeek: {
          proProfileId,
          dayOfWeek,
        },
      },
    });

    const exception: AvailabilityExceptionDto = {
      date,
      slots: slots || null,
      isBlocked: !slots || slots.length === 0,
    };

    if (rule) {
      // Update existing rule with new exception
      const currentExceptions = (rule.exceptions as unknown as Record<string, AvailabilityExceptionDto>) || {};
      const updatedExceptions = {
        ...currentExceptions,
        [date]: exception,
      };

      rule = await this.prisma.availabilityRule.update({
        where: {
          proProfileId_dayOfWeek: {
            proProfileId,
            dayOfWeek,
          },
        },
        data: {
          exceptions: updatedExceptions as unknown as any,
        },
      });
    } else {
      // Create new rule with the exception
      rule = await this.prisma.availabilityRule.create({
        data: {
          proProfileId,
          dayOfWeek,
          slots: [],
          exceptions: { [date]: exception } as unknown as any,
          isActive: true,
        },
      });
    }

    return {
      id: rule.id,
      proProfileId: rule.proProfileId,
      dayOfWeek: rule.dayOfWeek as DayOfWeek,
      slots: (rule.slots as unknown as TimeSlotDto[]) || [],
      exceptions: (rule.exceptions as unknown as Record<string, AvailabilityExceptionDto>) || {},
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  /**
   * Remove an exception for a specific date
   * @param proProfileId - The pro profile ID
   * @param date - The date (YYYY-MM-DD)
   * @returns The updated availability rule
   */
  async removeException(proProfileId: string, date: string): Promise<AvailabilityRule | null> {
    // Verify pro profile exists
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });

    if (!proProfile) {
      throw new NotFoundException(`Pro profile with ID ${proProfileId} not found`);
    }

    // Parse the date and get day of week
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException(`Invalid date format: ${date}`);
    }

    const dayOfWeek = this.getDayOfWeekFromDate(dateObj);

    // Get the availability rule for this day
    const rule = await this.prisma.availabilityRule.findUnique({
      where: {
        proProfileId_dayOfWeek: {
          proProfileId,
          dayOfWeek,
        },
      },
    });

    if (!rule) {
      return null;
    }

    const currentExceptions = (rule.exceptions as unknown as Record<string, AvailabilityExceptionDto>) || {};

    if (!currentExceptions[date]) {
      throw new NotFoundException(`No exception found for date ${date}`);
    }

    // Remove the exception
    const { [date]: _, ...remainingExceptions } = currentExceptions;

    const updatedRule = await this.prisma.availabilityRule.update({
      where: {
        proProfileId_dayOfWeek: {
          proProfileId,
          dayOfWeek,
        },
      },
      data: {
        exceptions: remainingExceptions as unknown as any,
      },
    });

    return {
      id: updatedRule.id,
      proProfileId: updatedRule.proProfileId,
      dayOfWeek: updatedRule.dayOfWeek as DayOfWeek,
      slots: (updatedRule.slots as unknown as TimeSlotDto[]) || [],
      exceptions: (updatedRule.exceptions as unknown as Record<string, AvailabilityExceptionDto>) || {},
      isActive: updatedRule.isActive,
      createdAt: updatedRule.createdAt,
      updatedAt: updatedRule.updatedAt,
    };
  }

  /**
   * Get all exceptions for a pro profile
   * @param proProfileId - The pro profile ID
   * @returns All exceptions across all days
   */
  async getExceptions(proProfileId: string): Promise<AvailabilityExceptionDto[]> {
    const rules = await this.getAvailabilityRules(proProfileId);

    const exceptions: AvailabilityExceptionDto[] = [];
    for (const rule of rules) {
      if (rule.exceptions) {
        exceptions.push(...Object.values(rule.exceptions));
      }
    }

    // Sort by date
    return exceptions.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Validate time slots for consistency
   * @param slots - Array of time slots to validate
   */
  private validateSlots(slots: TimeSlotDto[]): void {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

    for (const slot of slots) {
      // Validate format
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        throw new BadRequestException(
          `Invalid time format. Use HH:mm format. Got: ${slot.startTime} - ${slot.endTime}`,
        );
      }

      // Validate end is after start
      const startMinutes = this.timeToMinutes(slot.startTime);
      const endMinutes = this.timeToMinutes(slot.endTime);

      if (endMinutes <= startMinutes) {
        throw new BadRequestException(
          `End time must be after start time. Got: ${slot.startTime} - ${slot.endTime}`,
        );
      }
    }

    // Check for overlapping slots
    const sortedSlots = [...slots].sort((a, b) =>
      this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime)
    );

    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const currentEnd = this.timeToMinutes(sortedSlots[i].endTime);
      const nextStart = this.timeToMinutes(sortedSlots[i + 1].startTime);

      if (currentEnd > nextStart) {
        throw new BadRequestException(
          `Overlapping slots detected: ${sortedSlots[i].startTime}-${sortedSlots[i].endTime} and ${sortedSlots[i + 1].startTime}-${sortedSlots[i + 1].endTime}`,
        );
      }
    }
  }

  /**
   * Convert time string (HH:mm) to minutes from midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
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
