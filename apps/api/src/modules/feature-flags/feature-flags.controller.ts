import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FeatureFlagsService } from './feature-flags.service';
import { PolicyService } from './policy.service';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  CreatePolicyDto,
  UpdatePolicyDto,
  FeatureFlagResponseDto,
  PolicyResponseDto,
  MessageResponseDto,
} from './dto/feature-flags.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { AUDIT_ACTIONS } from '@trades/shared';

@ApiTags('Admin - Feature Flags & Policies')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureFlagsController {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly policyService: PolicyService,
  ) {}

  // ============================================
  // FEATURE FLAGS ENDPOINTS
  // ============================================

  /**
   * Get all feature flags
   */
  @Get('flags')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all feature flags',
    description: 'Retrieve all feature flags across all scopes. Admin only.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all feature flags',
    type: [FeatureFlagResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async getAllFlags(): Promise<FeatureFlagResponseDto[]> {
    return this.featureFlagsService.getAllFlags();
  }

  /**
   * Create a new feature flag
   */
  @Post('flags')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @Audit({
    action: AUDIT_ACTIONS.FEATURE_FLAG_UPDATED,
    targetType: 'FeatureFlag',
    getTargetId: (_req, res) => res?.id,
  })
  @ApiOperation({
    summary: 'Create a feature flag',
    description: 'Create a new feature flag with specified scope. Admin only.',
  })
  @ApiBody({ type: CreateFeatureFlagDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Feature flag created successfully',
    type: FeatureFlagResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or scope configuration',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Feature flag already exists for this scope',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async createFlag(
    @Body() dto: CreateFeatureFlagDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<FeatureFlagResponseDto> {
    return this.featureFlagsService.createFlag(dto, user.userId);
  }

  /**
   * Update an existing feature flag
   */
  @Put('flags/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AUDIT_ACTIONS.FEATURE_FLAG_UPDATED,
    targetType: 'FeatureFlag',
    getTargetId: (req) => req.params?.id,
  })
  @ApiOperation({
    summary: 'Update a feature flag',
    description: 'Update an existing feature flag by ID. Admin only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Feature flag ID',
    example: 'ff_abc123',
  })
  @ApiBody({ type: UpdateFeatureFlagDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Feature flag updated successfully',
    type: FeatureFlagResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or scope configuration',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Feature flag not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Feature flag already exists for this scope',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async updateFlag(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlagResponseDto> {
    return this.featureFlagsService.updateFlag(id, dto);
  }

  /**
   * Delete a feature flag
   */
  @Delete('flags/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AUDIT_ACTIONS.FEATURE_FLAG_UPDATED,
    targetType: 'FeatureFlag',
    getTargetId: (req) => req.params?.id,
  })
  @ApiOperation({
    summary: 'Delete a feature flag',
    description: 'Delete a feature flag by ID. Admin only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Feature flag ID',
    example: 'ff_abc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Feature flag deleted successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Feature flag not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async deleteFlag(@Param('id') id: string): Promise<MessageResponseDto> {
    return this.featureFlagsService.deleteFlag(id);
  }

  // ============================================
  // POLICY ENDPOINTS
  // ============================================

  /**
   * Get all policies
   */
  @Get('policies')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all policies',
    description: 'Retrieve all policies across all scopes. Admin only.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all policies',
    type: [PolicyResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async getAllPolicies(): Promise<PolicyResponseDto[]> {
    return this.policyService.getAllPolicies();
  }

  /**
   * Create a new policy
   */
  @Post('policies')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @Audit({
    action: AUDIT_ACTIONS.POLICY_UPDATED,
    targetType: 'Policy',
    getTargetId: (_req, res) => res?.id,
  })
  @ApiOperation({
    summary: 'Create a policy',
    description: 'Create a new policy with specified scope. Admin only.',
  })
  @ApiBody({ type: CreatePolicyDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Policy created successfully',
    type: PolicyResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or scope configuration',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Policy already exists for this scope',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async createPolicy(
    @Body() dto: CreatePolicyDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PolicyResponseDto> {
    return this.policyService.createPolicy(dto, user.userId);
  }

  /**
   * Update an existing policy
   */
  @Put('policies/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AUDIT_ACTIONS.POLICY_UPDATED,
    targetType: 'Policy',
    getTargetId: (req) => req.params?.id,
  })
  @ApiOperation({
    summary: 'Update a policy',
    description: 'Update an existing policy by ID. Admin only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Policy ID',
    example: 'policy_xyz789',
  })
  @ApiBody({ type: UpdatePolicyDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Policy updated successfully',
    type: PolicyResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or scope configuration',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Policy not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Policy already exists for this scope',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async updatePolicy(
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
  ): Promise<PolicyResponseDto> {
    return this.policyService.updatePolicy(id, dto);
  }

  /**
   * Delete a policy
   */
  @Delete('policies/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AUDIT_ACTIONS.POLICY_UPDATED,
    targetType: 'Policy',
    getTargetId: (req) => req.params?.id,
  })
  @ApiOperation({
    summary: 'Delete a policy',
    description: 'Delete a policy by ID. Admin only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Policy ID',
    example: 'policy_xyz789',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Policy deleted successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Policy not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async deletePolicy(@Param('id') id: string): Promise<MessageResponseDto> {
    return this.policyService.deletePolicy(id);
  }
}
