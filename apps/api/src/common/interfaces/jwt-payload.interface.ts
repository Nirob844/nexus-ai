import { SystemRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  isSuperAdmin: boolean;
  activeOrganizationId?: string;
  role?: SystemRole;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  activeOrganizationId?: string;
  systemRole?: SystemRole;
}

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  systemRole: SystemRole;
}
