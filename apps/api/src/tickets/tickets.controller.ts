import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/ticket-message.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { UpdateTicketPriorityDto } from './dto/update-ticket-priority.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '@prisma/client';

@ApiTags('Customer Support Tickets')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-ID', description: 'Active Organization ID', required: true })
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new support ticket and trigger AI analysis' })
  @ApiResponse({ status: 201, description: 'Ticket successfully created and queued for AI' })
  async create(
    @CurrentTenant('id') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentTenant('systemRole') userRole: SystemRole,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.create(orgId, userId, userRole, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List and filter tickets in the organization' })
  @ApiResponse({ status: 200, description: 'Paginated list of support tickets' })
  async findAll(
    @CurrentTenant('id') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentTenant('systemRole') userRole: SystemRole,
    @Query() query: TicketQueryDto,
  ) {
    return this.ticketsService.findAll(orgId, userId, userRole, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get complete ticket conversation and history' })
  @ApiResponse({ status: 200, description: 'Ticket details retrieved successfully' })
  async findOne(
    @CurrentTenant('id') orgId: string,
    @Param('id') ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentTenant('systemRole') userRole: SystemRole,
  ) {
    return this.ticketsService.findById(orgId, ticketId, userId, userRole);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Reply to ticket or post internal agent note' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  async addMessage(
    @CurrentTenant('id') orgId: string,
    @Param('id') ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentTenant('systemRole') userRole: SystemRole,
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.ticketsService.addMessage(orgId, ticketId, userId, userRole, dto);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.ORG_OWNER, SystemRole.ORG_ADMIN, SystemRole.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Assign or reassign ticket to an agent' })
  @ApiResponse({ status: 200, description: 'Ticket successfully assigned' })
  async assign(
    @CurrentTenant('id') orgId: string,
    @Param('id') ticketId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.ticketsService.assign(orgId, ticketId, dto.agentId, actorId);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.ORG_OWNER, SystemRole.ORG_ADMIN, SystemRole.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Update ticket status (e.g. In Progress, Resolved, Closed)' })
  @ApiResponse({ status: 200, description: 'Ticket status updated' })
  async updateStatus(
    @CurrentTenant('id') orgId: string,
    @Param('id') ticketId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateStatus(orgId, ticketId, dto.status, actorId);
  }

  @Patch(':id/priority')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.ORG_OWNER, SystemRole.ORG_ADMIN, SystemRole.SUPPORT_AGENT)
  @ApiOperation({ summary: 'Update ticket priority (Low, Medium, High, Urgent)' })
  @ApiResponse({ status: 200, description: 'Ticket priority updated' })
  async updatePriority(
    @CurrentTenant('id') orgId: string,
    @Param('id') ticketId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: UpdateTicketPriorityDto,
  ) {
    return this.ticketsService.updatePriority(orgId, ticketId, dto.priority, actorId);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reopen a previously resolved ticket' })
  @ApiResponse({ status: 200, description: 'Ticket reopened successfully' })
  async reopen(
    @CurrentTenant('id') orgId: string,
    @Param('id') ticketId: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.ticketsService.reopen(orgId, ticketId, actorId);
  }
}
