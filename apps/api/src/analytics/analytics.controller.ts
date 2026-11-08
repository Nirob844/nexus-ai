import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsQueryDto,
  AiUsageQueryDto,
  TimeRangeFilter,
} from './dto/analytics-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '@prisma/client';

@ApiTags('Analytics & Observability')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-ID', description: 'Active Organization ID', required: true })
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles(
    SystemRole.ORG_OWNER,
    SystemRole.ORG_ADMIN,
    SystemRole.SUPPORT_AGENT,
  )
  @ApiOperation({
    summary: 'Get Support Operations & SLA Performance Dashboard',
    description:
      'Aggregates ticket counts, resolution rate, average resolution SLA, first-response time, category/sentiment breakdown, and agent metrics.',
  })
  @ApiResponse({ status: 200, description: 'Operations analytics metrics returned successfully' })
  async getOperationsDashboard(
    @CurrentTenant('id') tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getOperationsDashboard(tenantId, query);
  }

  @Get('ai-usage')
  @Roles(SystemRole.ORG_OWNER, SystemRole.ORG_ADMIN)
  @ApiOperation({
    summary: 'Get AI Observability, Latency & Token Cost Dashboard',
    description:
      'Detailed telemetry on AI invocations, prompt/completion tokens, estimated USD costs, latency averages, model distribution, and human-in-the-loop review metrics.',
  })
  @ApiResponse({ status: 200, description: 'AI usage telemetry returned successfully' })
  async getAiUsage(
    @CurrentTenant('id') tenantId: string,
    @Query() query: AiUsageQueryDto,
  ) {
    return this.analyticsService.getAiUsageAnalytics(tenantId, query);
  }

  @Get('summary')
  @Roles(SystemRole.ORG_OWNER, SystemRole.ORG_ADMIN)
  @ApiOperation({
    summary: 'Get AI-Synthesized Executive Business Insights',
    description:
      'Synthesizes live support operational metrics into an executive-level status report with health score, key insights, risk alerts, and tactical recommendations.',
  })
  @ApiQuery({
    name: 'timeRange',
    enum: TimeRangeFilter,
    required: false,
    description: 'Time window for summary calculation',
  })
  @ApiResponse({ status: 200, description: 'Executive AI summary generated successfully' })
  async getExecutiveSummary(
    @CurrentTenant('id') tenantId: string,
    @Query('timeRange') timeRange?: TimeRangeFilter,
  ) {
    return this.analyticsService.getExecutiveSummary(tenantId, timeRange);
  }
}
