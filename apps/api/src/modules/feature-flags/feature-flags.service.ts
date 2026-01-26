import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ScopeType, ScopeContext, CACHE_KEYS, CACHE_TTL } from '@trades/shared';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  FeatureFlagResponseDto,
  FeatureFlagValueResponseDto,
} from './dto/feature-flags.dto';

// Scope hierarchy: SERVICE_CATEGORY > ORG > REGION > GLOBAL
// Higher index = more specific = higher priority
const SCOPE_HIERARCHY: ScopeType[] = ['GLOBAL', 'REGION', 'ORG', 'SERVICE_CATEGORY'];

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Check if a feature flag is enabled for a given scope context
   * Uses scope resolution hierarchy: SERVICE_CATEGORY > ORG > REGION > GLOBAL
   */
  async isEnabled(flagKey: string, scopeContext?: ScopeContext): Promise<boolean> {
    const resolved = await this.getFlag(flagKey, scopeContext);
    return resolved?.enabled ?? false;
  }

  /**
   * Get a feature flag with scope resolution
   * Returns the most specific flag that matches the scope context
   */
  async getFlag(
    flagKey: string,
    scopeContext?: ScopeContext,
  ): Promise<FeatureFlagValueResponseDto | null> {
    // Build cache key based on the most specific scope
    const cacheKey = this.buildCacheKey(flagKey, scopeContext);

    // Try to get from cache first
    const cached = await this.redis.getJson<FeatureFlagValueResponseDto>(cacheKey);
    if (cached !== null) {
      this.logger.debug(`Cache hit for feature flag: ${flagKey}`);
      return cached;
    }

    // Resolve flag from database using scope hierarchy
    const resolved = await this.resolveFlagFromDb(flagKey, scopeContext);

    if (resolved) {
      // Cache the resolved value
      await this.redis.setJson(cacheKey, resolved, CACHE_TTL.FEATURE_FLAG);
    }

    return resolved;
  }

  /**
   * Get all feature flags (admin endpoint)
   */
  async getAllFlags(): Promise<FeatureFlagResponseDto[]> {
    const flags = await this.prisma.featureFlag.findMany({
      orderBy: [{ key: 'asc' }, { scopeType: 'asc' }],
    });

    return flags.map((flag) => this.mapToResponse(flag));
  }

  /**
   * Create a new feature flag
   */
  async createFlag(
    dto: CreateFeatureFlagDto,
    createdById?: string,
  ): Promise<FeatureFlagResponseDto> {
    // Validate scope-specific IDs
    this.validateScopeIds(dto.scopeType, dto.regionId, dto.orgId, dto.serviceCategoryId);

    // Check for existing flag with same key and scope
    const existing = await this.prisma.featureFlag.findFirst({
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
        `Feature flag '${dto.key}' already exists for this scope`,
      );
    }

    const flag = await this.prisma.featureFlag.create({
      data: {
        key: dto.key,
        description: dto.description,
        enabled: dto.enabled,
        scopeType: dto.scopeType,
        regionId: dto.regionId,
        orgId: dto.orgId,
        serviceCategoryId: dto.serviceCategoryId,
        createdById,
      },
    });

    // Invalidate cache for this flag key
    await this.invalidateFlagCache(dto.key);

    this.logger.log(`Feature flag created: ${dto.key} (${dto.scopeType})`);

    return this.mapToResponse(flag);
  }

  /**
   * Update an existing feature flag
   */
  async updateFlag(
    id: string,
    dto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlagResponseDto> {
    const existing = await this.prisma.featureFlag.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Feature flag with ID '${id}' not found`);
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
      const conflict = await this.prisma.featureFlag.findFirst({
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
          `Feature flag '${existing.key}' already exists for this scope`,
        );
      }
    }

    const flag = await this.prisma.featureFlag.update({
      where: { id },
      data: {
        description: dto.description,
        enabled: dto.enabled,
        scopeType: dto.scopeType,
        regionId: dto.regionId,
        orgId: dto.orgId,
        serviceCategoryId: dto.serviceCategoryId,
      },
    });

    // Invalidate cache for this flag key
    await this.invalidateFlagCache(existing.key);

    this.logger.log(`Feature flag updated: ${existing.key} (ID: ${id})`);

    return this.mapToResponse(flag);
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(id: string): Promise<{ message: string }> {
    const existing = await this.prisma.featureFlag.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Feature flag with ID '${id}' not found`);
    }

    await this.prisma.featureFlag.delete({
      where: { id },
    });

    // Invalidate cache for this flag key
    await this.invalidateFlagCache(existing.key);

    this.logger.log(`Feature flag deleted: ${existing.key} (ID: ${id})`);

    return { message: `Feature flag '${existing.key}' deleted successfully` };
  }

  /**
   * Resolve feature flag from database using scope hierarchy
   */
  private async resolveFlagFromDb(
    flagKey: string,
    scopeContext?: ScopeContext,
  ): Promise<FeatureFlagValueResponseDto | null> {
    // Build scope conditions in priority order (most specific first)
    const scopeConditions = this.buildScopeConditions(scopeContext);

    // Query all matching flags for this key
    const flags = await this.prisma.featureFlag.findMany({
      where: {
        key: flagKey,
        OR: scopeConditions,
      },
    });

    if (flags.length === 0) {
      return null;
    }

    // Find the most specific flag based on scope hierarchy
    const resolved = this.findMostSpecificFlag(flags, scopeContext);

    if (!resolved) {
      return null;
    }

    return {
      key: resolved.key,
      enabled: resolved.enabled,
      resolvedScopeType: resolved.scopeType,
    };
  }

  /**
   * Build scope conditions for querying flags
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
   * Find the most specific flag based on scope hierarchy
   */
  private findMostSpecificFlag(
    flags: Array<{
      key: string;
      enabled: boolean;
      scopeType: string;
      regionId: string | null;
      orgId: string | null;
      serviceCategoryId: string | null;
    }>,
    scopeContext?: ScopeContext,
  ): {
    key: string;
    enabled: boolean;
    scopeType: string;
  } | null {
    // Sort flags by scope priority (most specific first)
    const sortedFlags = [...flags].sort((a, b) => {
      const aPriority = SCOPE_HIERARCHY.indexOf(a.scopeType as ScopeType);
      const bPriority = SCOPE_HIERARCHY.indexOf(b.scopeType as ScopeType);
      return bPriority - aPriority; // Higher priority = more specific = comes first
    });

    // Return the most specific matching flag
    for (const flag of sortedFlags) {
      if (this.flagMatchesScopeContext(flag, scopeContext)) {
        return {
          key: flag.key,
          enabled: flag.enabled,
          scopeType: flag.scopeType,
        };
      }
    }

    return null;
  }

  /**
   * Check if a flag matches the given scope context
   */
  private flagMatchesScopeContext(
    flag: {
      scopeType: string;
      regionId: string | null;
      orgId: string | null;
      serviceCategoryId: string | null;
    },
    scopeContext?: ScopeContext,
  ): boolean {
    switch (flag.scopeType) {
      case 'GLOBAL':
        return true;
      case 'REGION':
        return flag.regionId === scopeContext?.regionId;
      case 'ORG':
        return flag.orgId === scopeContext?.orgId;
      case 'SERVICE_CATEGORY':
        return flag.serviceCategoryId === scopeContext?.serviceCategoryId;
      default:
        return false;
    }
  }

  /**
   * Build cache key for a feature flag
   */
  private buildCacheKey(flagKey: string, scopeContext?: ScopeContext): string {
    // Determine the most specific scope type and ID
    if (scopeContext?.serviceCategoryId) {
      return CACHE_KEYS.FEATURE_FLAG(flagKey, 'SERVICE_CATEGORY', scopeContext.serviceCategoryId);
    }
    if (scopeContext?.orgId) {
      return CACHE_KEYS.FEATURE_FLAG(flagKey, 'ORG', scopeContext.orgId);
    }
    if (scopeContext?.regionId) {
      return CACHE_KEYS.FEATURE_FLAG(flagKey, 'REGION', scopeContext.regionId);
    }
    return CACHE_KEYS.FEATURE_FLAG(flagKey, 'GLOBAL');
  }

  /**
   * Invalidate all cache entries for a feature flag key
   */
  private async invalidateFlagCache(flagKey: string): Promise<void> {
    const pattern = `ff:${flagKey}:*`;
    await this.redis.delPattern(pattern);
    this.logger.debug(`Invalidated cache for feature flag: ${flagKey}`);
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
  private mapToResponse(flag: {
    id: string;
    key: string;
    description: string | null;
    enabled: boolean;
    scopeType: string;
    regionId: string | null;
    orgId: string | null;
    serviceCategoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): FeatureFlagResponseDto {
    return {
      id: flag.id,
      key: flag.key,
      description: flag.description,
      enabled: flag.enabled,
      scopeType: flag.scopeType,
      regionId: flag.regionId,
      orgId: flag.orgId,
      serviceCategoryId: flag.serviceCategoryId,
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
    };
  }
}
