import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { AuditService } from '../audit/audit.service';
import { FEATURE_FLAGS, AUDIT_ACTIONS } from '@trades/shared';
import { CreateBranchDto, UpdateBranchDto, BranchesQueryDto } from './dto';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Check if multi-branch feature is enabled for the org
   */
  private async ensureMultiBranchEnabled(orgId: string): Promise<void> {
    const enabled = await this.featureFlagsService.isEnabled(
      FEATURE_FLAGS.MULTI_BRANCH_ENABLED,
      { orgId },
    );

    if (!enabled) {
      throw new BadRequestException('Multi-branch feature is not enabled for this organization');
    }
  }

  /**
   * List branches for an org
   */
  async listBranches(orgId: string, query: BranchesQueryDto) {
    await this.ensureMultiBranchEnabled(orgId);

    const where: Record<string, unknown> = { orgId };

    if (query.branchType) {
      where.branchType = query.branchType;
    }

    if (query.activeOnly !== undefined) {
      where.isActive = query.activeOnly;
    }

    if (query.regionId) {
      where.regionId = query.regionId;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.orgBranch.findMany({
      where,
      include: {
        childBranches: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            code: true,
            branchType: true,
            city: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        { branchType: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Get a single branch by ID
   */
  async getBranch(orgId: string, branchId: string) {
    await this.ensureMultiBranchEnabled(orgId);

    const branch = await this.prisma.orgBranch.findFirst({
      where: { id: branchId, orgId },
      include: {
        childBranches: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        parentBranch: {
          select: {
            id: true,
            name: true,
            code: true,
            branchType: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  /**
   * Create a new branch
   */
  async createBranch(orgId: string, dto: CreateBranchDto, actorId: string) {
    await this.ensureMultiBranchEnabled(orgId);

    // Validate parent branch if provided
    if (dto.parentBranchId) {
      const parent = await this.prisma.orgBranch.findFirst({
        where: { id: dto.parentBranchId, orgId },
      });

      if (!parent) {
        throw new BadRequestException('Parent branch not found');
      }
    }

    // Check for duplicate code within org
    if (dto.code) {
      const existing = await this.prisma.orgBranch.findFirst({
        where: { orgId, code: dto.code },
      });

      if (existing) {
        throw new BadRequestException(`Branch code "${dto.code}" already exists`);
      }
    }

    const branch = await this.prisma.orgBranch.create({
      data: {
        orgId,
        name: dto.name,
        code: dto.code,
        branchType: dto.branchType ?? 'BRANCH',
        parentBranchId: dto.parentBranchId,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        province: dto.province,
        postalCode: dto.postalCode,
        country: dto.country ?? 'CA',
        lat: dto.lat,
        lng: dto.lng,
        regionId: dto.regionId,
        phone: dto.phone,
        email: dto.email,
        managerName: dto.managerName,
        serviceRadiusKm: dto.serviceRadiusKm,
      },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.BRANCH_CREATED,
      actorId,
      targetType: 'OrgBranch',
      targetId: branch.id,
      details: { orgId, name: dto.name, branchType: dto.branchType },
    });

    this.logger.log(`Branch created: ${branch.id} (${dto.name}) for org ${orgId}`);

    return branch;
  }

  /**
   * Update a branch
   */
  async updateBranch(orgId: string, branchId: string, dto: UpdateBranchDto, actorId: string) {
    await this.ensureMultiBranchEnabled(orgId);

    const branch = await this.prisma.orgBranch.findFirst({
      where: { id: branchId, orgId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Validate parent branch if changing
    if (dto.parentBranchId) {
      if (dto.parentBranchId === branchId) {
        throw new BadRequestException('A branch cannot be its own parent');
      }

      const parent = await this.prisma.orgBranch.findFirst({
        where: { id: dto.parentBranchId, orgId },
      });

      if (!parent) {
        throw new BadRequestException('Parent branch not found');
      }
    }

    // Check for duplicate code if changing
    if (dto.code && dto.code !== branch.code) {
      const existing = await this.prisma.orgBranch.findFirst({
        where: { orgId, code: dto.code, id: { not: branchId } },
      });

      if (existing) {
        throw new BadRequestException(`Branch code "${dto.code}" already exists`);
      }
    }

    const updated = await this.prisma.orgBranch.update({
      where: { id: branchId },
      data: dto,
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.BRANCH_UPDATED,
      actorId,
      targetType: 'OrgBranch',
      targetId: branchId,
      details: { orgId, updates: Object.keys(dto) },
    });

    this.logger.log(`Branch updated: ${branchId} for org ${orgId}`);

    return updated;
  }

  /**
   * Deactivate a branch (soft delete)
   */
  async deactivateBranch(orgId: string, branchId: string, actorId: string) {
    await this.ensureMultiBranchEnabled(orgId);

    const branch = await this.prisma.orgBranch.findFirst({
      where: { id: branchId, orgId },
      include: { childBranches: { where: { isActive: true } } },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.branchType === 'HEADQUARTERS') {
      throw new BadRequestException('Cannot deactivate headquarters branch');
    }

    if (branch.childBranches.length > 0) {
      throw new BadRequestException(
        'Cannot deactivate branch with active child branches. Deactivate or reassign child branches first.',
      );
    }

    const updated = await this.prisma.orgBranch.update({
      where: { id: branchId },
      data: { isActive: false },
    });

    await this.auditService.log({
      action: AUDIT_ACTIONS.BRANCH_UPDATED,
      actorId,
      targetType: 'OrgBranch',
      targetId: branchId,
      details: { orgId, deactivated: true },
    });

    this.logger.log(`Branch deactivated: ${branchId} for org ${orgId}`);

    return updated;
  }

  /**
   * Get branch hierarchy (tree structure)
   */
  async getBranchHierarchy(orgId: string) {
    await this.ensureMultiBranchEnabled(orgId);

    const branches = await this.prisma.orgBranch.findMany({
      where: { orgId, isActive: true },
      orderBy: { name: 'asc' },
    });

    // Build tree structure
    const branchMap = new Map(branches.map((b) => [b.id, { ...b, children: [] as typeof branches }]));
    const roots: Array<typeof branches[0] & { children: typeof branches }> = [];

    for (const branch of branchMap.values()) {
      if (branch.parentBranchId && branchMap.has(branch.parentBranchId)) {
        branchMap.get(branch.parentBranchId)!.children.push(branch);
      } else {
        roots.push(branch);
      }
    }

    return roots;
  }
}
