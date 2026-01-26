import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  ValidateIf,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BookingMode, BookingStatus, DayOfWeek } from '@trades/shared';

// ============================================
// SLOT & AVAILABILITY DTOs
// ============================================

export class TimeSlotDto {
  @ApiProperty({
    description: 'Start time in HH:mm format',
    example: '09:00',
  })
  @IsString()
  startTime: string;

  @ApiProperty({
    description: 'End time in HH:mm format',
    example: '17:00',
  })
  @IsString()
  endTime: string;
}

export class GetSlotsQueryDto {
  @ApiProperty({
    description: 'Date to get slots for (YYYY-MM-DD)',
    example: '2024-03-15',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Duration of the booking in minutes',
    example: 60,
    minimum: 15,
    maximum: 480,
  })
  @IsInt()
  @Min(15)
  @Max(480)
  @Type(() => Number)
  duration: number;
}

export class SetAvailabilityRuleDto {
  @ApiProperty({
    description: 'Day of the week',
    enum: DayOfWeek,
    example: 'MONDAY',
  })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiProperty({
    description: 'Available time slots for the day',
    type: [TimeSlotDto],
    example: [{ startTime: '09:00', endTime: '12:00' }, { startTime: '13:00', endTime: '17:00' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  slots: TimeSlotDto[];
}

export class AddExceptionDto {
  @ApiProperty({
    description: 'Date of the exception (YYYY-MM-DD)',
    example: '2024-03-20',
  })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    description: 'Custom slots for the date (if omitted, the date is blocked)',
    type: [TimeSlotDto],
    example: [{ startTime: '10:00', endTime: '14:00' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  @IsOptional()
  slots?: TimeSlotDto[];

  @ApiPropertyOptional({
    description: 'Whether the entire day is blocked',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isBlocked?: boolean;
}

export class RemoveExceptionDto {
  @ApiProperty({
    description: 'Date of the exception to remove (YYYY-MM-DD)',
    example: '2024-03-20',
  })
  @IsDateString()
  date: string;
}

// ============================================
// BOOKING DTOs
// ============================================

export class CreateBookingDto {
  @ApiProperty({
    description: 'Job ID to create the booking for',
    example: 'clm123abc...',
  })
  @IsString()
  jobId: string;

  @ApiProperty({
    description: 'Pro Profile ID to book with',
    example: 'clm456def...',
  })
  @IsString()
  proProfileId: string;

  @ApiProperty({
    description: 'Booking mode: EXACT for specific slot, WINDOW for arrival window',
    enum: BookingMode,
    example: 'EXACT',
  })
  @IsEnum(BookingMode)
  mode: BookingMode;

  // For EXACT mode
  @ApiPropertyOptional({
    description: 'Exact slot start time (required for EXACT mode)',
    example: '2024-03-15T09:00:00Z',
  })
  @ValidateIf((o) => o.mode === 'EXACT')
  @IsDateString()
  slotStart?: string;

  @ApiPropertyOptional({
    description: 'Exact slot end time (required for EXACT mode)',
    example: '2024-03-15T10:00:00Z',
  })
  @ValidateIf((o) => o.mode === 'EXACT')
  @IsDateString()
  slotEnd?: string;

  // For WINDOW mode
  @ApiPropertyOptional({
    description: 'Window start time (required for WINDOW mode)',
    example: '2024-03-15T09:00:00Z',
  })
  @ValidateIf((o) => o.mode === 'WINDOW')
  @IsDateString()
  windowStart?: string;

  @ApiPropertyOptional({
    description: 'Window end time (required for WINDOW mode)',
    example: '2024-03-15T12:00:00Z',
  })
  @ValidateIf((o) => o.mode === 'WINDOW')
  @IsDateString()
  windowEnd?: string;
}

export class ConfirmBookingDto {
  @ApiProperty({
    description: 'Confirmed arrival start time within the window',
    example: '2024-03-15T10:00:00Z',
  })
  @IsDateString()
  confirmedStart: string;

  @ApiProperty({
    description: 'Confirmed arrival end time within the window',
    example: '2024-03-15T11:00:00Z',
  })
  @IsDateString()
  confirmedEnd: string;
}

export class CancelBookingDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'Schedule conflict - need to reschedule',
  })
  @IsString()
  reason: string;
}

export class BookingQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by booking status',
    enum: BookingStatus,
    example: 'CONFIRMED',
  })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Start date for date range filter (YYYY-MM-DD)',
    example: '2024-03-01',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for date range filter (YYYY-MM-DD)',
    example: '2024-03-31',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  pageSize?: number;
}

// ============================================
// RESPONSE DTOs
// ============================================

export class AvailableSlotResponseDto {
  @ApiProperty({
    description: 'Start time of the available slot',
    example: '2024-03-15T09:00:00Z',
  })
  startTime: string;

  @ApiProperty({
    description: 'End time of the available slot',
    example: '2024-03-15T10:00:00Z',
  })
  endTime: string;

  @ApiProperty({
    description: 'Whether the slot is available',
    example: true,
  })
  available: boolean;
}

export class GetSlotsResponseDto {
  @ApiProperty({
    description: 'Date of the slots',
    example: '2024-03-15',
  })
  date: string;

  @ApiProperty({
    description: 'Duration requested in minutes',
    example: 60,
  })
  duration: number;

  @ApiProperty({
    description: 'Booking mode for this pro',
    enum: BookingMode,
    example: 'EXACT',
  })
  bookingMode: BookingMode;

  @ApiProperty({
    description: 'List of available slots',
    type: [AvailableSlotResponseDto],
  })
  slots: AvailableSlotResponseDto[];
}

export class AvailabilityRuleResponseDto {
  @ApiProperty({
    description: 'Availability rule ID',
    example: 'clm789ghi...',
  })
  id: string;

  @ApiProperty({
    description: 'Day of the week',
    enum: DayOfWeek,
    example: 'MONDAY',
  })
  dayOfWeek: DayOfWeek;

  @ApiProperty({
    description: 'Available time slots',
    type: [TimeSlotDto],
  })
  slots: TimeSlotDto[];

  @ApiProperty({
    description: 'Whether the rule is active',
    example: true,
  })
  isActive: boolean;
}

export class AvailabilityExceptionDto {
  @ApiProperty({
    description: 'Date of the exception',
    example: '2024-03-20',
  })
  date: string;

  @ApiPropertyOptional({
    description: 'Custom slots for the date (null if blocked)',
    type: [TimeSlotDto],
  })
  slots?: TimeSlotDto[] | null;

  @ApiProperty({
    description: 'Whether the date is completely blocked',
    example: false,
  })
  isBlocked: boolean;
}

export class BookingResponseDto {
  @ApiProperty({
    description: 'Booking ID',
    example: 'clm123abc...',
  })
  id: string;

  @ApiProperty({
    description: 'Job ID',
    example: 'clm456def...',
  })
  jobId: string;

  @ApiProperty({
    description: 'Pro Profile ID',
    example: 'clm789ghi...',
  })
  proProfileId: string;

  @ApiProperty({
    description: 'Booking mode',
    enum: BookingMode,
    example: 'EXACT',
  })
  mode: BookingMode;

  @ApiProperty({
    description: 'Booking status',
    enum: BookingStatus,
    example: 'CONFIRMED',
  })
  status: BookingStatus;

  @ApiPropertyOptional({
    description: 'Exact slot start time (for EXACT mode)',
    example: '2024-03-15T09:00:00Z',
  })
  slotStart?: Date | null;

  @ApiPropertyOptional({
    description: 'Exact slot end time (for EXACT mode)',
    example: '2024-03-15T10:00:00Z',
  })
  slotEnd?: Date | null;

  @ApiPropertyOptional({
    description: 'Window start time (for WINDOW mode)',
    example: '2024-03-15T09:00:00Z',
  })
  windowStart?: Date | null;

  @ApiPropertyOptional({
    description: 'Window end time (for WINDOW mode)',
    example: '2024-03-15T12:00:00Z',
  })
  windowEnd?: Date | null;

  @ApiPropertyOptional({
    description: 'Confirmed start time (for WINDOW mode after confirmation)',
    example: '2024-03-15T10:00:00Z',
  })
  confirmedStart?: Date | null;

  @ApiPropertyOptional({
    description: 'Confirmed end time (for WINDOW mode after confirmation)',
    example: '2024-03-15T11:00:00Z',
  })
  confirmedEnd?: Date | null;

  @ApiPropertyOptional({
    description: 'When the booking was confirmed',
    example: '2024-03-14T15:00:00Z',
  })
  confirmedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'When the booking was cancelled',
    example: null,
  })
  cancelledAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Cancellation reason',
    example: null,
  })
  cancelReason?: string | null;

  @ApiProperty({
    description: 'When the booking was created',
    example: '2024-03-14T10:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the booking was last updated',
    example: '2024-03-14T15:00:00Z',
  })
  updatedAt: Date;
}

export class BookingsListResponseDto {
  @ApiProperty({
    description: 'List of bookings',
    type: [BookingResponseDto],
  })
  bookings: BookingResponseDto[];

  @ApiProperty({
    description: 'Total number of bookings',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
  })
  pageSize: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 2,
  })
  totalPages: number;
}
