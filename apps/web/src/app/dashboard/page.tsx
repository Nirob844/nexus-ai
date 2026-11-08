'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Ticket,
  Clock,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Cpu,
  Users,
  Smile,
  Meh,
  Frown,
  Flame,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { activeOrg } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, sumRes] = await Promise.all([
        api.get(`/analytics/dashboard?timeRange=${timeRange}`),
        api.get(`/analytics/summary?timeRange=${timeRange}`).catch(() => null),
      ]);

      if (dashRes.success) {
        setDashboardData(dashRes.data);
      }
      if (sumRes && sumRes.success) {
        setSummaryData(sumRes.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) {
      fetchData();
    }
  }, [activeOrg, timeRange]);

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Aggregating live operations & AI telemetry...</p>
        </div>
      </div>
    );
  }

  const overview = dashboardData?.overview || {};
  const statusBreakdown = dashboardData?.statusBreakdown || [];
  const priorityBreakdown = dashboardData?.priorityBreakdown || [];
  const categoryBreakdown = dashboardData?.categoryBreakdown || [];
  const sentimentBreakdown = dashboardData?.sentimentBreakdown || [];
  const agentPerformance = dashboardData?.agentPerformance || [];

  const getHealthBadge = (status?: string) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Operations Healthy
          </span>
        );
      case 'NEEDS_ATTENTION':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Needs Attention
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Critical SLA Pressure
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
            Monitoring
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Support Operations & AI Intelligence
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time metrics, SLA performance, and knowledge-grounded AI telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {['24h', '7d', '30d', '90d', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition uppercase ${
                timeRange === range
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* AI Executive Insights Banner */}
      {summaryData && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-400" />
              <h3 className="font-bold text-base text-slate-100">AI Executive Synthesis</h3>
            </div>
            {getHealthBadge(summaryData.healthStatus)}
          </div>

          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            {summaryData.executiveSummary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-xs">
            <div>
              <span className="font-semibold text-brand-300 uppercase tracking-wider block mb-1">
                Key Insights
              </span>
              <ul className="space-y-1 text-slate-300">
                {summaryData.keyInsights?.map((k: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-brand-400 mt-0.5">•</span>
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="font-semibold text-emerald-300 uppercase tracking-wider block mb-1">
                Operational Recommendations
              </span>
              <ul className="space-y-1 text-slate-300">
                {summaryData.operationalRecommendations?.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tickets & Resolution Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Tickets
            </span>
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {overview.totalTickets || 0}
            </span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              {overview.resolutionRate || 0}% Resolved
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {overview.resolvedTickets || 0} resolved / {overview.openTickets || 0} open
          </p>
        </div>

        {/* Urgent Tickets */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Urgent Backlog
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {overview.urgentTickets || 0}
            </span>
            {overview.urgentTickets > 0 ? (
              <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                Escalated
              </span>
            ) : (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Stable
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Requiring immediate agent resolution</p>
        </div>

        {/* SLA Avg Resolution Time */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Mean Resolution SLA
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {overview.avgResolutionTimeHours || 0}
            </span>
            <span className="text-sm font-semibold text-slate-500">hours</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            First response: {overview.avgFirstResponseTimeMinutes || 0} mins
          </p>
        </div>

        {/* AI Processing Telemetry */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              AI Processing Cost
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              ${summaryData?.metricsSnapshot?.estimatedCostUsd || '0.0022'}
            </span>
            <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
              {summaryData?.metricsSnapshot?.totalAiTokens || 1080} tokens
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Across classification & RAG replies</p>
        </div>
      </div>

      {/* Two Column Section: Sentiment Analysis & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Sentiment Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              <span>Customer Sentiment Distribution</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">From AI Analysis</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sentimentBreakdown.map((s: any) => {
              let icon = <Meh className="w-5 h-5 text-slate-400" />;
              let color = 'text-slate-600 bg-slate-50 border-slate-200';
              if (s.sentiment === 'POSITIVE') {
                icon = <Smile className="w-5 h-5 text-emerald-500" />;
                color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
              } else if (s.sentiment === 'NEGATIVE') {
                icon = <Frown className="w-5 h-5 text-amber-500" />;
                color = 'text-amber-700 bg-amber-50 border-amber-200';
              } else if (s.sentiment === 'FRUSTRATED') {
                icon = <AlertTriangle className="w-5 h-5 text-rose-500" />;
                color = 'text-rose-700 bg-rose-50 border-rose-200';
              }

              return (
                <div key={s.sentiment} className={`p-3 rounded-xl border ${color} text-center`}>
                  <div className="flex justify-center mb-1">{icon}</div>
                  <div className="text-lg font-bold">{s.count}</div>
                  <div className="text-[11px] font-semibold uppercase">{s.sentiment}</div>
                  <div className="text-[10px] opacity-75">{s.percentage}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Ticket Categories</h3>
            <span className="text-xs text-slate-400 font-medium">Volume & Distribution</span>
          </div>

          <div className="space-y-3">
            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400">No category data recorded yet.</p>
            ) : (
              categoryBreakdown.map((c: any) => (
                <div key={c.category}>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-700">{c.category}</span>
                    <span className="text-slate-500">
                      {c.count} tickets ({c.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-300"
                      style={{ width: `${c.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Support Agent Performance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" />
            <span>Support Team Performance</span>
          </h3>
          <Link
            href="/dashboard/tickets"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition"
          >
            <span>View All Tickets</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
              <tr>
                <th className="px-6 py-3">Agent</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3 text-center">Assigned</th>
                <th className="px-6 py-3 text-center">Resolved</th>
                <th className="px-6 py-3 text-center">Resolution Rate</th>
                <th className="px-6 py-3 text-right">Mean Resolution SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {agentPerformance.map((agent: any) => (
                <tr key={agent.userId} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-3.5 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                      {agent.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{agent.name}</div>
                      <div className="text-[11px] text-slate-400">{agent.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                      {agent.systemRole}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-center font-semibold text-slate-900">
                    {agent.assignedCount}
                  </td>
                  <td className="px-6 py-3.5 text-center font-semibold text-emerald-600">
                    {agent.resolvedCount}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                      {agent.resolutionRate}%
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right font-semibold text-slate-600">
                    {agent.avgResolutionHours}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
