import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'auditAction';

export interface AuditMetadata {
  action: string;
  targetType?: string;
  getTargetId?: (request: any, response: any) => string | undefined;
}

export const Audit = (metadata: AuditMetadata) => SetMetadata(AUDIT_ACTION_KEY, metadata);
