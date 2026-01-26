import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { ProsService } from './pros.service';
import {
  CreateProProfileDto,
  UpdateProProfileDto,
  ServiceAreaDto,
  UpdateServiceHoursDto,
  SearchProsInRadiusDto,
  ProProfileResponseDto,
  ProProfileWithDistanceResponseDto,
} from './dto/pros.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@trades/shared';

@ApiTags('Pro Profiles')
@Controller('pros')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProsController {
  constructor(private readonly prosService: ProsService) {}

  /**
   * Onboard as a pro - create pro profile
   */
  @Post('onboard')
  @Roles(UserRole.PRO_USER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create pro profile (onboarding)',
    description:
      'Create a professional profile for the authenticated user. Only PRO_USER role can access this endpoint.',
  })
  @ApiBody({ type: CreateProProfileDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Pro profile created successfully',
    type: ProProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Pro profile already exists',
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
    description: 'User is not a PRO_USER',
  })
  async createProProfile(
    @Body() dto: CreateProProfileDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ProProfileResponseDto> {
    return this.prosService.createProProfile(user.userId, dto);
  }

  /**
   * Get current user's pro profile
   */
  @Get('profile')
  @Roles(UserRole.PRO_USER)
  @ApiOperation({
    summary: 'Get current user pro profile',
    description: "Get the authenticated user's professional profile with all related data.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pro profile details',
    type: ProProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pro profile not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a PRO_USER',
  })
  async getMyProProfile(@CurrentUser() user: CurrentUserData): Promise<ProProfileResponseDto> {
    return this.prosService.getProProfile(user.userId);
  }

  /**
   * Update current user's pro profile
   */
  @Put('profile')
  @Roles(UserRole.PRO_USER)
  @ApiOperation({
    summary: 'Update pro profile',
    description: "Update the authenticated user's professional profile.",
  })
  @ApiBody({ type: UpdateProProfileDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pro profile updated successfully',
    type: ProProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pro profile not found',
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
    description: 'User is not a PRO_USER',
  })
  async updateMyProProfile(
    @Body() dto: UpdateProProfileDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ProProfileResponseDto> {
    return this.prosService.updateProProfile(user.userId, dto);
  }

  /**
   * Update service area
   */
  @Put('service-area')
  @Roles(UserRole.PRO_USER)
  @ApiOperation({
    summary: 'Update service area',
    description: "Update the pro's service area (location and radius).",
  })
  @ApiBody({ type: ServiceAreaDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service area updated successfully',
    type: ProProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pro profile not found',
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
    description: 'User is not a PRO_USER',
  })
  async updateServiceArea(
    @Body() dto: ServiceAreaDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ProProfileResponseDto> {
    // Get the user's pro profile ID
    if (!user.proProfileId) {
      throw new ForbiddenException('No pro profile found for this user');
    }
    return this.prosService.updateServiceArea(user.proProfileId, dto);
  }

  /**
   * Update service hours
   */
  @Put('service-hours')
  @Roles(UserRole.PRO_USER)
  @ApiOperation({
    summary: 'Update service hours',
    description: "Update the pro's service hours for each day of the week.",
  })
  @ApiBody({ type: UpdateServiceHoursDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service hours updated successfully',
    type: ProProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pro profile not found',
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
    description: 'User is not a PRO_USER',
  })
  async updateServiceHours(
    @Body() dto: UpdateServiceHoursDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ProProfileResponseDto> {
    // Get the user's pro profile ID
    if (!user.proProfileId) {
      throw new ForbiddenException('No pro profile found for this user');
    }
    return this.prosService.updateServiceHours(user.proProfileId, dto.hours);
  }

  /**
   * Get pros by category (internal use)
   */
  @Get('categories/:categoryId')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'List pros by category',
    description:
      'Get all professional profiles that offer a specific service category. Internal use only.',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Service category ID',
    type: String,
  })
  @ApiQuery({
    name: 'onlyVerified',
    description: 'Only return verified pros',
    required: false,
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of pro profiles',
    type: [ProProfileResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Service category not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async getProsByCategory(
    @Param('categoryId') categoryId: string,
    @Query('onlyVerified') onlyVerified?: string,
  ): Promise<ProProfileResponseDto[]> {
    const verified = onlyVerified !== 'false';
    return this.prosService.getProsByCategory(categoryId, verified);
  }

  /**
   * Search pros within radius (internal use for dispatch)
   */
  @Post('search/radius')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SMB_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Find pros within radius',
    description:
      'Search for professional profiles within a given radius of a location. Used by dispatch system.',
  })
  @ApiBody({ type: SearchProsInRadiusDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of pro profiles with distance and ranking',
    type: [ProProfileWithDistanceResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async searchProsInRadius(
    @Body() dto: SearchProsInRadiusDto,
  ): Promise<ProProfileWithDistanceResponseDto[]> {
    return this.prosService.getProsInRadius(dto.lat, dto.lng, dto.radiusKm, dto.categoryId);
  }

  /**
   * Get pro profile by ID (for viewing other pros)
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get pro profile by ID',
    description: 'Get a professional profile by its ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Pro profile ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pro profile details',
    type: ProProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pro profile not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getProProfile(@Param('id') id: string): Promise<ProProfileResponseDto> {
    return this.prosService.getProProfileById(id);
  }
}
