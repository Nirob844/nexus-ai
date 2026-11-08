'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Play,
  User,
  Check,
  X,
} from 'lucide-react';

export default function ApprovalsPage() {
  const { activeOrg } = useAuth();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const query = filter ? `?status=${filter}` : '';
      const res = await api.get(`/approvals${query}`);
      if (res.success && res.data) {
        setApprovals(res.data.approvals || []);
      }
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) {
      fetchApprovals();
    }
  }, [activeOrg, filter]);

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoading(id);
    try {
      const notes = reviewNotes[id] || (status === 'APPROVED' ? 'Approved by admin.' : 'Rejected by admin.');
      const res = await api.post(`/approvals/${id}/review`, {
        status,
        reviewNotes: notes,
      });

      if (res.success) {
        fetchApprovals();
      }
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            PENDING REVIEW
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            APPROVED
          </span>
        );
      case 'EXECUTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            EXECUTED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            REJECTED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-600" />
            <span>AI Action Approvals Center</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Human-in-the-loop review engine. Sensitive operations require verified authorization before execution.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200">
          {[
            { label: 'All', value: '' },
            { label: 'Pending', value: 'PENDING' },
            { label: 'Executed', value: 'EXECUTED' },
            { label: 'Rejected', value: 'REJECTED' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filter === tab.value
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Approvals List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading approval queue...</div>
        ) : approvals.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">No actions waiting for review</h3>
            <p className="text-xs text-slate-400 mt-1">
              All AI action requests have been reviewed or executed safely.
            </p>
          </div>
        ) : (
          approvals.map((req) => {
            const isPending = req.status === 'PENDING';
            const payload = req.actionPayload || {};

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 hover:border-slate-300 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                      {req.actionType}
                    </span>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Requested: {new Date(req.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Payload & Diff View */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Action Target & Payload Diff
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-emerald-400 overflow-x-auto shadow-inner">
                    <pre>{JSON.stringify(payload, null, 2)}</pre>
                  </div>
                </div>

                {/* Audit Context */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Requested by:{' '}
                      <strong className="text-slate-700">
                        {req.requestedBy?.name || req.requestedBy?.email || 'AI Suggester'}
                      </strong>
                    </span>
                  </div>

                  {req.reviewedBy && (
                    <div>
                      Reviewed by: <strong className="text-slate-700">{req.reviewedBy.name}</strong> ({req.reviewNotes})
                    </div>
                  )}
                </div>

                {/* Action Buttons if Pending */}
                {isPending && (
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Optional audit review notes (e.g. 'Verified customer plan eligibility')..."
                      value={reviewNotes[req.id] || ''}
                      onChange={(e) =>
                        setReviewNotes({ ...reviewNotes, [req.id]: e.target.value })
                      }
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleReview(req.id, 'REJECTED')}
                        disabled={actionLoading === req.id}
                        className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleReview(req.id, 'APPROVED')}
                        disabled={actionLoading === req.id}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{actionLoading === req.id ? 'Executing...' : 'Approve & Execute'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
