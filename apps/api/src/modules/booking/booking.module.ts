import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { AvailabilityService } from './availability.service';
import { SlotComputationService } from './slot-computation.service';

@Module({
  controllers: [BookingController],
  providers: [BookingService, AvailabilityService, SlotComputationService],
  exports: [BookingService, AvailabilityService],
})
export class BookingModule {}
