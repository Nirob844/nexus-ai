import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user, tenant } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    if (user.isSuperAdmin) {
      return true;
    }

    if (!tenant) {
      return false;
    }

    // Fetch user's custom role permissions in the organization
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: tenant.id,
          userId: user.id,
        },
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Organization Owner has full access to all permissions
    if (member?.systemRole === 'ORG_OWNER' || member?.systemRole === 'ORG_ADMIN') {
      return true;
    }

    const userPermissions =
      member?.role?.permissions.map((rp) => rp.permission.key) || [];

    return requiredPermissions.every((perm) => userPermissions.includes(perm));
  }
}
