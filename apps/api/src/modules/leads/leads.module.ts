import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadNormalizationService } from './lead-normalization.service';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, LeadNormalizationService],
  exports: [LeadsService],
})
export class LeadsModule {}
