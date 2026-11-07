import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    // Extract tenant ID from header or route parameters
    const tenantId =
      request.headers['x-tenant-id'] ||
      request.params?.organizationId ||
      request.query?.organizationId;

    if (!tenantId) {
      throw new BadRequestException('Organization context missing. Please provide X-Tenant-ID header.');
    }

    // Check membership
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: tenantId,
          userId: user.id,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership && !user.isSuperAdmin) {
      throw new ForbiddenException('You do not belong to this organization.');
    }

    if (membership && !membership.isActive) {
      throw new ForbiddenException('Your membership in this organization is inactive.');
    }

    if (membership && !membership.organization.isActive) {
      throw new ForbiddenException('This organization is currently suspended.');
    }

    // Attach tenant context to request
    request.tenant = {
      id: tenantId,
      name: membership?.organization.name || 'Organization',
      slug: membership?.organization.slug || '',
      systemRole: membership?.systemRole,
    };

    return true;
  }
}
