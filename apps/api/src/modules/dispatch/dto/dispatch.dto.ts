import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { DispatchAttemptStatus } from '@trades/shared';

// ============================================
// DECLINE DISPATCH DTO
// ============================================
export class DeclineDispatchDto {
  @ApiProperty({
    description: 'ID of the decline reason',
    example: 'clx1234567890',
  })
  @IsString()
  @IsUUID()
  reasonId: string;

  @ApiPropertyOptional({
    description: 'Additional notes for declining',
    example: 'Already booked for the day',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

// ============================================
// DISPATCH ATTEMPT RESPONSE DTO
// ============================================
export class DispatchAttemptResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the dispatch attempt',
    example: 'clx1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Job ID this dispatch is for',
    example: 'clx9876543210',
  })
  jobId: string;

  @ApiProperty({
    description: 'Pro profile ID receiving this dispatch',
    example: 'clx5555555555',
  })
  proProfileId: string;

  @ApiProperty({
    description: 'Attempt number (1-indexed)',
    example: 1,
  })
  attemptNumber: number;

  @ApiProperty({
    description: 'Current status of the dispatch attempt',
    enum: DispatchAttemptStatus,
    example: 'PENDING',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Decline reason ID if declined',
    example: 'clx1111111111',
  })
  declineReasonId?: string | null;

  @ApiPropertyOptional({
    description: 'Decline notes if provided',
    example: 'Not available that day',
  })
  declineNotes?: string | null;

  @ApiProperty({
    description: 'When the dispatch was sent',
    example: '2024-01-15T10:30:00.000Z',
  })
  dispatchedAt: Date;

  @ApiPropertyOptional({
    description: 'When the pro responded',
    example: '2024-01-15T10:32:00.000Z',
  })
  respondedAt?: Date | null;

  @ApiProperty({
    description: 'SLA deadline for response',
    example: '2024-01-15T10:35:00.000Z',
  })
  slaDeadline: Date;

  @ApiPropertyOptional({
    description: 'Pro ranking score used for this dispatch',
    example: 0.85,
  })
  ranking?: number | null;

  @ApiPropertyOptional({
    description: 'Distance to job location in km',
    example: 12.5,
  })
  distance?: number | null;

  @ApiProperty({
    description: 'When the record was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;
}

// ============================================
// DISPATCH ATTEMPT WITH PRO RESPONSE DTO
// ============================================
export class DispatchAttemptWithProDto extends DispatchAttemptResponseDto {
  @ApiPropertyOptional({
    description: 'Pro profile details',
  })
  proProfile?: {
    id: string;
    businessName?: string | null;
    businessPhone?: string | null;
    user?: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string;
    };
  };
}

// ============================================
// PENDING DISPATCH RESPONSE DTO
// ============================================
export class PendingDispatchResponseDto {
  @ApiProperty({
    description: 'Dispatch attempt details',
    type: DispatchAttemptResponseDto,
  })
  dispatch: DispatchAttemptResponseDto;

  @ApiProperty({
    description: 'Job details',
  })
  job: {
    id: string;
    jobNumber: string;
    title?: string | null;
    description: string;
    serviceAddressLine1: string;
    serviceCity: string;
    serviceProvince: string;
    servicePostalCode: string;
    urgency: string;
    preferredDateStart?: Date | null;
    preferredDateEnd?: Date | null;
    serviceCategory: {
      id: string;
      name: string;
      code: string;
    };
  };

  @ApiProperty({
    description: 'Time remaining until SLA deadline in seconds',
    example: 180,
  })
  timeRemaining: number;
}

// ============================================
// DISPATCH HISTORY RESPONSE DTO
// ============================================
export class DispatchHistoryResponseDto {
  @ApiProperty({
    description: 'Job ID',
    example: 'clx9876543210',
  })
  jobId: string;

  @ApiProperty({
    description: 'Total number of dispatch attempts',
    example: 3,
  })
  totalAttempts: number;

  @ApiProperty({
    description: 'Current escalation step',
    example: 2,
  })
  currentEscalationStep: number;

  @ApiProperty({
    description: 'List of dispatch attempts',
    type: [DispatchAttemptWithProDto],
  })
  attempts: DispatchAttemptWithProDto[];

  @ApiPropertyOptional({
    description: 'Current assignment if job has been accepted',
  })
  assignment?: {
    id: string;
    proProfileId: string;
    assignedAt: Date;
    isManual: boolean;
    proProfile?: {
      id: string;
      businessName?: string | null;
      user?: {
        firstName?: string | null;
        lastName?: string | null;
      };
    };
  } | null;
}

// ============================================
// DISPATCH INITIATION RESPONSE DTO
// ============================================
export class DispatchInitiationResponseDto {
  @ApiProperty({
    description: 'Whether dispatch was successfully initiated',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Message describing the result',
    example: 'Dispatch initiated successfully',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'The dispatch attempt created',
    type: DispatchAttemptResponseDto,
  })
  dispatchAttempt?: DispatchAttemptResponseDto;

  @ApiPropertyOptional({
    description: 'Number of matching pros found',
    example: 5,
  })
  matchingProsCount?: number;
}

// ============================================
// ACCEPT/DECLINE RESPONSE DTO
// ============================================
export class DispatchActionResponseDto {
  @ApiProperty({
    description: 'Whether the action was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Message describing the result',
    example: 'Dispatch accepted successfully',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Updated dispatch attempt',
    type: DispatchAttemptResponseDto,
  })
  dispatchAttempt?: DispatchAttemptResponseDto;
}
