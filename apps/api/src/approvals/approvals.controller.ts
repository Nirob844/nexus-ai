import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { ReviewApprovalDto } from './dto/review-approval.dto';
import { ApprovalQueryDto } from './dto/approval-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '@prisma/client';

@ApiTags('AI Approvals & Execution')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-ID', description: 'Active Organization ID', required: true })
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit an approval request for a sensitive AI action' })
  @ApiResponse({ status: 201, description: 'Approval request created and marked as PENDING' })
  async create(
    @CurrentTenant('id') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateApprovalDto,
  ) {
    return this.approvalsService.create(orgId, userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List and filter approval requests in the organization' })
  @ApiResponse({ status: 200, description: 'Paginated list of approval requests' })
  async findAll(
    @CurrentTenant('id') orgId: string,
    @Query() query: ApprovalQueryDto,
  ) {
    return this.approvalsService.findAll(orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get approval request details, review notes and execution trace' })
  @ApiResponse({ status: 200, description: 'Approval request details retrieved' })
  async findOne(
    @CurrentTenant('id') orgId: string,
    @Param('id') approvalId: string,
  ) {
    return this.approvalsService.findById(orgId, approvalId);
  }

  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles(SystemRole.ORG_OWNER, SystemRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Review (APPROVE or REJECT) and execute approved AI action' })
  @ApiResponse({ status: 200, description: 'Decision recorded and action executed' })
  async review(
    @CurrentTenant('id') orgId: string,
    @Param('id') approvalId: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewApprovalDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.approvalsService.reviewAndExecute(orgId, approvalId, reviewerId, dto, ipAddress, userAgent);
  }
}
