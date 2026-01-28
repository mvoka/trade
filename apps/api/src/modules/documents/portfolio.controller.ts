import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import {
  UpdatePortfolioSettingsDto,
  AddPortfolioItemFromJobDto,
  PortfolioResponseDto,
  PublicPortfolioResponseDto,
  PortfolioStatsResponseDto,
} from './dto/portfolio.dto';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@trades/shared';

/**
 * PortfolioController - API endpoints for portfolio management
 *
 * Feature Flags:
 * - PRO_PORTFOLIO_ENABLED: Gates the entire feature
 *
 * Endpoints:
 * - Public: View published portfolios
 * - Pro Users: Manage their own portfolio
 */
@ApiTags('Portfolio')
@Controller()
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  /**
   * Get public portfolio by slug (no auth required)
   */
  @Get('portfolio/:slug')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get public portfolio',
    description: 'View a published portfolio by its URL slug. No authentication required.',
  })
  @ApiParam({ name: 'slug', description: 'Portfolio URL slug' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio retrieved successfully',
    type: PublicPortfolioResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Portfolio not found or not published',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Portfolio feature is not enabled',
  })
  async getPublicPortfolio(@Param('slug') slug: string): Promise<PublicPortfolioResponseDto> {
    return this.portfolioService.getPublicPortfolio(slug);
  }

  /**
   * Check slug availability (public)
   */
  @Get('portfolio/check-slug/:slug')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check slug availability',
    description: 'Check if a portfolio URL slug is available.',
  })
  @ApiParam({ name: 'slug', description: 'Slug to check' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Availability check result',
  })
  async checkSlugAvailability(
    @Param('slug') slug: string,
  ): Promise<{ available: boolean }> {
    return this.portfolioService.checkSlugAvailability(slug);
  }

  // ============================================
  // PRO USER ENDPOINTS
  // ============================================

  /**
   * Get my portfolio
   */
  @Get('my-portfolio/:proProfileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PRO_USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get my portfolio',
    description: 'Get the authenticated pro user\'s portfolio. Creates one if it doesn\'t exist.',
  })
  @ApiParam({ name: 'proProfileId', description: 'Pro profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio retrieved successfully',
    type: PortfolioResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied to this pro profile',
  })
  async getMyPortfolio(
    @Param('proProfileId') proProfileId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PortfolioResponseDto> {
    return this.portfolioService.getOrCreatePortfolio(proProfileId, user.userId);
  }

  /**
   * Update portfolio settings
   */
  @Put('my-portfolio/:proProfileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PRO_USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update portfolio settings',
    description: 'Update portfolio settings like slug, headline, bio, theme, etc.',
  })
  @ApiParam({ name: 'proProfileId', description: 'Pro profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio updated successfully',
    type: PortfolioResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or slug already taken',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied to this pro profile',
  })
  async updatePortfolioSettings(
    @Param('proProfileId') proProfileId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdatePortfolioSettingsDto,
  ): Promise<PortfolioResponseDto> {
    return this.portfolioService.updateSettings(proProfileId, user.userId, dto);
  }

  /**
   * Publish portfolio
   */
  @Put('my-portfolio/:proProfileId/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PRO_USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish portfolio',
    description: 'Make the portfolio publicly visible. Requires at least one public item with customer opt-in.',
  })
  @ApiParam({ name: 'proProfileId', description: 'Pro profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio published successfully',
    type: PortfolioResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot publish without public items or already published',
  })
  async publishPortfolio(
    @Param('proProfileId') proProfileId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PortfolioResponseDto> {
    return this.portfolioService.publishPortfolio(proProfileId, user.userId);
  }

  /**
   * Unpublish portfolio
   */
  @Put('my-portfolio/:proProfileId/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PRO_USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unpublish portfolio',
    description: 'Hide the portfolio from public view.',
  })
  @ApiParam({ name: 'proProfileId', description: 'Pro profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio unpublished successfully',
    type: PortfolioResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Portfolio is not published',
  })
  async unpublishPortfolio(
    @Param('proProfileId') proProfileId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PortfolioResponseDto> {
    return this.portfolioService.unpublishPortfolio(proProfileId, user.userId);
  }

  /**
   * Get portfolio stats
   */
  @Get('my-portfolio/:proProfileId/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PRO_USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get portfolio stats',
    description: 'Get statistics about the portfolio including views, items, and opt-in status.',
  })
  @ApiParam({ name: 'proProfileId', description: 'Pro profile ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Stats retrieved successfully',
    type: PortfolioStatsResponseDto,
  })
  async getPortfolioStats(
    @Param('proProfileId') proProfileId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PortfolioStatsResponseDto> {
    return this.portfolioService.getPortfolioStats(proProfileId, user.userId);
  }

  /**
   * Add item from completed job
   */
  @Post('my-portfolio/:proProfileId/items/from-job')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PRO_USER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add item from completed job',
    description: 'Add photos from a completed job to the portfolio. Requires customer opt-in.',
  })
  @ApiParam({ name: 'proProfileId', description: 'Pro profile ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Items added successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'No photos available or invalid input',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found or not completed',
  })
  async addItemFromJob(
    @Param('proProfileId') proProfileId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AddPortfolioItemFromJobDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.portfolioService.addItemFromJob(proProfileId, user.userId, dto);
    return { success: true, message: 'Items added to portfolio' };
  }
}
