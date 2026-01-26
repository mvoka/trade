import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { OrgsService } from './orgs.service';
import {
  CreateOrgDto,
  UpdateOrgDto,
  AddMemberDto,
  OrgResponseDto,
  OrgMemberResponseDto,
  OrgWithMembershipResponseDto,
} from './dto/orgs.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@trades/shared';

@ApiTags('Organizations')
@Controller('orgs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  /**
   * Create a new organization
   */
  @Post()
  @Roles(UserRole.PRO_USER, UserRole.SMB_USER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create organization',
    description: 'Create a new organization. The authenticated user becomes the owner.',
  })
  @ApiBody({ type: CreateOrgDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Organization created successfully',
    type: OrgResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async createOrg(
    @Body() dto: CreateOrgDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<OrgResponseDto> {
    return this.orgsService.createOrg(dto, user.userId);
  }

  /**
   * Get organization by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get organization',
    description: 'Get organization details by ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Organization details',
    type: OrgResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Organization not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getOrg(@Param('id') id: string): Promise<OrgResponseDto> {
    return this.orgsService.getOrg(id, true);
  }

  /**
   * Update organization
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update organization',
    description: 'Update organization details. Only org owners and admins can update.',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization ID',
    type: String,
  })
  @ApiBody({ type: UpdateOrgDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Organization updated successfully',
    type: OrgResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Organization not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async updateOrg(
    @Param('id') id: string,
    @Body() dto: UpdateOrgDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<OrgResponseDto> {
    // Check if user has permission to update (owner or admin)
    const hasPermission = await this.orgsService.checkMembership(id, user.userId, [
      'owner',
      'admin',
    ]);

    // Also allow system admins
    if (!hasPermission && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You must be an organization owner or admin to update this organization',
      );
    }

    return this.orgsService.updateOrg(id, dto);
  }

  /**
   * Add member to organization
   */
  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add member to organization',
    description: 'Add a user as a member to the organization. Only owners and admins can add members.',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization ID',
    type: String,
  })
  @ApiBody({ type: AddMemberDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Member added successfully',
    type: OrgMemberResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Organization or user not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User is already a member',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async addMember(
    @Param('id') orgId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<OrgMemberResponseDto> {
    // Check if user has permission to add members (owner or admin)
    const hasPermission = await this.orgsService.checkMembership(orgId, user.userId, [
      'owner',
      'admin',
    ]);

    // Also allow system admins
    if (!hasPermission && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You must be an organization owner or admin to add members',
      );
    }

    // Only owners can add other owners or admins
    const requesterRole = await this.orgsService.getMemberRole(orgId, user.userId);
    if (
      dto.role &&
      (dto.role === 'owner' || dto.role === 'admin') &&
      requesterRole !== 'owner' &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Only organization owners can add owners or admins');
    }

    return this.orgsService.addMember(orgId, dto.userId, dto.role || 'member');
  }

  /**
   * Remove member from organization
   */
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove member from organization',
    description: 'Remove a user from the organization. Only owners and admins can remove members.',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization ID',
    type: String,
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to remove',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member removed successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Organization or member not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions or cannot remove last owner',
  })
  async removeMember(
    @Param('id') orgId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ message: string }> {
    // Check if user has permission to remove members (owner or admin)
    const hasPermission = await this.orgsService.checkMembership(orgId, user.userId, [
      'owner',
      'admin',
    ]);

    // Also allow system admins or users removing themselves
    const isSelfRemoval = user.userId === userId;
    if (!hasPermission && !isSelfRemoval && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You must be an organization owner or admin to remove members',
      );
    }

    // Only owners can remove admins or other owners
    const targetRole = await this.orgsService.getMemberRole(orgId, userId);
    const requesterRole = await this.orgsService.getMemberRole(orgId, user.userId);
    if (
      targetRole &&
      (targetRole === 'owner' || targetRole === 'admin') &&
      requesterRole !== 'owner' &&
      !isSelfRemoval &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Only organization owners can remove owners or admins');
    }

    return this.orgsService.removeMember(orgId, userId);
  }

  /**
   * Get organization members
   */
  @Get(':id/members')
  @ApiOperation({
    summary: 'List organization members',
    description: 'Get all active members of an organization.',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of organization members',
    type: [OrgMemberResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Organization not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getOrgMembers(@Param('id') orgId: string): Promise<OrgMemberResponseDto[]> {
    return this.orgsService.getOrgMembers(orgId);
  }

  /**
   * Get current user's organizations
   */
  @Get()
  @ApiOperation({
    summary: 'List user organizations',
    description: 'Get all organizations the current user belongs to.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of user organizations',
    type: [OrgWithMembershipResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getMyOrgs(@CurrentUser() user: CurrentUserData): Promise<OrgWithMembershipResponseDto[]> {
    return this.orgsService.getOrgsByUser(user.userId);
  }
}
