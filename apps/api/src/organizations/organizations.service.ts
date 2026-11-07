import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { SystemRole } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new organization and assign creator as ORG_OWNER
   */
  async create(userId: string, dto: CreateOrganizationDto) {
    const baseSlug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    const slug = `${baseSlug}-${randomSuffix}`;

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          domain: dto.domain,
        },
      });

      const member = await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId,
          systemRole: SystemRole.ORG_OWNER,
        },
      });

      return {
        organization,
        membership: member,
      };
    });
  }

  /**
   * Get all organizations the current user belongs to
   */
  async findAllForUser(userId: string) {
    return this.prisma.organizationMember.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        organization: true,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });
  }

  /**
   * Get organization details and summary stats
   */
  async findById(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            members: true,
            tickets: true,
            knowledgeDocuments: true,
            customers: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    return org;
  }

  /**
   * Invite an employee or customer to the organization
   */
  async inviteMember(orgId: string, dto: InviteMemberDto) {
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // If user does not exist, create an account with a temporary secure password
    if (!user) {
      const tempPassword = crypto.randomBytes(8).toString('hex') + 'A1!';
      const passwordHash = await argon2.hash(tempPassword);

      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName || 'Invited',
          lastName: dto.lastName || 'Member',
          isEmailVerified: false,
        },
      });
    }

    const existingMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: user.id,
        },
      },
    });

    if (existingMember) {
      if (existingMember.isActive) {
        throw new ConflictException('User is already an active member of this organization.');
      }

      // Reactivate membership
      return this.prisma.organizationMember.update({
        where: { id: existingMember.id },
        data: {
          isActive: true,
          systemRole: dto.systemRole,
        },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
    }

    return this.prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        systemRole: dto.systemRole,
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * List all members of an organization
   */
  async getMembers(orgId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        role: true,
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /**
   * Update member role or status
   */
  async updateMember(orgId: string, memberId: string, dto: UpdateMemberRoleDto) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.organizationId !== orgId) {
      throw new NotFoundException('Member not found in this organization.');
    }

    if (member.systemRole === SystemRole.ORG_OWNER && dto.systemRole && dto.systemRole !== SystemRole.ORG_OWNER) {
      throw new BadRequestException('Organization Owner role cannot be downgraded directly.');
    }

    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: {
        ...(dto.systemRole ? { systemRole: dto.systemRole } : {}),
        ...(typeof dto.isActive === 'boolean' ? { isActive: dto.isActive } : {}),
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Remove member from organization
   */
  async removeMember(orgId: string, memberId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.organizationId !== orgId) {
      throw new NotFoundException('Member not found in this organization.');
    }

    if (member.systemRole === SystemRole.ORG_OWNER) {
      throw new ForbiddenException('Cannot remove the organization owner.');
    }

    await this.prisma.organizationMember.delete({
      where: { id: memberId },
    });

    return { message: 'Member successfully removed.' };
  }
}
