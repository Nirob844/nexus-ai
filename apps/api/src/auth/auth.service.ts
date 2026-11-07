import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { SystemRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user and optionally create an organization
   */
  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await argon2.hash(dto.password);

    // Create user and optionally organization in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          isEmailVerified: false,
        },
      });

      let organization = null;

      if (dto.organizationName) {
        const baseSlug = dto.organizationName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');
        const randomSuffix = crypto.randomBytes(3).toString('hex');
        const slug = `${baseSlug}-${randomSuffix}`;

        organization = await tx.organization.create({
          data: {
            name: dto.organizationName,
            slug,
          },
        });

        await tx.organizationMember.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            systemRole: SystemRole.ORG_OWNER,
          },
        });
      }

      return { user, organization };
    });

    const tokens = await this.generateTokens({
      sub: result.user.id,
      email: result.user.email,
      isSuperAdmin: result.user.isSuperAdmin,
      activeOrganizationId: result.organization?.id,
      role: result.organization ? SystemRole.ORG_OWNER : undefined,
    });

    await this.saveRefreshToken(result.user.id, tokens.refreshToken);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        isSuperAdmin: result.user.isSuperAdmin,
      },
      organization: result.organization,
      tokens,
    };
  }

  /**
   * User login with email and password
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        organizationMembers: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated.');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const primaryMembership = user.organizationMembers[0];

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      activeOrganizationId: primaryMembership?.organizationId,
      role: primaryMembership?.systemRole,
    });

    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
      },
      organizations: user.organizationMembers.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        systemRole: m.systemRole,
      })),
      tokens,
    };
  }

  /**
   * Refresh Token Rotation
   */
  async refreshTokens(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'nexus_super_secret_jwt_refresh_key_change_in_production',
        ),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid, revoked, or expired.');
    }

    // Revoke old token to prevent reuse attacks
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // Generate fresh tokens
    const newTokens = await this.generateTokens({
      sub: payload.sub,
      email: payload.email,
      isSuperAdmin: payload.isSuperAdmin,
      activeOrganizationId: payload.activeOrganizationId,
      role: payload.role,
    });

    await this.saveRefreshToken(payload.sub, newTokens.refreshToken);

    return newTokens;
  }

  /**
   * Logout user by revoking refresh token
   */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    } else {
      // Revoke all tokens for this user
      await this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    return { message: 'Logged out successfully.' };
  }

  /**
   * Get current authenticated user profile and memberships
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isSuperAdmin: true,
        isEmailVerified: true,
        createdAt: true,
        organizationMembers: {
          where: { isActive: true },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                domain: true,
                logoUrl: true,
                isActive: true,
              },
            },
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
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return user;
  }

  // ----------------------------------------------------------------------------
  // Helper methods
  // ----------------------------------------------------------------------------

  private async generateTokens(payload: JwtPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>(
          'JWT_ACCESS_SECRET',
          'nexus_super_secret_jwt_access_key_change_in_production',
        ),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(
        { ...payload, jti: crypto.randomUUID() },
        {
          secret: this.configService.get<string>(
            'JWT_REFRESH_SECRET',
            'nexus_super_secret_jwt_refresh_key_change_in_production',
          ),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string) {
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
