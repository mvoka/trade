import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, unknown>,
  ) {
    super(
      {
        code,
        message,
        details,
      },
      status,
    );
  }
}

export class JobNotDispatchableException extends BusinessException {
  constructor(jobId: string, reason: string) {
    super('BIZ_001', `Job ${jobId} cannot be dispatched: ${reason}`, HttpStatus.BAD_REQUEST);
  }
}

export class ProNotAvailableException extends BusinessException {
  constructor(proId: string, reason: string) {
    super('BIZ_002', `Pro ${proId} is not available: ${reason}`, HttpStatus.BAD_REQUEST);
  }
}

export class BookingConflictException extends BusinessException {
  constructor(message: string) {
    super('BIZ_003', message, HttpStatus.CONFLICT);
  }
}

export class SlaExceededException extends BusinessException {
  constructor(jobId: string, slaType: string) {
    super('BIZ_004', `SLA exceeded for job ${jobId}: ${slaType}`, HttpStatus.BAD_REQUEST);
  }
}

export class PhotosRequiredException extends BusinessException {
  constructor(type: 'before' | 'after', minCount: number) {
    super(
      'BIZ_005',
      `At least ${minCount} ${type} photo(s) required`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class VerificationRequiredException extends BusinessException {
  constructor(proId: string) {
    super(
      'BIZ_006',
      `Pro ${proId} must be verified to perform this action`,
      HttpStatus.FORBIDDEN,
    );
  }
}

export class FeatureDisabledException extends BusinessException {
  constructor(featureKey: string) {
    super(
      'BIZ_007',
      `Feature '${featureKey}' is not enabled`,
      HttpStatus.FORBIDDEN,
    );
  }
}

export class InvalidStatusTransitionException extends BusinessException {
  constructor(entityType: string, currentStatus: string, targetStatus: string) {
    super(
      'BIZ_008',
      `Invalid ${entityType} status transition from ${currentStatus} to ${targetStatus}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
