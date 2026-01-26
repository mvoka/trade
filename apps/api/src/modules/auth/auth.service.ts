import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { config } from '@trades/config';
import { AuthTokens, JwtPayload, UserRole } from '@trades/shared';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly RESET_TOKEN_EXPIRY_HOURS = 1;
  private readonly ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user
   */
  async register(dto: RegisterDto): Promise<{
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
      proProfileId?: string;
    };
    tokens: AuthTokens;
  }> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    // Determine role
    const role = dto.role || 'SMB_USER';

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: role as any,
      },
    });

    // If PRO_USER, create ProProfile
    let proProfileId: string | undefined;
    if (role === 'PRO_USER') {
      const proProfile = await this.prisma.proProfile.create({
        data: {
          userId: user.id,
          businessEmail: dto.email.toLowerCase(),
        },
      });
      proProfileId = proProfile.id;
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role as UserRole, proProfileId);

    this.logger.log(`User registered: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        proProfileId,
      },
      tokens,
    };
  }

  /**
   * Login user and return tokens
   */
  async login(dto: LoginDto): Promise<{
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
      proProfileId?: string;
    };
    tokens: AuthTokens;
  }> {
    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    // Get pro profile if exists
    let proProfileId: string | undefined;
    if (user.role === 'PRO_USER') {
      const proProfile = await this.prisma.proProfile.findUnique({
        where: { userId: user.id },
      });
      proProfileId = proProfile?.id;
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role as UserRole, proProfileId);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        proProfileId,
      },
      tokens,
    };
  }

  /**
   * Logout user by revoking refresh token
   */
  async logout(userId: string, refreshToken: string): Promise<{ message: string }> {
    // Find and revoke the refresh token
    const token = await this.prisma.refreshToken.findFirst({
      where: {
        userId,
        token: refreshToken,
        revokedAt: null,
      },
    });

    if (token) {
      await this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() },
      });
    }

    this.logger.log(`User logged out: ${userId}`);

    return { message: 'Logged out successfully' };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Find the refresh token
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is revoked
    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Check if user is active
    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    // Get pro profile if exists
    let proProfileId: string | undefined;
    if (storedToken.user.role === 'PRO_USER') {
      const proProfile = await this.prisma.proProfile.findUnique({
        where: { userId: storedToken.user.id },
      });
      proProfileId = proProfile?.id;
    }

    // Revoke old refresh token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const tokens = await this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role as UserRole,
      proProfileId,
    );

    this.logger.log(`Token refreshed for user: ${storedToken.user.email}`);

    return tokens;
  }

  /**
   * Initiate forgot password flow
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Always return success message to prevent email enumeration
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent email: ${dto.email}`);
      return { message: 'If an account exists with this email, a password reset link has been sent' };
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenHash = await bcrypt.hash(resetToken, this.SALT_ROUNDS);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.RESET_TOKEN_EXPIRY_HOURS);

    // Store reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetTokenHash,
        passwordResetExpiry: expiresAt,
      },
    });

    // TODO: Send email with reset link
    // For now, we'll log the token (in development only)
    if (config.NODE_ENV === 'development') {
      this.logger.debug(`Password reset token for ${user.email}: ${resetToken}`);
    }

    // Stub: In production, this would send an email
    this.logger.log(`Password reset email would be sent to: ${user.email}`);

    return { message: 'If an account exists with this email, a password reset link has been sent' };
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    // Find users with non-expired reset tokens
    const users = await this.prisma.user.findMany({
      where: {
        passwordResetToken: { not: null },
        passwordResetExpiry: { gt: new Date() },
      },
    });

    // Find matching token
    let matchedUser = null;
    for (const user of users) {
      if (user.passwordResetToken) {
        const isValid = await bcrypt.compare(dto.token, user.passwordResetToken);
        if (isValid) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    // Revoke all refresh tokens for this user (force re-login)
    await this.prisma.refreshToken.updateMany({
      where: {
        userId: matchedUser.id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Password reset completed for user: ${matchedUser.email}`);

    return { message: 'Password has been reset successfully' };
  }

  /**
   * Validate user credentials (for passport strategy)
   */
  async validateUser(email: string, password: string): Promise<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    isActive: boolean;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
    proProfileId?: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    // Generate access token (15 minutes)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: config.JWT_ACCESS_EXPIRY,
    });

    // Generate refresh token (7 days)
    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      { expiresIn: config.JWT_REFRESH_EXPIRY },
    );

    // Calculate refresh token expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  /**
   * Get user by ID (used for token validation)
   */
  async getUserById(userId: string): Promise<{
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    proProfileId?: string;
    orgId?: string;
    regionId?: string;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        proProfile: {
          select: {
            id: true,
            orgId: true,
            regionId: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      proProfileId: user.proProfile?.id,
      orgId: user.proProfile?.orgId || undefined,
      regionId: user.proProfile?.regionId || undefined,
    };
  }
}
