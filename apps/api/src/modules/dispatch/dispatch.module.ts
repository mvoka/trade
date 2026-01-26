import { Module } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { MatchingService } from './matching.service';
import { RankingService } from './ranking.service';
import { EscalationService } from './escalation.service';
import { DispatchProcessor } from './dispatch.processor';

@Module({
  controllers: [DispatchController],
  providers: [
    DispatchService,
    MatchingService,
    RankingService,
    EscalationService,
    DispatchProcessor,
  ],
  exports: [DispatchService],
})
export class DispatchModule {}
