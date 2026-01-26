import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { AvailabilityService } from './availability.service';
import { SlotComputationService } from './slot-computation.service';
import { PolicyService } from '../feature-flags/policy.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireFeatureFlag } from '../../common/decorators/feature-flag.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { UserRole, BookingMode, BookingStatus, FEATURE_FLAGS, POLICY_KEYS, DEFAULT_POLICIES } from '@trades/shared';
import {
  GetSlotsQueryDto,
  CreateBookingDto,
  ConfirmBookingDto,
  CancelBookingDto,
  BookingQueryDto,
  SetAvailabilityRuleDto,
  AddExceptionDto,
  RemoveExceptionDto,
  GetSlotsResponseDto,
  BookingResponseDto,
  BookingsListResponseDto,
  AvailabilityRuleResponseDto,
} from './dto/booking.dto';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
@RequireFeatureFlag(FEATURE_FLAGS.BOOKING_ENABLED)
@ApiBearerAuth()
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly availabilityService: AvailabilityService,
    private readonly slotComputationService: SlotComputationService,
    private readonly policyService: PolicyService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  // ============================================
  // SLOT ENDPOINTS (Privacy-Respecting)
  // ============================================

  /**
   * Get bookable slots for a pro on a specific date
   * Privacy: Only shows available slots, never the full calendar
   */
  @Get('slots/:proProfileId')
  @ApiOperation({
    summary: 'Get available booking slots',
    description: 'Get available booking slots for a pro on a specific date. Only shows available slots to protect pro privacy.',
  })
  @ApiParam({ name: 'proProfileId', description: 'Pro Profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available slots retrieved successfully',
    type: GetSlotsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pro profile not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Feature not enabled',
  })
  async getBookableSlots(
    @Param('proProfileId') proProfileId: string,
    @Query() query: GetSlotsQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<GetSlotsResponseDto> {
    // Get booking mode policy
    const bookingMode = await this.policyService.getValue<string>(
      POLICY_KEYS.BOOKING_MODE,
      { orgId: user.orgId },
    ) ?? DEFAULT_POLICIES[POLICY_KEYS.BOOKING_MODE];

    // Compute available slots
    const slots = await this.slotComputationService.getBookableSlots(
      proProfileId,
      query.date,
      query.duration,
    );

    // Map to response format (only available slots)
    const availableSlots = slots
      .filter((slot) => slot.available)
      .map((slot) => ({
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
        available: true,
      }));

    return {
      date: query.date,
      duration: query.duration,
      bookingMode: bookingMode as BookingMode,
      slots: availableSlots,
    };
  }

  // ============================================
  // BOOKING ENDPOINTS
  // ============================================

  /**
   * Create a new booking
   * SMB can book after dispatch is accepted OR with preferred contractors
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SMB_USER, UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'Create a booking',
    description: 'Create a new booking for a job. SMB users can book after dispatch is accepted or with preferred contractors.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Booking created successfully',
    type: BookingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid booking request',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Slot not available or booking already exists',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not authorized to create booking',
  })
  async createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<BookingResponseDto> {
    // Validate mode-specific fields
    if (dto.mode === 'EXACT') {
      if (!dto.slotStart || !dto.slotEnd) {
        throw new BadRequestException('slotStart and slotEnd are required for EXACT mode');
      }
    } else if (dto.mode === 'WINDOW') {
      if (!dto.windowStart || !dto.windowEnd) {
        throw new BadRequestException('windowStart and windowEnd are required for WINDOW mode');
      }
    }

    // Check booking mode policy
    const allowedMode = await this.policyService.getValue<string>(
      POLICY_KEYS.BOOKING_MODE,
      { orgId: user.orgId },
    ) ?? DEFAULT_POLICIES[POLICY_KEYS.BOOKING_MODE];

    // For non-admins, enforce the booking mode policy
    if (user.role !== 'ADMIN' && user.role !== 'OPERATOR') {
      if (allowedMode === 'EXACT' && dto.mode === 'WINDOW') {
        throw new BadRequestException('Only EXACT bookings are allowed by policy');
      }
      if (allowedMode === 'WINDOW' && dto.mode === 'EXACT') {
        throw new BadRequestException('Only WINDOW bookings are allowed by policy');
      }
    }

    let result;
    if (dto.mode === 'EXACT') {
      result = await this.bookingService.createExactBooking(
        dto.jobId,
        dto.proProfileId,
        new Date(dto.slotStart!),
        new Date(dto.slotEnd!),
      );
    } else {
      result = await this.bookingService.createWindowBooking(
        dto.jobId,
        dto.proProfileId,
        new Date(dto.windowStart!),
        new Date(dto.windowEnd!),
      );
    }

    return result.booking as BookingResponseDto;
  }

  /**
   * Confirm a window booking (Pro only)
   */
  @Put(':id/confirm')
  @Roles(UserRole.PRO_USER, UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'Confirm a window booking',
    description: 'Pro confirms the exact arrival time within the agreed window. Only available for WINDOW mode bookings.',
  })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Booking confirmed successfully',
    type: BookingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid confirmation or booking not in correct state',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not authorized to confirm this booking',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Booking not found',
  })
  async confirmWindowBooking(
    @Param('id') id: string,
    @Body() dto: ConfirmBookingDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<BookingResponseDto> {
    if (!user.proProfileId && user.role !== 'ADMIN' && user.role !== 'OPERATOR') {
      throw new ForbiddenException('Only pros can confirm window bookings');
    }

    const result = await this.bookingService.confirmWindowBooking(
      id,
      new Date(dto.confirmedStart),
      new Date(dto.confirmedEnd),
      user.proProfileId!,
    );

    return result.booking as BookingResponseDto;
  }

  /**
   * Cancel a booking
   */
  @Put(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a booking',
    description: 'Cancel an existing booking. Job owners, the assigned pro, and admins can cancel.',
  })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Booking cancelled successfully',
    type: BookingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot cancel booking (policy violation or invalid state)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not authorized to cancel this booking',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Booking not found',
  })
  async cancelBooking(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<BookingResponseDto> {
    const result = await this.bookingService.cancelBooking(
      id,
      dto.reason,
      user.userId,
      user.role,
      user.proProfileId,
    );

    return result.booking as BookingResponseDto;
  }

  /**
   * Get booking by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get booking details',
    description: 'Get detailed information about a specific booking.',
  })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Booking retrieved successfully',
    type: BookingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Booking not found',
  })
  async getBooking(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<BookingResponseDto> {
    const booking = await this.bookingService.getBooking(id);

    // Authorization: Only job owner, assigned pro, or admin can view
    const isOwner = booking.job?.createdById === user.userId;
    const isPro = user.proProfileId && booking.proProfileId === user.proProfileId;
    const isAdmin = user.role === 'ADMIN' || user.role === 'OPERATOR';

    if (!isOwner && !isPro && !isAdmin) {
      throw new ForbiddenException('You are not authorized to view this booking');
    }

    return booking as unknown as BookingResponseDto;
  }

  /**
   * Get current pro's bookings
   */
  @Get('pro/my-bookings')
  @Roles(UserRole.PRO_USER)
  @ApiOperation({
    summary: "Get current pro's bookings",
    description: "Get all bookings for the authenticated pro user. Supports filtering and pagination.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bookings retrieved successfully',
    type: BookingsListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a pro',
  })
  async getMyBookings(
    @Query() query: BookingQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<BookingsListResponseDto> {
    if (!user.proProfileId) {
      throw new ForbiddenException('User does not have a pro profile');
    }

    const dateRange = query.startDate && query.endDate
      ? {
          startDate: new Date(query.startDate),
          endDate: new Date(query.endDate),
        }
      : undefined;

    const result = await this.bookingService.getBookingsByPro(user.proProfileId, {
      dateRange,
      status: query.status as BookingStatus,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      bookings: result.bookings as unknown as BookingResponseDto[],
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  /**
   * Get bookings for a specific job
   */
  @Get('job/:jobId')
  @ApiOperation({
    summary: 'Get bookings for a job',
    description: 'Get all bookings associated with a specific job.',
  })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bookings retrieved successfully',
    type: [BookingResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async getBookingsByJob(
    @Param('jobId') jobId: string,
  ): Promise<BookingResponseDto[]> {
    const bookings = await this.bookingService.getBookingsByJob(jobId);
    return bookings as unknown as BookingResponseDto[];
  }

  // ============================================
  // AVAILABILITY MANAGEMENT (Pro only)
  // ============================================

  /**
   * Get availability rules for current pro
   */
  @Get('availability/rules')
  @Roles(UserRole.PRO_USER)
  @ApiOperation({
    summary: 'Get availability rules',
    description: "Get all availability rules for the authenticated pro's profile.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Availability rules retrieved successfully',
    type: [AvailabilityRuleResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a pro',
  })
  async getAvailabilityRules(
    @CurrentUser() user: CurrentUserData,
  ): Promise<AvailabilityRuleResponseDto[]> {
    if (!user.proProfileId) {
      throw new ForbiddenException('User does not have a pro profile');
    }

    const rules = await this.availabilityService.getAvailabilityRules(user.proProfileId);
    return rules as AvailabilityRuleResponseDto[];
  }

  /**
   * Set availability rule for a day
   */
  @Post('availability/rules')
  @Roles(UserRole.PRO_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set availability rule',
    description: 'Set or update availability rule for a specific day of the week.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Availability rule set successfully',
    type: AvailabilityRuleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid slots configuration',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a pro',
  })
  async setAvailabilityRule(
    @Body() dto: SetAvailabilityRuleDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AvailabilityRuleResponseDto> {
    if (!user.proProfileId) {
      throw new ForbiddenException('User does not have a pro profile');
    }

    const rule = await this.availabilityService.setAvailabilityRule(
      user.proProfileId,
      dto.dayOfWeek,
      dto.slots,
    );

    return rule as AvailabilityRuleResponseDto;
  }

  /**
   * Add an exception for a specific date
   */
  @Post('availability/exceptions')
  @Roles(UserRole.PRO_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add availability exception',
    description: 'Add a date-specific exception to override regular availability. Can block the day or set custom hours.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exception added successfully',
    type: AvailabilityRuleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid exception configuration',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a pro',
  })
  async addException(
    @Body() dto: AddExceptionDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AvailabilityRuleResponseDto> {
    if (!user.proProfileId) {
      throw new ForbiddenException('User does not have a pro profile');
    }

    const rule = await this.availabilityService.addException(
      user.proProfileId,
      dto.date,
      dto.slots,
    );

    return rule as AvailabilityRuleResponseDto;
  }

  /**
   * Remove an exception for a specific date
   */
  @Put('availability/exceptions/remove')
  @Roles(UserRole.PRO_USER)
  @ApiOperation({
    summary: 'Remove availability exception',
    description: 'Remove a date-specific exception, reverting to regular availability.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exception removed successfully',
    type: AvailabilityRuleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exception not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a pro',
  })
  async removeException(
    @Body() dto: RemoveExceptionDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AvailabilityRuleResponseDto | { message: string }> {
    if (!user.proProfileId) {
      throw new ForbiddenException('User does not have a pro profile');
    }

    const rule = await this.availabilityService.removeException(
      user.proProfileId,
      dto.date,
    );

    if (!rule) {
      return { message: 'Exception removed successfully' };
    }

    return rule as AvailabilityRuleResponseDto;
  }
}
