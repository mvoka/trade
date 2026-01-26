import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  ScopeType,
  ScopeContext,
  CACHE_KEYS,
  CACHE_TTL,
  DEFAULT_POLICIES,
  POLICY_KEYS,
} from '@trades/shared';
import {
  CreatePolicyDto,
  UpdatePolicyDto,
  PolicyResponseDto,
  PolicyValueResponseDto,
} from './dto/feature-flags.dto';

// Scope hierarchy: SERVICE_CATEGORY > ORG > REGION > GLOBAL
// Higher index = more specific = higher priority
const SCOPE_HIERARCHY: ScopeType[] = ['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'];

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get policy value for a given key and scope context
   * Returns the value from the most specific scope that matches
   * Falls back to default policy values if no policy is found
   */
  async getValue<T = unknown>(
    policyKey: string,
    scopeContext?: ScopeContext,
  ): Promise<T> {
    const resolved = await this.getPolicy(policyKey, scopeContext);

    if (resolved) {
      return resolved.value as T;
    }

    // Return default value if available
    const defaultValue = DEFAULT_POLICIES[policyKey as keyof typeof DEFAULT_POLICIES];
    if (defaultValue !== undefined) {
      return defaultValue as T;
    }

    throw new NotFoundException(`No policy found for key '${policyKey}'`);
  }

  /**
   * Get full policy with scope resolution
   * Returns the most specific policy that matches the scope context
   */
  async getPolicy(
    policyKey: string,
    scopeContext?: ScopeContext,
  ): Promise<PolicyValueResponseDto | null> {
    // Build cache key based on the most specific scope
    const cacheKey = this.buildCacheKey(policyKey, scopeContext);

    // Try to get from cache first
    const cached = await this.redis.getJson<PolicyValueResponseDto>(cacheKey);
    if (cached !== null) {
      this.logger.debug(`Cache hit for policy: ${policyKey}`);
      return cached;
    }

    // Resolve policy from database using scope hierarchy
    const resolved = await this.resolvePolicyFromDb(policyKey, scopeContext);

    if (resolved) {
      // Cache the resolved value
      await this.redis.setJson(cacheKey, resolved, CACHE_TTL.POLICY);
      return resolved;
    }

    // Check for default policy value
    const defaultValue = DEFAULT_POLICIES[policyKey as keyof typeof DEFAULT_POLICIES];
    if (defaultValue !== undefined) {
      const defaultResolved: PolicyValueResponseDto = {
        key: policyKey,
        value: defaultValue,
        resolvedScopeType: 'GLOBAL',
      };
      // Cache the default value
      await this.redis.setJson(cacheKey, defaultResolved, CACHE_TTL.POLICY);
      return defaultResolved;
    }

    return null;
  }

  /**
   * Get all policies (admin endpoint)
   */
  async getAllPolicies(): Promise<PolicyResponseDto[]> {
    const policies = await this.prisma.policy.findMany({
      orderBy: [{ key: 'asc' }, { scopeType: 'asc' }],
    });

    return policies.map((policy) => this.mapToResponse(policy));
  }

  /**
   * Create a new policy
   */
  async createPolicy(
    dto: CreatePolicyDto,
    createdById?: string,
  ): Promise<PolicyResponseDto> {
    // Validate scope-specific IDs
    this.validateScopeIds(dto.scopeType, dto.regionId, dto.orgId, dto.serviceCategoryId);

    // Check for existing policy with same key and scope
    const existing = await this.prisma.policy.findFirst({
      where: {
        key: dto.key,
        scopeType: dto.scopeType,
        regionId: dto.regionId ?? null,
        orgId: dto.orgId ?? null,
        serviceCategoryId: dto.serviceCategoryId ?? null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Policy '${dto.key}' already exists for this scope`,
      );
    }

    const policy = await this.prisma.policy.create({
      data: {
        key: dto.key,
        description: dto.description,
        value: dto.value as any,
        scopeType: dto.scopeType,
        regionId: dto.regionId,
        orgId: dto.orgId,
        serviceCategoryId: dto.serviceCategoryId,
        createdById,
      },
    });

    // Invalidate cache for this policy key
    await this.invalidatePolicyCache(dto.key);

    this.logger.log(`Policy created: ${dto.key} (${dto.scopeType})`);

    return this.mapToResponse(policy);
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(
    id: string,
    dto: UpdatePolicyDto,
  ): Promise<PolicyResponseDto> {
    const existing = await this.prisma.policy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Policy with ID '${id}' not found`);
    }

    // If scope type is being changed, validate the new scope IDs
    const newScopeType = dto.scopeType ?? existing.scopeType;
    const newRegionId = dto.regionId !== undefined ? dto.regionId : existing.regionId;
    const newOrgId = dto.orgId !== undefined ? dto.orgId : existing.orgId;
    const newServiceCategoryId =
      dto.serviceCategoryId !== undefined
        ? dto.serviceCategoryId
        : existing.serviceCategoryId;

    this.validateScopeIds(
      newScopeType,
      newRegionId ?? undefined,
      newOrgId ?? undefined,
      newServiceCategoryId ?? undefined,
    );

    // Check for conflicts if scope is changing
    if (
      dto.scopeType !== undefined ||
      dto.regionId !== undefined ||
      dto.orgId !== undefined ||
      dto.serviceCategoryId !== undefined
    ) {
      const conflict = await this.prisma.policy.findFirst({
        where: {
          id: { not: id },
          key: existing.key,
          scopeType: newScopeType,
          regionId: newRegionId ?? null,
          orgId: newOrgId ?? null,
          serviceCategoryId: newServiceCategoryId ?? null,
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Policy '${existing.key}' already exists for this scope`,
        );
      }
    }

    const policy = await this.prisma.policy.update({
      where: { id },
      data: {
        description: dto.description,
        value: dto.value !== undefined ? (dto.value as any) : undefined,
        scopeType: dto.scopeType,
        regionId: dto.regionId,
        orgId: dto.orgId,
        serviceCategoryId: dto.serviceCategoryId,
      },
    });

    // Invalidate cache for this policy key
    await this.invalidatePolicyCache(existing.key);

    this.logger.log(`Policy updated: ${existing.key} (ID: ${id})`);

    return this.mapToResponse(policy);
  }

  /**
   * Delete a policy
   */
  async deletePolicy(id: string): Promise<{ message: string }> {
    const existing = await this.prisma.policy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Policy with ID '${id}' not found`);
    }

    await this.prisma.policy.delete({
      where: { id },
    });

    // Invalidate cache for this policy key
    await this.invalidatePolicyCache(existing.key);

    this.logger.log(`Policy deleted: ${existing.key} (ID: ${id})`);

    return { message: `Policy '${existing.key}' deleted successfully` };
  }

  /**
   * Resolve policy from database using scope hierarchy
   */
  private async resolvePolicyFromDb(
    policyKey: string,
    scopeContext?: ScopeContext,
  ): Promise<PolicyValueResponseDto | null> {
    // Build scope conditions in priority order (most specific first)
    const scopeConditions = this.buildScopeConditions(scopeContext);

    // Query all matching policies for this key
    const policies = await this.prisma.policy.findMany({
      where: {
        key: policyKey,
        OR: scopeConditions,
      },
    });

    if (policies.length === 0) {
      return null;
    }

    // Find the most specific policy based on scope hierarchy
    const resolved = this.findMostSpecificPolicy(policies, scopeContext);

    if (!resolved) {
      return null;
    }

    return {
      key: resolved.key,
      value: resolved.value,
      resolvedScopeType: resolved.scopeType,
    };
  }

  /**
   * Build scope conditions for querying policies
   */
  private buildScopeConditions(scopeContext?: ScopeContext): Array<{
    scopeType: ScopeType;
    regionId?: string | null;
    orgId?: string | null;
    serviceCategoryId?: string | null;
  }> {
    const conditions: Array<{
      scopeType: ScopeType;
      regionId?: string | null;
      orgId?: string | null;
      serviceCategoryId?: string | null;
    }> = [];

    // Always include GLOBAL scope
    conditions.push({
      scopeType: 'GLOBAL',
      regionId: null,
      orgId: null,
      serviceCategoryId: null,
    });

    if (scopeContext?.regionId) {
      conditions.push({
        scopeType: 'REGION',
        regionId: scopeContext.regionId,
        orgId: null,
        serviceCategoryId: null,
      });
    }

    if (scopeContext?.orgId) {
      conditions.push({
        scopeType: 'ORG',
        regionId: null,
        orgId: scopeContext.orgId,
        serviceCategoryId: null,
      });
    }

    if (scopeContext?.serviceCategoryId) {
      conditions.push({
        scopeType: 'SERVICE_CATEGORY',
        regionId: null,
        orgId: null,
        serviceCategoryId: scopeContext.serviceCategoryId,
      });
    }

    return conditions;
  }

  /**
   * Find the most specific policy based on scope hierarchy
   */
  private findMostSpecificPolicy(
    policies: Array<{
      key: string;
      value: unknown;
      scopeType: string;
      regionId: string | null;
      orgId: string | null;
      serviceCategoryId: string | null;
    }>,
    scopeContext?: ScopeContext,
  ): {
    key: string;
    value: unknown;
    scopeType: string;
  } | null {
    // Sort policies by scope priority (most specific first)
    const sortedPolicies = [...policies].sort((a, b) => {
      const aPriority = SCOPE_HIERARCHY.indexOf(a.scopeType as ScopeType);
      const bPriority = SCOPE_HIERARCHY.indexOf(b.scopeType as ScopeType);
      return bPriority - aPriority; // Higher priority = more specific = comes first
    });

    // Return the most specific matching policy
    for (const policy of sortedPolicies) {
      if (this.policyMatchesScopeContext(policy, scopeContext)) {
        return {
          key: policy.key,
          value: policy.value,
          scopeType: policy.scopeType,
        };
      }
    }

    return null;
  }

  /**
   * Check if a policy matches the given scope context
   */
  private policyMatchesScopeContext(
    policy: {
      scopeType: string;
      regionId: string | null;
      orgId: string | null;
      serviceCategoryId: string | null;
    },
    scopeContext?: ScopeContext,
  ): boolean {
    switch (policy.scopeType) {
      case 'GLOBAL':
        return true;
      case 'REGION':
        return policy.regionId === scopeContext?.regionId;
      case 'ORG':
        return policy.orgId === scopeContext?.orgId;
      case 'SERVICE_CATEGORY':
        return policy.serviceCategoryId === scopeContext?.serviceCategoryId;
      default:
        return false;
    }
  }

  /**
   * Build cache key for a policy
   */
  private buildCacheKey(policyKey: string, scopeContext?: ScopeContext): string {
    // Determine the most specific scope type and ID
    if (scopeContext?.serviceCategoryId) {
      return CACHE_KEYS.POLICY(policyKey, 'SERVICE_CATEGORY', scopeContext.serviceCategoryId);
    }
    if (scopeContext?.orgId) {
      return CACHE_KEYS.POLICY(policyKey, 'ORG', scopeContext.orgId);
    }
    if (scopeContext?.regionId) {
      return CACHE_KEYS.POLICY(policyKey, 'REGION', scopeContext.regionId);
    }
    return CACHE_KEYS.POLICY(policyKey, 'GLOBAL');
  }

  /**
   * Invalidate all cache entries for a policy key
   */
  private async invalidatePolicyCache(policyKey: string): Promise<void> {
    const pattern = `policy:${policyKey}:*`;
    await this.redis.delPattern(pattern);
    this.logger.debug(`Invalidated cache for policy: ${policyKey}`);
  }

  /**
   * Validate that scope-specific IDs are provided correctly
   */
  private validateScopeIds(
    scopeType: ScopeType,
    regionId?: string,
    orgId?: string,
    serviceCategoryId?: string,
  ): void {
    switch (scopeType) {
      case 'GLOBAL':
        if (regionId || orgId || serviceCategoryId) {
          throw new BadRequestException(
            'GLOBAL scope should not have regionId, orgId, or serviceCategoryId',
          );
        }
        break;
      case 'REGION':
        if (!regionId) {
          throw new BadRequestException('REGION scope requires regionId');
        }
        if (orgId || serviceCategoryId) {
          throw new BadRequestException(
            'REGION scope should not have orgId or serviceCategoryId',
          );
        }
        break;
      case 'ORG':
        if (!orgId) {
          throw new BadRequestException('ORG scope requires orgId');
        }
        if (regionId || serviceCategoryId) {
          throw new BadRequestException(
            'ORG scope should not have regionId or serviceCategoryId',
          );
        }
        break;
      case 'SERVICE_CATEGORY':
        if (!serviceCategoryId) {
          throw new BadRequestException(
            'SERVICE_CATEGORY scope requires serviceCategoryId',
          );
        }
        if (regionId || orgId) {
          throw new BadRequestException(
            'SERVICE_CATEGORY scope should not have regionId or orgId',
          );
        }
        break;
    }
  }

  /**
   * Map database entity to response DTO
   */
  private mapToResponse(policy: {
    id: string;
    key: string;
    description: string | null;
    value: unknown;
    scopeType: string;
    regionId: string | null;
    orgId: string | null;
    serviceCategoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PolicyResponseDto {
    return {
      id: policy.id,
      key: policy.key,
      description: policy.description,
      value: policy.value,
      scopeType: policy.scopeType,
      regionId: policy.regionId,
      orgId: policy.orgId,
      serviceCategoryId: policy.serviceCategoryId,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
  }
}
