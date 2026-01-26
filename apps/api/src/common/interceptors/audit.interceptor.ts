import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AUDIT_ACTION_KEY, AuditMetadata } from '../decorators/audit.decorator';
import { AuditService } from '../../modules/audit/audit.service';
import { ActorType } from '../../modules/audit/dto/audit.dto';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.getAllAndOverride<AuditMetadata>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap({
        next: async (response) => {
          try {
            const targetId = auditMetadata.getTargetId
              ? auditMetadata.getTargetId(request, response)
              : undefined;

            await this.auditService.log({
              action: auditMetadata.action,
              actorId: user?.userId,
              actorType: user ? ActorType.USER : ActorType.SYSTEM,
              targetType: auditMetadata.targetType,
              targetId,
              details: {
                method: request.method,
                path: request.url,
                // Don't log sensitive data
              },
              ipAddress: request.ip,
              userAgent: request.get('user-agent'),
            });
          } catch (error) {
            // Don't fail the request if audit logging fails
            console.error('Audit logging error:', error);
          }
        },
      }),
    );
  }
}
