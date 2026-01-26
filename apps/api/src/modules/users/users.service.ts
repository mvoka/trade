import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserRole } from '@trades/shared';
import {
  UpdateUserDto,
  UserQueryDto,
  UserResponseDto,
  UserListResponseDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Update user profile
   */
  async updateUser(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    // Verify user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (dto.firstName !== undefined) {
      updateData.firstName = dto.firstName;
    }

    if (dto.lastName !== undefined) {
      updateData.lastName = dto.lastName;
    }

    if (dto.phone !== undefined) {
      updateData.phone = dto.phone;
    }

    // Update user
    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`User updated: ${user.email}`);

    return user;
  }

  /**
   * List users with filters and pagination (Admin only)
   */
  async getUsers(query: UserQueryDto): Promise<UserListResponseDto> {
    const {
      role,
      isActive,
      search,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Validate sortBy field
    const allowedSortFields = [
      'email',
      'firstName',
      'lastName',
      'role',
      'createdAt',
      'updatedAt',
      'lastLoginAt',
    ];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Execute query with count
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { [validSortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          emailVerified: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          proProfile: {
            select: {
              id: true,
              businessName: true,
              businessPhone: true,
              businessEmail: true,
              bio: true,
              yearsExperience: true,
              verificationStatus: true,
              verifiedAt: true,
              avgResponseMinutes: true,
              completionRate: true,
              totalJobsCompleted: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      users,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Deactivate user (Admin only)
   */
  async deactivateUser(id: string): Promise<UserResponseDto> {
    // Verify user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!existingUser.isActive) {
      throw new BadRequestException('User is already deactivated');
    }

    // Prevent deactivating admin users (safety measure)
    if (existingUser.role === 'ADMIN') {
      throw new BadRequestException('Cannot deactivate admin users');
    }

    // Deactivate user
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Revoke all refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: {
        userId: id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`User deactivated: ${user.email}`);

    return user;
  }

  /**
   * Reactivate user (Admin only)
   */
  async reactivateUser(id: string): Promise<UserResponseDto> {
    // Verify user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (existingUser.isActive) {
      throw new BadRequestException('User is already active');
    }

    // Reactivate user
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`User reactivated: ${user.email}`);

    return user;
  }

  /**
   * Get user with pro profile if exists
   */
  async getUserWithProProfile(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        proProfile: {
          select: {
            id: true,
            businessName: true,
            businessPhone: true,
            businessEmail: true,
            bio: true,
            yearsExperience: true,
            verificationStatus: true,
            verifiedAt: true,
            avgResponseMinutes: true,
            completionRate: true,
            totalJobsCompleted: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }
}
