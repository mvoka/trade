import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateOrgDto,
  UpdateOrgDto,
  OrgMemberRole,
  OrgResponseDto,
  OrgMemberResponseDto,
  OrgWithMembershipResponseDto,
} from './dto/orgs.dto';

@Injectable()
export class OrgsService {
  private readonly logger = new Logger(OrgsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new organization
   * The creator is automatically added as the owner
   */
  async createOrg(
    dto: CreateOrgDto,
    creatorUserId: string,
  ): Promise<OrgResponseDto> {
    // Create the organization and add the creator as owner in a transaction
    const org = await this.prisma.$transaction(async (tx) => {
      // Create the organization
      const newOrg = await tx.org.create({
        data: {
          name: dto.name,
          legalName: dto.legalName,
          taxId: dto.taxId,
          phone: dto.phone,
          email: dto.email,
          website: dto.website,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          province: dto.province,
          postalCode: dto.postalCode,
          country: dto.country || 'CA',
        },
      });

      // Add creator as owner
      await tx.orgMember.create({
        data: {
          orgId: newOrg.id,
          userId: creatorUserId,
          role: 'owner',
          isActive: true,
        },
      });

      return newOrg;
    });

    this.logger.log(`Organization created: ${org.id} by user: ${creatorUserId}`);

    return this.formatOrgResponse(org);
  }

  /**
   * Get organization by ID
   */
  async getOrg(id: string, includeMembers = false): Promise<OrgResponseDto> {
    const org = await this.prisma.org.findUnique({
      where: { id },
      include: includeMembers
        ? {
            members: {
              where: { isActive: true },
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          }
        : undefined,
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return this.formatOrgResponse(org, includeMembers);
  }

  /**
   * Update organization
   */
  async updateOrg(id: string, dto: UpdateOrgDto): Promise<OrgResponseDto> {
    // Check if org exists
    const existingOrg = await this.prisma.org.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    const updatedOrg = await this.prisma.org.update({
      where: { id },
      data: {
        name: dto.name,
        legalName: dto.legalName,
        taxId: dto.taxId,
        phone: dto.phone,
        email: dto.email,
        website: dto.website,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        province: dto.province,
        postalCode: dto.postalCode,
        country: dto.country,
        isActive: dto.isActive,
      },
    });

    this.logger.log(`Organization updated: ${id}`);

    return this.formatOrgResponse(updatedOrg);
  }

  /**
   * Add a member to an organization
   */
  async addMember(
    orgId: string,
    userId: string,
    role: OrgMemberRole = 'member',
  ): Promise<OrgMemberResponseDto> {
    // Check if org exists
    const org = await this.prisma.org.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if already a member
    const existingMembership = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId,
        },
      },
    });

    if (existingMembership) {
      if (existingMembership.isActive) {
        throw new ConflictException('User is already a member of this organization');
      } else {
        // Reactivate membership
        const reactivated = await this.prisma.orgMember.update({
          where: { id: existingMembership.id },
          data: {
            isActive: true,
            role,
            joinedAt: new Date(),
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        this.logger.log(`Member reactivated: ${userId} in org: ${orgId}`);
        return this.formatMemberResponse(reactivated);
      }
    }

    // Create new membership
    const membership = await this.prisma.orgMember.create({
      data: {
        orgId,
        userId,
        role,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(`Member added: ${userId} to org: ${orgId} with role: ${role}`);

    return this.formatMemberResponse(membership);
  }

  /**
   * Remove a member from an organization
   */
  async removeMember(orgId: string, userId: string): Promise<{ message: string }> {
    // Check if org exists
    const org = await this.prisma.org.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    // Check if membership exists
    const membership = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this organization');
    }

    // Prevent removing the last owner
    if (membership.role === 'owner') {
      const ownerCount = await this.prisma.orgMember.count({
        where: {
          orgId,
          role: 'owner',
          isActive: true,
        },
      });

      if (ownerCount <= 1) {
        throw new ForbiddenException(
          'Cannot remove the last owner. Transfer ownership first.',
        );
      }
    }

    // Soft delete - set isActive to false
    await this.prisma.orgMember.update({
      where: { id: membership.id },
      data: { isActive: false },
    });

    this.logger.log(`Member removed: ${userId} from org: ${orgId}`);

    return { message: 'Member removed successfully' };
  }

  /**
   * Get all members of an organization
   */
  async getOrgMembers(orgId: string): Promise<OrgMemberResponseDto[]> {
    // Check if org exists
    const org = await this.prisma.org.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${orgId} not found`);
    }

    const members = await this.prisma.orgMember.findMany({
      where: {
        orgId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return members.map((m) => this.formatMemberResponse(m));
  }

  /**
   * Get all organizations a user belongs to
   */
  async getOrgsByUser(userId: string): Promise<OrgWithMembershipResponseDto[]> {
    const memberships = await this.prisma.orgMember.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        org: true,
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => ({
      ...this.formatOrgResponse(m.org),
      memberRole: m.role,
    }));
  }

  /**
   * Check if a user is a member of an organization with specified role(s)
   */
  async checkMembership(
    orgId: string,
    userId: string,
    requiredRoles?: OrgMemberRole[],
  ): Promise<boolean> {
    const membership = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId,
        },
      },
    });

    if (!membership || !membership.isActive) {
      return false;
    }

    if (requiredRoles && requiredRoles.length > 0) {
      return requiredRoles.includes(membership.role as OrgMemberRole);
    }

    return true;
  }

  /**
   * Get member's role in an organization
   */
  async getMemberRole(orgId: string, userId: string): Promise<OrgMemberRole | null> {
    const membership = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId,
        },
      },
    });

    if (!membership || !membership.isActive) {
      return null;
    }

    return membership.role as OrgMemberRole;
  }

  /**
   * Format org response
   */
  private formatOrgResponse(org: any, includeMembers = false): OrgResponseDto {
    const response: OrgResponseDto = {
      id: org.id,
      name: org.name,
      legalName: org.legalName,
      taxId: org.taxId,
      phone: org.phone,
      email: org.email,
      website: org.website,
      addressLine1: org.addressLine1,
      addressLine2: org.addressLine2,
      city: org.city,
      province: org.province,
      postalCode: org.postalCode,
      country: org.country,
      isActive: org.isActive,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };

    if (includeMembers && org.members) {
      response.members = org.members.map((m: any) => this.formatMemberResponse(m));
    }

    return response;
  }

  /**
   * Format member response
   */
  private formatMemberResponse(member: any): OrgMemberResponseDto {
    return {
      id: member.id,
      userId: member.user.id,
      email: member.user.email,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      role: member.role,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
    };
  }
}
