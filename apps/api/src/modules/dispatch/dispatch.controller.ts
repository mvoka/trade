import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { DispatchService } from './dispatch.service';
import {
  DeclineDispatchDto,
  DispatchAttemptResponseDto,
  DispatchActionResponseDto,
  PendingDispatchResponseDto,
  DispatchHistoryResponseDto,
} from './dto/dispatch.dto';

@ApiTags('dispatch')
@Controller('dispatch')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  // TODO: Implement getPendingDispatch endpoint when service method is available

  @Post(':jobId/accept')
  @Roles('PRO_USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a dispatch request' })
  @ApiResponse({ status: 200, description: 'Dispatch accepted' })
  async acceptDispatch(
    @Param('jobId') jobId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<DispatchActionResponseDto> {
    return this.dispatchService.acceptDispatch(jobId, user.userId);
  }

  @Post(':jobId/decline')
  @Roles('PRO_USER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a dispatch request' })
  @ApiResponse({ status: 200, description: 'Dispatch declined' })
  async declineDispatch(
    @Param('jobId') jobId: string,
    @Body() declineDto: DeclineDispatchDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<DispatchActionResponseDto> {
    return this.dispatchService.declineDispatch(
      jobId,
      user.userId,
      declineDto.reasonId,
      declineDto.notes,
    );
  }

  @Get(':jobId/history')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({ summary: 'Get dispatch history for a job' })
  @ApiResponse({ status: 200, description: 'Dispatch history returned' })
  async getDispatchHistory(
    @Param('jobId') jobId: string,
  ): Promise<DispatchHistoryResponseDto> {
    return this.dispatchService.getDispatchAttempts(jobId);
  }
}
