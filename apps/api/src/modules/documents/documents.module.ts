import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../../common/storage/storage.module';

/**
 * DocumentsModule - File and document management
 *
 * Feature Flags:
 * - PRO_PORTFOLIO_ENABLED: Gates portfolio features
 *
 * Provides:
 * - File upload/download with presigned URLs
 * - Job attachments (before/after photos, documents)
 * - Verification documents for pros
 * - Portfolio management for pro public profiles
 */
@Module({
  imports: [AuditModule, StorageModule],
  controllers: [DocumentsController, PortfolioController],
  providers: [DocumentsService, PortfolioService],
  exports: [DocumentsService, PortfolioService],
})
export class DocumentsModule {}
