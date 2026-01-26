import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { PreferredService } from './preferred.service';
import {
  AddPreferredDto,
  PreferredResponseDto,
  IsPreferredResponseDto,
  PreferredMessageResponseDto,
} from './dto/preferred.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@trades/shared';

@ApiTags('Preferred Contractors')
@Controller('preferred')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PreferredController {
  constructor(private readonly preferredService: PreferredService) {}

  /**
   * Add a contractor to preferred list
   */
  @Post()
  @Roles(UserRole.SMB_USER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add preferred contractor',
    description:
      'Add a pro to your preferred contractors list. Only available for SMB users when the ENABLE_PREFERRED_CONTRACTOR feature is enabled.',
  })
  @ApiBody({ type: AddPreferredDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Contractor added to preferred list successfully',
    type: PreferredResponseDto,
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
    description: 'Access denied - SMB_USER role required or feature is disabled',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Pro profile not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Contractor is already in preferred list',
  })
  async addPreferred(
    @Body() dto: AddPreferredDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PreferredResponseDto> {
    return this.preferredService.addPreferred(
      user.userId,
      dto.proProfileId,
      dto.notes,
    );
  }

  /**
   * Remove a contractor from preferred list
   */
  @Delete(':proProfileId')
  @Roles(UserRole.SMB_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove preferred contractor',
    description:
      'Remove a pro from your preferred contractors list. Only available for SMB users when the ENABLE_PREFERRED_CONTRACTOR feature is enabled.',
  })
  @ApiParam({
    name: 'proProfileId',
    description: 'Pro profile ID to remove from preferred list',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contractor removed from preferred list successfully',
    type: PreferredMessageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - SMB_USER role required or feature is disabled',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Contractor not found in preferred list',
  })
  async removePreferred(
    @Param('proProfileId') proProfileId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PreferredMessageResponseDto> {
    return this.preferredService.removePreferred(user.userId, proProfileId);
  }

  /**
   * Get all preferred contractors
   */
  @Get()
  @Roles(UserRole.SMB_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get my preferred contractors',
    description:
      'Get a list of all contractors in your preferred list. Only available for SMB users when the ENABLE_PREFERRED_CONTRACTOR feature is enabled.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of preferred contractors',
    type: [PreferredResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - SMB_USER role required or feature is disabled',
  })
  async getPreferredContractors(
    @CurrentUser() user: CurrentUserData,
  ): Promise<PreferredResponseDto[]> {
    return this.preferredService.getPreferredContractors(user.userId);
  }

  /**
   * Check if a pro is in preferred list
   */
  @Get('check/:proProfileId')
  @Roles(UserRole.SMB_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check if pro is preferred',
    description:
      'Check if a specific pro is in your preferred contractors list. Only available for SMB users when the ENABLE_PREFERRED_CONTRACTOR feature is enabled.',
  })
  @ApiParam({
    name: 'proProfileId',
    description: 'Pro profile ID to check',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferred status check result',
    type: IsPreferredResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - SMB_USER role required or feature is disabled',
  })
  async isPreferred(
    @Param('proProfileId') proProfileId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<IsPreferredResponseDto> {
    return this.preferredService.isPreferred(user.userId, proProfileId);
  }
}
