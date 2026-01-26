import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { config } from '@trades/config';
import { JwtPayload } from '@trades/shared';
import { AuthService } from '../auth.service';

export interface JwtValidatedUser {
  userId: string;
  email: string;
  role: string;
  proProfileId?: string;
  orgId?: string;
  regionId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.JWT_SECRET,
    });
  }

  /**
   * Validate JWT payload and return user data
   * This method is called by Passport after verifying the JWT signature
   */
  async validate(payload: JwtPayload): Promise<JwtValidatedUser> {
    // Validate that the user still exists and is active
    const user = await this.authService.getUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Return the validated user payload
    // This will be attached to request.user
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      proProfileId: user.proProfileId,
      orgId: user.orgId,
      regionId: user.regionId,
    };
  }
}
