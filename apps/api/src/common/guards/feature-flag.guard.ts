import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { FeatureFlagsService } from '../../modules/feature-flags/feature-flags.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFlag = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFlag) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Extract scope context from request (could be from user, query params, etc.)
    const scopeContext = {
      regionId: request.query?.regionId || request.user?.regionId,
      orgId: request.query?.orgId || request.user?.orgId,
      serviceCategoryId: request.query?.serviceCategoryId,
    };

    const isEnabled = await this.featureFlagsService.isEnabled(requiredFlag, scopeContext);

    if (!isEnabled) {
      throw new ForbiddenException(`Feature '${requiredFlag}' is not enabled`);
    }

    return true;
  }
}
