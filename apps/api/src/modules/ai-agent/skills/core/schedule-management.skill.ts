import { z } from 'zod';
import { BaseSkill } from '../base.skill';
import { SkillExecutionContext, SkillInputSchema } from '../../skill-registry.service';

/**
 * Input schema for ScheduleManagement skill
 */
const ScheduleManagementInputSchema = z.object({
  action: z.enum(['CHECK_AVAILABILITY', 'BOOK_SLOT', 'RESCHEDULE', 'CANCEL']),
  jobId: z.string().optional(),
  bookingId: z.string().optional(),
  proProfileId: z.string().optional(),
  dateRange: z.object({
    start: z.string().describe('Start date (ISO format)'),
    end: z.string().describe('End date (ISO format)'),
  }).optional(),
  preferredSlot: z.object({
    date: z.string(),
    timeOfDay: z.enum(['MORNING', 'AFTERNOON', 'EVENING']).optional(),
    specificTime: z.string().optional(),
  }).optional(),
  durationMinutes: z.number().optional().default(60),
  customerNotes: z.string().optional(),
});

type ScheduleManagementInput = z.infer<typeof ScheduleManagementInputSchema>;

/**
 * Time slot for scheduling
 */
interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  proProfileId?: string;
  proName?: string;
}

/**
 * Booking confirmation
 */
interface BookingConfirmation {
  bookingId: string;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  slot: TimeSlot;
  jobId?: string;
  confirmationCode: string;
  remindersSent: boolean;
}

/**
 * ScheduleManagement Skill
 *
 * Manages scheduling operations including availability checks and bookings.
 * Used by Dispatch Concierge agent.
 */
export class ScheduleManagementSkill extends BaseSkill {
  readonly name = 'ScheduleManagement';
  readonly description = 'Check contractor availability, book appointments, reschedule, or cancel bookings';
  readonly requiredFlags = ['BOOKING_ENABLED'];
  readonly requiredPermissions = ['booking:read', 'booking:create'];
  readonly inputSchema: SkillInputSchema = ScheduleManagementInputSchema;

  protected async executeInternal(
    input: ScheduleManagementInput,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    data: TimeSlot[] | BookingConfirmation | { message: string };
    message: string;
  }> {
    this.logger.debug('Processing schedule action', { action: input.action });

    switch (input.action) {
      case 'CHECK_AVAILABILITY':
        return this.checkAvailability(input, context);
      case 'BOOK_SLOT':
        return this.bookSlot(input, context);
      case 'RESCHEDULE':
        return this.reschedule(input, context);
      case 'CANCEL':
        return this.cancel(input, context);
      default:
        return {
          action: input.action,
          success: false,
          data: { message: 'Unknown action' },
          message: 'Invalid scheduling action',
        };
    }
  }

  private async checkAvailability(
    input: ScheduleManagementInput,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    data: TimeSlot[];
    message: string;
  }> {
    // Generate mock available slots
    const slots: TimeSlot[] = [];
    const startDate = input.dateRange?.start
      ? new Date(input.dateRange.start)
      : new Date();
    const endDate = input.dateRange?.end
      ? new Date(input.dateRange.end)
      : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    let currentDate = new Date(startDate);
    let slotCount = 0;

    while (currentDate <= endDate && slotCount < 10) {
      // Skip weekends for demo
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        // Morning slot
        slots.push({
          id: `slot_${slotCount++}_morning`,
          date: currentDate.toISOString().split('T')[0],
          startTime: '09:00',
          endTime: '11:00',
          available: Math.random() > 0.3,
          proProfileId: input.proProfileId || 'pro_default',
          proName: 'John Smith',
        });

        // Afternoon slot
        slots.push({
          id: `slot_${slotCount++}_afternoon`,
          date: currentDate.toISOString().split('T')[0],
          startTime: '14:00',
          endTime: '16:00',
          available: Math.random() > 0.3,
          proProfileId: input.proProfileId || 'pro_default',
          proName: 'John Smith',
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const availableSlots = slots.filter((s) => s.available);

    return {
      action: 'CHECK_AVAILABILITY',
      success: true,
      data: availableSlots,
      message: `Found ${availableSlots.length} available time slots`,
    };
  }

  private async bookSlot(
    input: ScheduleManagementInput,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    data: BookingConfirmation;
    message: string;
  }> {
    if (!input.preferredSlot) {
      return {
        action: 'BOOK_SLOT',
        success: false,
        data: {
          bookingId: '',
          status: 'CANCELLED',
          slot: {} as TimeSlot,
          confirmationCode: '',
          remindersSent: false,
        },
        message: 'Preferred slot is required for booking',
      };
    }

    // Create mock booking
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const confirmationCode = Math.random().toString(36).substr(2, 8).toUpperCase();

    const slot: TimeSlot = {
      id: `slot_${Date.now()}`,
      date: input.preferredSlot.date,
      startTime: input.preferredSlot.specificTime || '09:00',
      endTime: this.calculateEndTime(input.preferredSlot.specificTime || '09:00', input.durationMinutes || 60),
      available: false,
      proProfileId: input.proProfileId || 'pro_default',
      proName: 'John Smith',
    };

    const confirmation: BookingConfirmation = {
      bookingId,
      status: 'CONFIRMED',
      slot,
      jobId: input.jobId,
      confirmationCode,
      remindersSent: true,
    };

    return {
      action: 'BOOK_SLOT',
      success: true,
      data: confirmation,
      message: `Booking confirmed for ${slot.date} at ${slot.startTime}. Confirmation code: ${confirmationCode}`,
    };
  }

  private async reschedule(
    input: ScheduleManagementInput,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    data: BookingConfirmation;
    message: string;
  }> {
    if (!input.bookingId || !input.preferredSlot) {
      return {
        action: 'RESCHEDULE',
        success: false,
        data: {
          bookingId: input.bookingId || '',
          status: 'CANCELLED',
          slot: {} as TimeSlot,
          confirmationCode: '',
          remindersSent: false,
        },
        message: 'Booking ID and new preferred slot are required for rescheduling',
      };
    }

    // Create rescheduled booking
    const confirmationCode = Math.random().toString(36).substr(2, 8).toUpperCase();

    const slot: TimeSlot = {
      id: `slot_${Date.now()}`,
      date: input.preferredSlot.date,
      startTime: input.preferredSlot.specificTime || '09:00',
      endTime: this.calculateEndTime(input.preferredSlot.specificTime || '09:00', input.durationMinutes || 60),
      available: false,
      proProfileId: input.proProfileId,
    };

    const confirmation: BookingConfirmation = {
      bookingId: input.bookingId,
      status: 'CONFIRMED',
      slot,
      jobId: input.jobId,
      confirmationCode,
      remindersSent: true,
    };

    return {
      action: 'RESCHEDULE',
      success: true,
      data: confirmation,
      message: `Booking rescheduled to ${slot.date} at ${slot.startTime}. New confirmation code: ${confirmationCode}`,
    };
  }

  private async cancel(
    input: ScheduleManagementInput,
    context: SkillExecutionContext,
  ): Promise<{
    action: string;
    success: boolean;
    data: { message: string; bookingId: string; refundEligible: boolean };
    message: string;
  }> {
    if (!input.bookingId) {
      return {
        action: 'CANCEL',
        success: false,
        data: { message: 'Booking ID required', bookingId: '', refundEligible: false },
        message: 'Booking ID is required for cancellation',
      };
    }

    return {
      action: 'CANCEL',
      success: true,
      data: {
        message: 'Booking cancelled successfully',
        bookingId: input.bookingId,
        refundEligible: true,
      },
      message: `Booking ${input.bookingId} has been cancelled. The slot is now available for others.`,
    };
  }

  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  }
}

export { ScheduleManagementInputSchema };
