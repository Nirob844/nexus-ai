import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '@prisma/client';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization workspace' })
  @ApiResponse({ status: 201, description: 'Organization successfully created' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all organizations the authenticated user belongs to' })
  @ApiResponse({ status: 200, description: 'List of user organizations' })
  async findAll(@CurrentUser('id') userId: string) {
    return this.organizationsService.findAllForUser(userId);
  }

  @Get(':organizationId')
  @UseGuards(TenantGuard)
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Active Organization ID', required: true })
  @ApiOperation({ summary: 'Get details and metrics of active organization' })
  @ApiResponse({ status: 200, description: 'Organization details' })
  async findOne(@Param('organizationId') orgId: string) {
    return this.organizationsService.findById(orgId);
  }

  @Post(':organizationId/members')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(SystemRole.ORG_OWNER, SystemRole.ORG_ADMIN)
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Active Organization ID', required: true })
  @ApiOperation({ summary: 'Invite an employee or user to the organization' })
  @ApiResponse({ status: 201, description: 'Member invited successfully' })
  async inviteMember(
    @Param('organizationId') orgId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizationsService.inviteMember(orgId, dto);
  }

  @Get(':organizationId/members')
  @UseGuards(TenantGuard)
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Active Organization ID', required: true })
  @ApiOperation({ summary: 'List all members of an organization' })
  @ApiResponse({ status: 200, description: 'List of organization members' })
  async getMembers(@Param('organizationId') orgId: string) {
    return this.organizationsService.getMembers(orgId);
  }

  @Patch(':organizationId/members/:memberId')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(SystemRole.ORG_OWNER, SystemRole.ORG_ADMIN)
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Active Organization ID', required: true })
  @ApiOperation({ summary: 'Update a member role or status' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  async updateMember(
    @Param('organizationId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMember(orgId, memberId, dto);
  }

  @Delete(':organizationId/members/:memberId')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(SystemRole.ORG_OWNER, SystemRole.ORG_ADMIN)
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Active Organization ID', required: true })
  @ApiOperation({ summary: 'Remove a member from the organization' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  async removeMember(
    @Param('organizationId') orgId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.organizationsService.removeMember(orgId, memberId);
  }
}
