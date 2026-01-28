import { Module } from '@nestjs/common';
import { HomeownerController } from './homeowner.controller';
import { HomeownerService } from './homeowner.service';
import { ConsumerProfileService } from './consumer-profile.service';
import { AuditModule } from '../audit/audit.module';

/**
 * HomeownerModule - Homeowner/Consumer marketplace functionality
 *
 * Feature Flags:
 * - HOMEOWNER_MARKETPLACE_ENABLED: Gates the entire module (per region)
 * - SUBSCRIPTIONS_ENABLED: Gates subscription-related features
 *
 * This module is disabled by default. Admins can enable it per region
 * through the feature flags management interface.
 *
 * Provides:
 * - Consumer registration (separate from SMB)
 * - Consumer profile management
 * - Subscription viewing
 * - Job history
 *
 * Dependencies:
 * - PrismaService (global)
 * - FeatureFlagsService (global)
 * - AuditModule (for audit logging)
 */
@Module({
  imports: [AuditModule],
  controllers: [HomeownerController],
  providers: [HomeownerService, ConsumerProfileService],
  exports: [HomeownerService, ConsumerProfileService],
})
export class HomeownerModule {}
