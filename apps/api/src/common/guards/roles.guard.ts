import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user, tenant } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    // Super Admin has access to all roles
    if (user.isSuperAdmin) {
      return true;
    }

    // Check role in active tenant context
    const currentRole = tenant?.systemRole || user.systemRole;

    return requiredRoles.includes(currentRole);
  }
}
