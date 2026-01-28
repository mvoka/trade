import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto, BranchesQueryDto } from './dto';

/**
 * BranchesController - Multi-branch management endpoints
 *
 * All endpoints require authentication and org membership.
 * Feature flag: MULTI_BRANCH_ENABLED (per org)
 */
@Controller('orgs/:orgId/branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  /**
   * List all branches for an org
   */
  @Get()
  async listBranches(
    @Param('orgId') orgId: string,
    @Query() query: BranchesQueryDto,
  ) {
    return this.branchesService.listBranches(orgId, query);
  }

  /**
   * Get branch hierarchy (tree structure)
   */
  @Get('hierarchy')
  async getBranchHierarchy(@Param('orgId') orgId: string) {
    return this.branchesService.getBranchHierarchy(orgId);
  }

  /**
   * Get a single branch
   */
  @Get(':branchId')
  async getBranch(
    @Param('orgId') orgId: string,
    @Param('branchId') branchId: string,
  ) {
    return this.branchesService.getBranch(orgId, branchId);
  }

  /**
   * Create a new branch
   */
  @Post()
  async createBranch(
    @Param('orgId') orgId: string,
    @Body() dto: CreateBranchDto,
    @Request() req: { user?: { id?: string } },
  ) {
    const actorId = req.user?.id ?? 'system';
    return this.branchesService.createBranch(orgId, dto, actorId);
  }

  /**
   * Update a branch
   */
  @Put(':branchId')
  async updateBranch(
    @Param('orgId') orgId: string,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchDto,
    @Request() req: { user?: { id?: string } },
  ) {
    const actorId = req.user?.id ?? 'system';
    return this.branchesService.updateBranch(orgId, branchId, dto, actorId);
  }

  /**
   * Deactivate a branch (soft delete)
   */
  @Delete(':branchId')
  async deactivateBranch(
    @Param('orgId') orgId: string,
    @Param('branchId') branchId: string,
    @Request() req: { user?: { id?: string } },
  ) {
    const actorId = req.user?.id ?? 'system';
    return this.branchesService.deactivateBranch(orgId, branchId, actorId);
  }
}
