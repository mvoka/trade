import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { OfferLeadsService } from './offer-leads.service';
import { OfferComplianceService } from './offer-compliance.service';
import { AuditModule } from '../audit/audit.module';

/**
 * OffersModule - Offer campaigns and lead generation
 *
 * Feature Flags:
 * - OFFER_CAMPAIGNS_ENABLED: Gates the entire module (per region)
 *
 * This module is disabled by default. Admins can enable it per region
 * through the feature flags management interface.
 *
 * Provides:
 * - Offer campaign management (CRUD, activation, pausing)
 * - Public offer landing pages
 * - Lead capture with marketing consent
 * - Lead lifecycle management
 * - Follow-up tracking with limits
 * - Compliance reporting
 *
 * Key Services:
 * - OffersService: Campaign CRUD and lifecycle
 * - OfferLeadsService: Lead capture and management
 * - OfferComplianceService: Consent and compliance tracking
 *
 * Policies:
 * - OFFER_MAX_FOLLOWUPS: Maximum follow-up attempts per lead
 *
 * Dependencies:
 * - PrismaService (global)
 * - FeatureFlagsService (global)
 * - PolicyService (global)
 * - AuditModule (for audit logging)
 */
@Module({
  imports: [AuditModule],
  controllers: [OffersController],
  providers: [
    OffersService,
    OfferLeadsService,
    OfferComplianceService,
  ],
  exports: [
    OffersService,
    OfferLeadsService,
    OfferComplianceService,
  ],
})
export class OffersModule {}
