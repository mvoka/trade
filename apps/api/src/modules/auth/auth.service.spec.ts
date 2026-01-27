import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockJwt: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      proProfile: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      refreshToken: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    mockJwt = {
      sign: vi.fn(),
      verify: vi.fn(),
    };

    // Directly instantiate the service with mocks
    service = new AuthService(mockPrisma, mockJwt);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register a new SMB user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'SMB_USER',
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockJwt.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('SMB_USER');
      expect(result.tokens.accessToken).toBe('access-token');
      expect(result.tokens.refreshToken).toBe('refresh-token');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should register a PRO_USER and create proProfile', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'pro@example.com',
        firstName: 'Pro',
        lastName: 'User',
        role: 'PRO_USER',
      };

      const mockProProfile = {
        id: 'profile-123',
        userId: 'user-123',
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.proProfile.create.mockResolvedValue(mockProProfile);
      mockJwt.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        ...registerDto,
        email: 'pro@example.com',
        role: 'PRO_USER',
      });

      expect(result.user.proProfileId).toBe('profile-123');
      expect(mockPrisma.proProfile.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'SMB_USER',
      });
      mockJwt.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await service.register({ ...registerDto, email: 'TEST@EXAMPLE.COM' });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        }),
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should login user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        role: 'SMB_USER',
        isActive: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      mockJwt.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBe('access-token');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        isActive: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for deactivated user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        role: 'SMB_USER',
        isActive: false,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should get proProfileId for PRO_USER', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'pro@example.com',
        passwordHash: 'hashed-password',
        firstName: 'Pro',
        lastName: 'User',
        role: 'PRO_USER',
        isActive: true,
      };

      const mockProProfile = {
        id: 'profile-123',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      mockPrisma.proProfile.findUnique.mockResolvedValue(mockProProfile);
      mockJwt.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.login({ ...loginDto, email: 'pro@example.com' });

      expect(result.user.proProfileId).toBe('profile-123');
    });
  });

  describe('logout', () => {
    it('should revoke refresh token on logout', async () => {
      const mockToken = {
        id: 'token-123',
        userId: 'user-123',
        token: 'refresh-token',
        revokedAt: null,
      };

      mockPrisma.refreshToken.findFirst.mockResolvedValue(mockToken);
      mockPrisma.refreshToken.update.mockResolvedValue({
        ...mockToken,
        revokedAt: new Date(),
      });

      const result = await service.logout('user-123', 'refresh-token');

      expect(result.message).toBe('Logged out successfully');
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-123' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should handle logout when token not found', async () => {
      mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

      const result = await service.logout('user-123', 'invalid-token');

      expect(result.message).toBe('Logged out successfully');
      expect(mockPrisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const mockStoredToken = {
        id: 'token-123',
        token: 'old-refresh-token',
        expiresAt: new Date(Date.now() + 86400000), // 1 day in future
        revokedAt: null,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'SMB_USER',
          isActive: true,
        },
      };

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockJwt.sign.mockReturnValueOnce('new-access-token').mockReturnValueOnce('new-refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshToken('old-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-123',
        token: 'refresh-token',
        revokedAt: new Date(),
        user: { id: 'user-123', isActive: true },
      });

      await expect(service.refreshToken('refresh-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-123',
        token: 'refresh-token',
        expiresAt: new Date(Date.now() - 86400000), // 1 day in past
        revokedAt: null,
        user: { id: 'user-123', isActive: true },
      });

      await expect(service.refreshToken('refresh-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for deactivated user', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-123',
        token: 'refresh-token',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        user: { id: 'user-123', isActive: false },
      });

      await expect(service.refreshToken('refresh-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should return success message even if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nonexistent@example.com' });

      expect(result.message).toContain('If an account exists');
    });

    it('should generate reset token for existing user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.hash as any).mockResolvedValue('hashed-reset-token');
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.forgotPassword({ email: 'test@example.com' });

      expect(result.message).toContain('If an account exists');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          passwordResetToken: 'hashed-reset-token',
          passwordResetExpiry: expect.any(Date),
        },
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordResetToken: 'hashed-token',
        passwordResetExpiry: new Date(Date.now() + 3600000), // 1 hour in future
      };

      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      (bcrypt.compare as any).mockResolvedValue(true);
      (bcrypt.hash as any).mockResolvedValue('new-hashed-password');
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});

      const result = await service.resetPassword({
        token: 'valid-reset-token',
        newPassword: 'NewPassword123!',
      });

      expect(result.message).toBe('Password has been reset successfully');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          passwordHash: 'new-hashed-password',
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      });
      // Should revoke all refresh tokens
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await expect(
        service.resetPassword({
          token: 'invalid-token',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when token does not match', async () => {
      const mockUser = {
        id: 'user-123',
        passwordResetToken: 'hashed-token',
        passwordResetExpiry: new Date(Date.now() + 3600000),
      };

      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(
        service.resetPassword({
          token: 'wrong-token',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateUser', () => {
    it('should return user data for valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        role: 'SMB_USER',
        isActive: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'Password123!');

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'SMB_USER',
        isActive: true,
      });
    });

    it('should return null for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'Password123!');

      expect(result).toBeNull();
    });

    it('should return null for invalid password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      });
      (bcrypt.compare as any).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'WrongPassword');

      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('should return user with proProfile data', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'pro@example.com',
        role: 'PRO_USER',
        isActive: true,
        proProfile: {
          id: 'profile-123',
          orgId: 'org-123',
          regionId: 'region-123',
        },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserById('user-123');

      expect(result).toEqual({
        id: 'user-123',
        email: 'pro@example.com',
        role: 'PRO_USER',
        isActive: true,
        proProfileId: 'profile-123',
        orgId: 'org-123',
        regionId: 'region-123',
      });
    });

    it('should return null for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserById('nonexistent-id');

      expect(result).toBeNull();
    });
  });
});
