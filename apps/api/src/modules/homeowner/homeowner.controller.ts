import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { HomeownerService } from './homeowner.service';
import {
  RegisterHomeownerDto,
  UpdateConsumerProfileDto,
  HomeownerResponseDto,
  HomeownerRegistrationResponseDto,
  HomeownerSubscriptionsResponseDto,
  HomeownerJobsResponseDto,
  HomeownerJobsQueryDto,
} from './dto/homeowner.dto';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

/**
 * HomeownerController - API endpoints for homeowner/consumer operations
 *
 * All endpoints are gated by HOMEOWNER_MARKETPLACE_ENABLED feature flag.
 * Admins can enable/disable the homeowner marketplace per region.
 *
 * Endpoints:
 * - POST /homeowner/register - Consumer registration (public)
 * - GET /homeowner/profile - Get consumer profile (authenticated)
 * - PUT /homeowner/profile - Update profile (authenticated)
 * - GET /homeowner/subscriptions - List subscriptions (authenticated)
 * - GET /homeowner/jobs - List jobs (authenticated)
 */
@ApiTags('Homeowner')
@Controller('homeowner')
export class HomeownerController {
  constructor(private readonly homeownerService: HomeownerService) {}

  /**
   * Register a new homeowner/consumer
   * Feature flagged: HOMEOWNER_MARKETPLACE_ENABLED
   */
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register homeowner',
    description: 'Register a new homeowner/consumer account. Requires HOMEOWNER_MARKETPLACE_ENABLED feature flag.',
  })
  @ApiBody({ type: RegisterHomeownerDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Homeowner registered successfully',
    type: HomeownerRegistrationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email already registered',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Homeowner marketplace is not enabled',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async register(
    @Body() dto: RegisterHomeownerDto,
    @Req() req: Request,
  ): Promise<HomeownerRegistrationResponseDto> {
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString();
    const userAgent = req.headers['user-agent'];

    return this.homeownerService.register(dto, ipAddress, userAgent);
  }

  /**
   * Get current homeowner profile
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get homeowner profile',
    description: 'Retrieve the profile of the currently authenticated homeowner.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile retrieved successfully',
    type: HomeownerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a consumer',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Profile not found',
  })
  async getProfile(@CurrentUser() user: CurrentUserData): Promise<HomeownerResponseDto> {
    return this.homeownerService.getProfile(user.userId);
  }

  /**
   * Update current homeowner profile
   */
  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update homeowner profile',
    description: 'Update the profile of the currently authenticated homeowner.',
  })
  @ApiBody({ type: UpdateConsumerProfileDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
    type: HomeownerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a consumer',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Profile not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async updateProfile(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateConsumerProfileDto,
  ): Promise<HomeownerResponseDto> {
    return this.homeownerService.updateProfile(user.userId, dto);
  }

  /**
   * Get homeowner subscriptions
   * Feature flagged: SUBSCRIPTIONS_ENABLED
   */
  @Get('subscriptions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get homeowner subscriptions',
    description: 'Retrieve all subscriptions for the current homeowner. Requires SUBSCRIPTIONS_ENABLED feature flag.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscriptions retrieved successfully',
    type: HomeownerSubscriptionsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getSubscriptions(
    @CurrentUser() user: CurrentUserData,
  ): Promise<HomeownerSubscriptionsResponseDto> {
    return this.homeownerService.getSubscriptions(user.userId);
  }

  /**
   * Get homeowner jobs history
   */
  @Get('jobs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get homeowner jobs',
    description: 'Retrieve job history for the current homeowner with pagination.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Jobs retrieved successfully',
    type: HomeownerJobsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  async getJobs(
    @CurrentUser() user: CurrentUserData,
    @Query() query: HomeownerJobsQueryDto,
  ): Promise<HomeownerJobsResponseDto> {
    return this.homeownerService.getJobs(user.userId, query);
  }
}
