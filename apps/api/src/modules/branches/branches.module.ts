import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

/**
 * BranchesModule - Multi-branch management for organizations
 *
 * Feature flag: MULTI_BRANCH_ENABLED (per org)
 *
 * Provides:
 * - Branch CRUD operations
 * - Branch hierarchy management
 * - Region assignment
 * - Service area configuration
 *
 * Dependencies:
 * - PrismaService (global)
 * - FeatureFlagsService (global)
 * - AuditService (global)
 */
@Module({
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
