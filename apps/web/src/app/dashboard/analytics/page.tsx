'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Activity,
  Cpu,
  Clock,
  DollarSign,
  Layers,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function AiAnalyticsPage() {
  const { activeOrg } = useAuth();
  const [data, setData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/analytics/ai-usage?timeRange=${timeRange}`);
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load AI usage analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) {
      fetchData();
    }
  }, [activeOrg, timeRange]);

  const overview = data?.overview || {};
  const featureBreakdown = data?.featureBreakdown || [];
  const modelBreakdown = data?.modelBreakdown || [];
  const humanMetrics = data?.humanInTheLoopMetrics || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-600" />
            <span>AI Observability & Cost Telemetry</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time tracking of AI token consumption, compute latency, model efficiency, and human approval benchmarks.
          </p>
        </div>

        {/* Time Filter */}
        <div className="flex items-center gap-2">
          {['24h', '7d', '30d', '90d', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition uppercase ${
                timeRange === range
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Invocations</span>
            <Zap className="w-4 h-4 text-brand-600" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {overview.totalInvocations || 0}
          </div>
          <p className="text-xs text-slate-400 mt-1">Total microservice API calls</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Tokens Consumed</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {(overview.totalTokens || 0).toLocaleString()}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {overview.promptTokens || 0} prompt / {overview.completionTokens || 0} completion
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Estimated Cost</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            ${(overview.estimatedCostUsd || 0).toFixed(4)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Calculated token compute expense</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Average Latency</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900">
            {overview.avgLatencyMs || 0}
            <span className="text-sm font-semibold text-slate-500 ml-1">ms</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Mean inference response duration</p>
        </div>
      </div>

      {/* Feature Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-brand-600" />
            <span>AI Feature Cost & Latency Distribution</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3">Feature Name</th>
                <th className="px-6 py-3 text-center">Invocations</th>
                <th className="px-6 py-3 text-center">Tokens</th>
                <th className="px-6 py-3 text-center">Avg Latency</th>
                <th className="px-6 py-3 text-right">Estimated Cost (USD)</th>
                <th className="px-6 py-3 text-right">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {featureBreakdown.map((f: any) => (
                <tr key={f.feature} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-3.5 font-mono text-slate-900 font-semibold">
                    {f.feature}
                  </td>
                  <td className="px-6 py-3.5 text-center">{f.invocations}</td>
                  <td className="px-6 py-3.5 text-center font-mono">
                    {f.totalTokens.toLocaleString()}
                  </td>
                  <td className="px-6 py-3.5 text-center">{f.avgLatencyMs} ms</td>
                  <td className="px-6 py-3.5 text-right font-semibold text-slate-900 font-mono">
                    ${f.estimatedCostUsd.toFixed(5)}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                      {f.percentageOfCost}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Human-in-the-Loop & Model Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Human-in-the-Loop Benchmarks */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Human Approval Benchmarks</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                Approval Rate
              </span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                {humanMetrics.approvalRate || 0}%
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Approved out of reviewed</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                Review Velocity
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {humanMetrics.avgReviewTimeMinutes || 0}
                <span className="text-xs font-medium text-slate-500 ml-1">mins</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Mean time to review</p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs pt-2">
            <div className="flex justify-between text-slate-600">
              <span>Total Actions Requested:</span>
              <strong className="text-slate-900">{humanMetrics.totalApprovals || 0}</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Executed Safely:</span>
              <strong className="text-emerald-600">{humanMetrics.executed || 0}</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Pending Review:</span>
              <strong className="text-amber-600">{humanMetrics.pending || 0}</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Rejected by Admin:</span>
              <strong className="text-rose-600">{humanMetrics.rejected || 0}</strong>
            </div>
          </div>
        </div>

        {/* Model Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Cpu className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-sm">Deployed AI Models</h3>
          </div>

          <div className="space-y-3">
            {modelBreakdown.map((m: any) => (
              <div
                key={m.model}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-mono font-bold text-slate-900">{m.model}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {m.invocations} calls • {m.totalTokens.toLocaleString()} tokens
                  </div>
                </div>
                <div className="font-mono font-semibold text-slate-900">
                  ${m.estimatedCostUsd.toFixed(5)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
