import { Module, Global } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { PolicyService } from './policy.service';

@Global()
@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, PolicyService],
  exports: [FeatureFlagsService, PolicyService],
})
export class FeatureFlagsModule {}
