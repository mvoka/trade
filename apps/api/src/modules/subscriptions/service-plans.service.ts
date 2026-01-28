import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@trades/prisma';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { FEATURE_FLAGS, ERROR_CODES } from '@trades/shared';
import {
  CreateServicePlanDto,
  UpdateServicePlanDto,
  ServicePlanResponseDto,
  ServicePlansListResponseDto,
  ServicePlansQueryDto,
} from './dto/subscriptions.dto';

/**
 * ServicePlansService - Manages subscription service plans
 *
 * Feature Flags:
 * - SUBSCRIPTIONS_ENABLED: Gates the entire module
 *
 * Service plans define recurring service offerings that consumers
 * can subscribe to (e.g., weekly pool maintenance).
 */
@Injectable()
export class ServicePlansService {
  private readonly logger = new Logger(ServicePlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  /**
   * Check if subscriptions feature is enabled
   */
  async isEnabled(regionId?: string): Promise<boolean> {
    return this.featureFlagsService.isEnabled(
      FEATURE_FLAGS.SUBSCRIPTIONS_ENABLED,
      { regionId },
    );
  }

  /**
   * Ensure subscriptions feature is enabled
   */
  async ensureEnabled(regionId?: string): Promise<void> {
    const enabled = await this.isEnabled(regionId);
    if (!enabled) {
      throw new ForbiddenException({
        message: 'Subscriptions feature is not enabled',
        errorCode: ERROR_CODES.SUBSCRIPTION_INACTIVE,
      });
    }
  }

  /**
   * List available service plans
   */
  async listPlans(query: ServicePlansQueryDto): Promise<ServicePlansListResponseDto> {
    await this.ensureEnabled();

    const where: Record<string, unknown> = {};

    // Only show active plans by default
    if (!query.includeInactive) {
      where.isActive = true;
    }

    // Only show public plans for consumers
    where.isPublic = true;

    if (query.serviceCategoryId) {
      where.serviceCategoryId = query.serviceCategoryId;
    }

    if (query.billingInterval) {
      where.billingInterval = query.billingInterval;
    }

    const plans = await this.prisma.servicePlan.findMany({
      where,
      orderBy: [
        { serviceCategoryId: 'asc' },
        { pricePerIntervalCents: 'asc' },
      ],
    });

    return {
      plans: plans.map((plan) => this.mapToResponse(plan)),
      total: plans.length,
    };
  }

  /**
   * Get service plan by ID
   */
  async getPlanById(id: string): Promise<ServicePlanResponseDto> {
    await this.ensureEnabled();

    const plan = await this.prisma.servicePlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException({
        message: 'Service plan not found',
        errorCode: ERROR_CODES.SERVICE_PLAN_NOT_FOUND,
      });
    }

    return this.mapToResponse(plan);
  }

  /**
   * Create a new service plan (Admin/Pro)
   */
  async createPlan(
    dto: CreateServicePlanDto,
    proProfileId?: string,
  ): Promise<ServicePlanResponseDto> {
    await this.ensureEnabled();

    const plan = await this.prisma.servicePlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        billingInterval: dto.billingInterval,
        pricePerIntervalCents: dto.pricePerIntervalCents,
        currency: dto.currency ?? 'CAD',
        serviceTemplate: dto.serviceTemplate as Prisma.InputJsonValue,
        visitsPerInterval: dto.visitsPerInterval ?? 1,
        estimatedDurationMins: dto.estimatedDurationMins,
        serviceCategoryId: dto.serviceCategoryId,
        proProfileId,
        isActive: true,
        isPublic: dto.isPublic ?? true,
      },
    });

    this.logger.log(`Service plan created: ${plan.name} (${plan.id})`);

    return this.mapToResponse(plan);
  }

  /**
   * Update a service plan
   */
  async updatePlan(
    id: string,
    dto: UpdateServicePlanDto,
    actorProProfileId?: string,
  ): Promise<ServicePlanResponseDto> {
    await this.ensureEnabled();

    const existing = await this.prisma.servicePlan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Service plan not found',
        errorCode: ERROR_CODES.SERVICE_PLAN_NOT_FOUND,
      });
    }

    // If pro-specific plan, verify ownership
    if (existing.proProfileId && existing.proProfileId !== actorProProfileId) {
      throw new ForbiddenException('Cannot modify another pro\'s service plan');
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.pricePerIntervalCents !== undefined) updateData.pricePerIntervalCents = dto.pricePerIntervalCents;
    if (dto.serviceTemplate !== undefined) updateData.serviceTemplate = dto.serviceTemplate;
    if (dto.visitsPerInterval !== undefined) updateData.visitsPerInterval = dto.visitsPerInterval;
    if (dto.estimatedDurationMins !== undefined) updateData.estimatedDurationMins = dto.estimatedDurationMins;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.isPublic !== undefined) updateData.isPublic = dto.isPublic;

    const plan = await this.prisma.servicePlan.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Service plan updated: ${plan.name} (${plan.id})`);

    return this.mapToResponse(plan);
  }

  /**
   * Deactivate a service plan (soft delete)
   */
  async deactivatePlan(id: string, actorProProfileId?: string): Promise<ServicePlanResponseDto> {
    await this.ensureEnabled();

    const existing = await this.prisma.servicePlan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Service plan not found',
        errorCode: ERROR_CODES.SERVICE_PLAN_NOT_FOUND,
      });
    }

    // If pro-specific plan, verify ownership
    if (existing.proProfileId && existing.proProfileId !== actorProProfileId) {
      throw new ForbiddenException('Cannot deactivate another pro\'s service plan');
    }

    const plan = await this.prisma.servicePlan.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Service plan deactivated: ${plan.name} (${plan.id})`);

    return this.mapToResponse(plan);
  }

  /**
   * Get plans for a specific pro
   */
  async getProPlans(proProfileId: string): Promise<ServicePlansListResponseDto> {
    await this.ensureEnabled();

    const plans = await this.prisma.servicePlan.findMany({
      where: { proProfileId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      plans: plans.map((plan) => this.mapToResponse(plan)),
      total: plans.length,
    };
  }

  /**
   * Map database entity to response DTO
   */
  private mapToResponse(plan: {
    id: string;
    name: string;
    description: string | null;
    billingInterval: string;
    pricePerIntervalCents: number;
    currency: string;
    serviceTemplate: unknown;
    visitsPerInterval: number;
    estimatedDurationMins: number | null;
    serviceCategoryId: string | null;
    proProfileId: string | null;
    isActive: boolean;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ServicePlanResponseDto {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description ?? undefined,
      billingInterval: plan.billingInterval,
      pricePerIntervalCents: plan.pricePerIntervalCents,
      currency: plan.currency,
      serviceTemplate: plan.serviceTemplate as Record<string, unknown>,
      visitsPerInterval: plan.visitsPerInterval,
      estimatedDurationMins: plan.estimatedDurationMins ?? undefined,
      serviceCategoryId: plan.serviceCategoryId ?? undefined,
      proProfileId: plan.proProfileId ?? undefined,
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
