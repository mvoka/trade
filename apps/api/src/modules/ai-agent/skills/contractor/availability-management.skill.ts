import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for AvailabilityManagement skill
 */
const AvailabilityManagementInputSchema = z.object({
  action: z.enum(['GET_SCHEDULE', 'SET_AVAILABILITY', 'BLOCK_TIME', 'UNBLOCK_TIME', 'SET_WORKING_HOURS']),
  proProfileId: z.string().optional().describe('Contractor profile ID (uses context if not provided)'),
  dateRange: z.object({
    start: z.string().describe('Start date (ISO format)'),
    end: z.string().describe('End date (ISO format)'),
  }).optional(),
  availability: z.object({
    date: z.string().optional(),
    dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).optional(),
    slots: z.array(z.object({
      startTime: z.string().describe('Start time (HH:MM)'),
      endTime: z.string().describe('End time (HH:MM)'),
      available: z.boolean(),
    })).optional(),
  }).optional(),
  blockReason: z.string().optional(),
  recurring: z.boolean().optional().default(false),
});

type AvailabilityManagementInput = z.infer<typeof AvailabilityManagementInputSchema>;

/**
 * Schedule entry
 */
interface ScheduleEntry {
  date: string;
  dayOfWeek: string;
  slots: Array<{
    startTime: string;
    endTime: string;
    status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
    bookingId?: string;
  }>;
  totalAvailableHours: number;
  totalBookedHours: number;
}

/**
 * AvailabilityManagement Skill
 *
 * Manages contractor availability and schedule.
 * Used by Earnings Optimizer agent.
 */
export class AvailabilityManagementSkill extends BaseSkill {
  readonly name = 'AvailabilityManagement';
  readonly description = 'Manage contractor availability including viewing schedule, setting working hours, and blocking time off';
  readonly requiredFlags = ['BOOKING_ENABLED'];
  readonly requiredPermissions = ['contractor:schedule'];
  readonly inputSchema: SkillInputSchema = AvailabilityManagementInputSchema;

  protected async executeInternal(
    input: AvailabilityManagementInput,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    schedule?: ScheduleEntry[];
    message: string;
    summary?: {
      totalAvailableHours: number;
      totalBookedHours: number;
      utilizationRate: number;
      upcomingBookings: number;
    };
  }> {
    const proProfileId = input.proProfileId || context.userId || 'pro_default';
    this.logger.debug('Managing availability', { action: input.action, proProfileId });

    switch (input.action) {
      case 'GET_SCHEDULE':
        return this.getSchedule(proProfileId, input.dateRange as { start: string; end: string } | undefined);
      case 'SET_AVAILABILITY':
        return this.setAvailability(proProfileId, input.availability as { date?: string; slots?: Array<{ startTime: string; endTime: string; available: boolean }> } | undefined);
      case 'BLOCK_TIME':
        return this.blockTime(proProfileId, input.availability as { date?: string; slots?: Array<{ startTime: string; endTime: string }> } | undefined, input.blockReason);
      case 'UNBLOCK_TIME':
        return this.unblockTime(proProfileId, input.availability as { date?: string; slots?: Array<{ startTime: string; endTime: string }> } | undefined);
      case 'SET_WORKING_HOURS':
        return this.setWorkingHours(proProfileId, input.availability as { dayOfWeek?: string; slots?: Array<{ startTime: string; endTime: string; available: boolean }> } | undefined, input.recurring);
      default:
        return {
          action: input.action,
          success: false,
          message: 'Unknown action',
        };
    }
  }

  private async getSchedule(
    proProfileId: string,
    dateRange?: { start: string; end: string },
  ): Promise<{
    action: string;
    success: boolean;
    schedule: ScheduleEntry[];
    message: string;
    summary: {
      totalAvailableHours: number;
      totalBookedHours: number;
      utilizationRate: number;
      upcomingBookings: number;
    };
  }> {
    const startDate = dateRange?.start ? new Date(dateRange.start) : new Date();
    const endDate = dateRange?.end
      ? new Date(dateRange.end)
      : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const schedule: ScheduleEntry[] = [];
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

    let totalAvailable = 0;
    let totalBooked = 0;
    let upcomingBookings = 0;

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = dayNames[currentDate.getDay()];
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

      // Generate mock slots
      const slots: ScheduleEntry['slots'] = [];

      if (!isWeekend) {
        // Morning slot
        const morningStatus = Math.random() > 0.5 ? 'AVAILABLE' : 'BOOKED';
        slots.push({
          startTime: '08:00',
          endTime: '12:00',
          status: morningStatus,
          bookingId: morningStatus === 'BOOKED' ? `booking_${Date.now()}_am` : undefined,
        });
        if (morningStatus === 'AVAILABLE') totalAvailable += 4;
        else { totalBooked += 4; upcomingBookings++; }

        // Afternoon slot
        const afternoonStatus = Math.random() > 0.5 ? 'AVAILABLE' : 'BOOKED';
        slots.push({
          startTime: '13:00',
          endTime: '17:00',
          status: afternoonStatus,
          bookingId: afternoonStatus === 'BOOKED' ? `booking_${Date.now()}_pm` : undefined,
        });
        if (afternoonStatus === 'AVAILABLE') totalAvailable += 4;
        else { totalBooked += 4; upcomingBookings++; }
      } else {
        slots.push({
          startTime: '00:00',
          endTime: '23:59',
          status: 'BLOCKED',
        });
      }

      const availableHours = slots
        .filter(s => s.status === 'AVAILABLE')
        .reduce((sum, s) => sum + this.calculateHours(s.startTime, s.endTime), 0);
      const bookedHours = slots
        .filter(s => s.status === 'BOOKED')
        .reduce((sum, s) => sum + this.calculateHours(s.startTime, s.endTime), 0);

      schedule.push({
        date: currentDate.toISOString().split('T')[0],
        dayOfWeek,
        slots,
        totalAvailableHours: availableHours,
        totalBookedHours: bookedHours,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const utilizationRate = totalBooked / (totalAvailable + totalBooked) * 100 || 0;

    return {
      action: 'GET_SCHEDULE',
      success: true,
      schedule,
      message: `Retrieved schedule for ${schedule.length} days`,
      summary: {
        totalAvailableHours: totalAvailable,
        totalBookedHours: totalBooked,
        utilizationRate: Math.round(utilizationRate),
        upcomingBookings,
      },
    };
  }

  private async setAvailability(
    proProfileId: string,
    availability?: { date?: string; slots?: Array<{ startTime: string; endTime: string; available: boolean }> },
  ): Promise<{
    action: string;
    success: boolean;
    message: string;
  }> {
    if (!availability?.date || !availability?.slots) {
      return {
        action: 'SET_AVAILABILITY',
        success: false,
        message: 'Date and slots are required',
      };
    }

    return {
      action: 'SET_AVAILABILITY',
      success: true,
      message: `Availability updated for ${availability.date}. ${availability.slots.length} time slots configured.`,
    };
  }

  private async blockTime(
    proProfileId: string,
    availability?: { date?: string; slots?: Array<{ startTime: string; endTime: string }> },
    reason?: string,
  ): Promise<{
    action: string;
    success: boolean;
    message: string;
  }> {
    if (!availability?.date) {
      return {
        action: 'BLOCK_TIME',
        success: false,
        message: 'Date is required to block time',
      };
    }

    const reasonText = reason ? ` Reason: ${reason}` : '';
    return {
      action: 'BLOCK_TIME',
      success: true,
      message: `Time blocked for ${availability.date}.${reasonText}`,
    };
  }

  private async unblockTime(
    proProfileId: string,
    availability?: { date?: string; slots?: Array<{ startTime: string; endTime: string }> },
  ): Promise<{
    action: string;
    success: boolean;
    message: string;
  }> {
    if (!availability?.date) {
      return {
        action: 'UNBLOCK_TIME',
        success: false,
        message: 'Date is required to unblock time',
      };
    }

    return {
      action: 'UNBLOCK_TIME',
      success: true,
      message: `Time unblocked for ${availability.date}. You are now available for bookings.`,
    };
  }

  private async setWorkingHours(
    proProfileId: string,
    availability?: { dayOfWeek?: string; slots?: Array<{ startTime: string; endTime: string; available: boolean }> },
    recurring?: boolean,
  ): Promise<{
    action: string;
    success: boolean;
    message: string;
  }> {
    if (!availability?.dayOfWeek || !availability?.slots) {
      return {
        action: 'SET_WORKING_HOURS',
        success: false,
        message: 'Day of week and time slots are required',
      };
    }

    const recurringText = recurring ? ' (recurring weekly)' : '';
    return {
      action: 'SET_WORKING_HOURS',
      success: true,
      message: `Working hours set for ${availability.dayOfWeek}${recurringText}`,
    };
  }

  private calculateHours(startTime: string, endTime: string): number {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    return (endHours + endMinutes / 60) - (startHours + startMinutes / 60);
  }
}

export { AvailabilityManagementInputSchema };
