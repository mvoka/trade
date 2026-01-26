import { Module } from '@nestjs/common';
import { PreferredService } from './preferred.service';
import { PreferredController } from './preferred.controller';

@Module({
  controllers: [PreferredController],
  providers: [PreferredService],
  exports: [PreferredService],
})
export class PreferredModule {}
