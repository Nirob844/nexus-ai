import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';
import {
  AnalyticsQueryDto,
  AiUsageQueryDto,
  TimeRangeFilter,
} from './dto/analytics-query.dto';
import { TicketPriority, TicketStatus, SentimentScore } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Helper to convert time range filter into a past Date boundary
   */
  private getStartDate(timeRange?: TimeRangeFilter): Date | null {
    if (!timeRange || timeRange === TimeRangeFilter.ALL) {
      return null;
    }
    const now = new Date();
    switch (timeRange) {
      case TimeRangeFilter.TODAY:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case TimeRangeFilter.LAST_7_DAYS:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case TimeRangeFilter.LAST_30_DAYS:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case TimeRangeFilter.LAST_90_DAYS:
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Operations & Customer Support Analytics Dashboard
   */
  async getOperationsDashboard(orgId: string, query: AnalyticsQueryDto) {
    const startDate = this.getStartDate(query.timeRange);

    const ticketWhere: any = {
      organizationId: orgId,
    };

    if (startDate) {
      ticketWhere.createdAt = { gte: startDate };
    }

    if (query.category) {
      ticketWhere.category = query.category;
    }

    // 1. Fetch all tickets within the time range
    const tickets = await this.prisma.ticket.findMany({
      where: ticketWhere,
      include: {
        messages: {
          select: {
            senderType: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        analyses: {
          select: {
            sentiment: true,
            urgencyScore: true,
            category: true,
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        assignments: {
          select: {
            agentId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalTickets = tickets.length;

    // Open vs Resolved statuses
    const openStatuses: TicketStatus[] = [
      TicketStatus.OPEN,
      TicketStatus.AI_PROCESSING,
      TicketStatus.IN_PROGRESS,
      TicketStatus.PENDING_CUSTOMER,
    ];
    const resolvedStatuses: TicketStatus[] = [
      TicketStatus.RESOLVED,
      TicketStatus.CLOSED,
    ];

    let openTickets = 0;
    let resolvedTickets = 0;
    let urgentTickets = 0;
    let totalResolutionTimeMs = 0;
    let resolvedCountWithTime = 0;
    let totalFirstResponseTimeMs = 0;
    let ticketsWithFirstResponse = 0;

    const statusCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const sentimentCounts: Record<string, number> = {
      POSITIVE: 0,
      NEUTRAL: 0,
      NEGATIVE: 0,
      FRUSTRATED: 0,
    };

    // Trends by date (YYYY-MM-DD)
    const trendsMap: Record<string, { created: number; resolved: number }> = {};

    for (const t of tickets) {
      // Status counting
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      if (openStatuses.includes(t.status)) openTickets++;
      if (resolvedStatuses.includes(t.status)) resolvedTickets++;

      // Priority counting
      priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
      if (t.priority === TicketPriority.URGENT) urgentTickets++;

      // Category counting
      const cat = t.category || 'General';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      // Sentiment from AI Analysis
      if (t.analyses && t.analyses.length > 0) {
        const sentiment = t.analyses[0].sentiment;
        sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
      }

      // Resolution time
      if (t.resolvedAt) {
        const diff = t.resolvedAt.getTime() - t.createdAt.getTime();
        if (diff > 0) {
          totalResolutionTimeMs += diff;
          resolvedCountWithTime++;
        }
      }

      // First response time (time until first AGENT or AI message)
      const firstResponse = t.messages.find(
        (m) => m.senderType === 'AGENT' || m.senderType === 'AI',
      );
      if (firstResponse) {
        const respDiff = firstResponse.createdAt.getTime() - t.createdAt.getTime();
        if (respDiff > 0) {
          totalFirstResponseTimeMs += respDiff;
          ticketsWithFirstResponse++;
        }
      }

      // Trend mapping
      const dateKey = t.createdAt.toISOString().slice(0, 10);
      if (!trendsMap[dateKey]) {
        trendsMap[dateKey] = { created: 0, resolved: 0 };
      }
      trendsMap[dateKey].created++;

      if (t.resolvedAt) {
        const resolvedDateKey = t.resolvedAt.toISOString().slice(0, 10);
        if (!trendsMap[resolvedDateKey]) {
          trendsMap[resolvedDateKey] = { created: 0, resolved: 0 };
        }
        trendsMap[resolvedDateKey].resolved++;
      }
    }

    const resolutionRate =
      totalTickets > 0 ? Number(((resolvedTickets / totalTickets) * 100).toFixed(1)) : 0;

    const avgResolutionTimeHours =
      resolvedCountWithTime > 0
        ? Number(
            (totalResolutionTimeMs / (resolvedCountWithTime * 3600 * 1000)).toFixed(1),
          )
        : 0;

    const avgFirstResponseTimeMinutes =
      ticketsWithFirstResponse > 0
        ? Number(
            (totalFirstResponseTimeMs / (ticketsWithFirstResponse * 60 * 1000)).toFixed(1),
          )
        : 0;

    // Format breakdowns with percentages
    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: totalTickets > 0 ? Number(((count / totalTickets) * 100).toFixed(1)) : 0,
    }));

    const priorityBreakdown = Object.entries(priorityCounts).map(([priority, count]) => ({
      priority,
      count,
      percentage: totalTickets > 0 ? Number(((count / totalTickets) * 100).toFixed(1)) : 0,
    }));

    const categoryBreakdown = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count,
      percentage: totalTickets > 0 ? Number(((count / totalTickets) * 100).toFixed(1)) : 0,
    }));

    const totalAnalyses = Object.values(sentimentCounts).reduce((a, b) => a + b, 0);
    const sentimentBreakdown = Object.entries(sentimentCounts).map(([sentiment, count]) => ({
      sentiment,
      count,
      percentage:
        totalAnalyses > 0 ? Number(((count / totalAnalyses) * 100).toFixed(1)) : 0,
    }));

    // 2. Fetch Agent Performance
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    const agentPerformance = members.map((m) => {
      const assignedTickets = tickets.filter((t) =>
        t.assignments.some((a) => a.agentId === m.userId),
      );
      const assignedCount = assignedTickets.length;
      const agentResolved = assignedTickets.filter((t) =>
        resolvedStatuses.includes(t.status),
      ).length;

      let agentResMs = 0;
      let agentResCount = 0;
      for (const t of assignedTickets) {
        if (t.resolvedAt) {
          agentResMs += t.resolvedAt.getTime() - t.createdAt.getTime();
          agentResCount++;
        }
      }

      return {
        userId: m.userId,
        name: `${m.user.firstName} ${m.user.lastName}`,
        email: m.user.email,
        systemRole: m.systemRole,
        assignedCount,
        resolvedCount: agentResolved,
        resolutionRate:
          assignedCount > 0
            ? Number(((agentResolved / assignedCount) * 100).toFixed(1))
            : 0,
        avgResolutionHours:
          agentResCount > 0
            ? Number((agentResMs / (agentResCount * 3600 * 1000)).toFixed(1))
            : 0,
      };
    });

    // 3. Daily trends array sorted by date
    const dailyTrends = Object.entries(trendsMap)
      .map(([date, counts]) => ({
        date,
        created: counts.created,
        resolved: counts.resolved,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      overview: {
        totalTickets,
        openTickets,
        resolvedTickets,
        urgentTickets,
        resolutionRate,
        avgResolutionTimeHours,
        avgFirstResponseTimeMinutes,
      },
      statusBreakdown,
      priorityBreakdown,
      categoryBreakdown,
      sentimentBreakdown,
      agentPerformance,
      dailyTrends,
    };
  }

  /**
   * AI Usage, Latency & Cost Observability Dashboard (PRD Module 9)
   */
  async getAiUsageAnalytics(orgId: string, query: AiUsageQueryDto) {
    const startDate = this.getStartDate(query.timeRange);

    const where: any = { organizationId: orgId };
    if (startDate) {
      where.createdAt = { gte: startDate };
    }
    if (query.feature) {
      where.feature = query.feature;
    }

    const logs = await this.prisma.aiUsageLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const totalInvocations = logs.length;
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalEstimatedCostUsd = 0;
    let totalLatencyMs = 0;

    const featureStats: Record<
      string,
      { count: number; tokens: number; cost: number; totalLatency: number }
    > = {};

    const modelStats: Record<
      string,
      { count: number; tokens: number; cost: number }
    > = {};

    const dailyUsageMap: Record<
      string,
      { invocations: number; tokens: number; costUsd: number }
    > = {};

    for (const log of logs) {
      totalTokens += log.totalTokens;
      promptTokens += log.promptTokens;
      completionTokens += log.completionTokens;
      totalEstimatedCostUsd += log.estimatedCostUsd;
      totalLatencyMs += log.latencyMs;

      // Feature aggregation
      if (!featureStats[log.feature]) {
        featureStats[log.feature] = { count: 0, tokens: 0, cost: 0, totalLatency: 0 };
      }
      featureStats[log.feature].count++;
      featureStats[log.feature].tokens += log.totalTokens;
      featureStats[log.feature].cost += log.estimatedCostUsd;
      featureStats[log.feature].totalLatency += log.latencyMs;

      // Model aggregation
      if (!modelStats[log.model]) {
        modelStats[log.model] = { count: 0, tokens: 0, cost: 0 };
      }
      modelStats[log.model].count++;
      modelStats[log.model].tokens += log.totalTokens;
      modelStats[log.model].cost += log.estimatedCostUsd;

      // Daily timeline
      const dateKey = log.createdAt.toISOString().slice(0, 10);
      if (!dailyUsageMap[dateKey]) {
        dailyUsageMap[dateKey] = { invocations: 0, tokens: 0, costUsd: 0 };
      }
      dailyUsageMap[dateKey].invocations++;
      dailyUsageMap[dateKey].tokens += log.totalTokens;
      dailyUsageMap[dateKey].costUsd += log.estimatedCostUsd;
    }

    const avgLatencyMs =
      totalInvocations > 0 ? Math.round(totalLatencyMs / totalInvocations) : 0;

    const featureBreakdown = Object.entries(featureStats).map(([feature, s]) => ({
      feature,
      invocations: s.count,
      totalTokens: s.tokens,
      estimatedCostUsd: Number(s.cost.toFixed(5)),
      avgLatencyMs: s.count > 0 ? Math.round(s.totalLatency / s.count) : 0,
      percentageOfCost:
        totalEstimatedCostUsd > 0
          ? Number(((s.cost / totalEstimatedCostUsd) * 100).toFixed(1))
          : 0,
    }));

    const modelBreakdown = Object.entries(modelStats).map(([model, s]) => ({
      model,
      invocations: s.count,
      totalTokens: s.tokens,
      estimatedCostUsd: Number(s.cost.toFixed(5)),
    }));

    const dailyUsage = Object.entries(dailyUsageMap)
      .map(([date, d]) => ({
        date,
        invocations: d.invocations,
        tokens: d.tokens,
        costUsd: Number(d.costUsd.toFixed(5)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Human-in-the-loop metrics (PRD Module 7 & 9)
    const approvalWhere: any = { organizationId: orgId };
    if (startDate) {
      approvalWhere.createdAt = { gte: startDate };
    }

    const approvals = await this.prisma.approvalRequest.findMany({
      where: approvalWhere,
    });

    const totalApprovals = approvals.length;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let executedCount = 0;
    let totalReviewTimeMs = 0;
    let reviewedCount = 0;

    for (const a of approvals) {
      if (a.status === 'PENDING') pendingCount++;
      if (a.status === 'APPROVED') approvedCount++;
      if (a.status === 'REJECTED') rejectedCount++;
      if (a.status === 'EXECUTED') executedCount++;

      if (a.reviewedAt) {
        const diff = a.reviewedAt.getTime() - a.createdAt.getTime();
        if (diff > 0) {
          totalReviewTimeMs += diff;
          reviewedCount++;
        }
      }
    }

    const totalDecided = approvedCount + rejectedCount + executedCount;
    const approvalRate =
      totalDecided > 0
        ? Number((((approvedCount + executedCount) / totalDecided) * 100).toFixed(1))
        : 0;

    const avgReviewTimeMinutes =
      reviewedCount > 0
        ? Number((totalReviewTimeMs / (reviewedCount * 60 * 1000)).toFixed(1))
        : 0;

    return {
      overview: {
        totalInvocations,
        totalTokens,
        promptTokens,
        completionTokens,
        estimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(5)),
        avgLatencyMs,
      },
      featureBreakdown,
      modelBreakdown,
      humanInTheLoopMetrics: {
        totalApprovals,
        approved: approvedCount,
        rejected: rejectedCount,
        pending: pendingCount,
        executed: executedCount,
        approvalRate,
        avgReviewTimeMinutes,
      },
      dailyUsage,
    };
  }

  /**
   * AI-Generated Executive Summary & Operational Insights
   */
  async getExecutiveSummary(orgId: string, timeRange: TimeRangeFilter = TimeRangeFilter.LAST_30_DAYS) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // Retrieve operations and AI stats
    const ops = await this.getOperationsDashboard(orgId, { timeRange });
    const aiUsage = await this.getAiUsageAnalytics(orgId, { timeRange });

    const topCategory =
      ops.categoryBreakdown.length > 0
        ? ops.categoryBreakdown.sort((a, b) => b.count - a.count)[0].category
        : 'General Support';

    const frustratedItem = ops.sentimentBreakdown.find((s) => s.sentiment === 'FRUSTRATED');
    const frustratedCount = frustratedItem ? frustratedItem.count : 0;

    const summaryResult = await this.aiService.generateAnalyticsSummary(
      org.id,
      org.name,
      timeRange,
      {
        totalTickets: ops.overview.totalTickets,
        openTickets: ops.overview.openTickets,
        resolvedTickets: ops.overview.resolvedTickets,
        resolutionRate: ops.overview.resolutionRate,
        urgentTickets: ops.overview.urgentTickets,
        avgResolutionHours: ops.overview.avgResolutionTimeHours,
        frustratedSentimentCount: frustratedCount,
        topCategory,
        totalAiTokens: aiUsage.overview.totalTokens,
        totalAiCostUsd: aiUsage.overview.estimatedCostUsd,
      },
    );

    return {
      ...summaryResult,
      metricsSnapshot: {
        totalTickets: ops.overview.totalTickets,
        resolutionRate: ops.overview.resolutionRate,
        openTickets: ops.overview.openTickets,
        urgentTickets: ops.overview.urgentTickets,
        totalAiTokens: aiUsage.overview.totalTokens,
        estimatedCostUsd: aiUsage.overview.estimatedCostUsd,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
