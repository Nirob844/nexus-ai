'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { getSocket } from '@/lib/socket';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Sparkles,
  Lock,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  Flame,
  FileText,
  ChevronDown,
  BookOpen,
  MessageSquare,
} from 'lucide-react';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [handoverSummary, setHandoverSummary] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTicket = async () => {
    try {
      const res = await api.get(`/tickets/${id}`);
      if (res.success && res.data) {
        setTicket(res.data);
        setMessages(res.data.messages || []);
        if (res.data.suggestions && res.data.suggestions.length > 0) {
          setSuggestion(res.data.suggestions[0]);
        }
        if (res.data.analyses && res.data.analyses.length > 0) {
          setAnalysis(res.data.analyses[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load ticket:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchTicket();

      const socket = getSocket();
      if (socket) {
        socket.emit('join:ticket', { ticketId: id });

        const handleNewMessage = (msg: any) => {
          setMessages((prev) => [...prev, msg]);
        };

        const handleTicketUpdate = (updated: any) => {
          setTicket((prev: any) => ({ ...prev, ...updated }));
        };

        socket.on('ticket:message', handleNewMessage);
        socket.on('ticket:updated', handleTicketUpdate);

        return () => {
          socket.emit('leave:ticket', { ticketId: id });
          socket.off('ticket:message', handleNewMessage);
          socket.off('ticket:updated', handleTicketUpdate);
        };
      }
    }
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setSending(true);
    try {
      const res = await api.post(`/tickets/${id}/messages`, {
        content: replyText,
        isInternal,
      });

      if (res.success) {
        setReplyText('');
        fetchTicket();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await api.patch(`/tickets/${id}/status`, { status: newStatus });
      if (res.success) {
        setTicket((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    try {
      const res = await api.patch(`/tickets/${id}/priority`, { priority: newPriority });
      if (res.success) {
        setTicket((prev: any) => ({ ...prev, priority: newPriority }));
      }
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      const res = await api.post(`/tickets/${id}/summarize`, {});
      if (res.success && res.data) {
        setHandoverSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to generate summary:', err);
    } finally {
      setSummarizing(false);
    }
  };

  if (loading || !ticket) {
    return (
      <div className="py-20 text-center text-xs text-slate-400">
        Loading ticket conversation...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tickets Workbench</span>
        </Link>

        <button
          onClick={handleSummarize}
          disabled={summarizing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>{summarizing ? 'Synthesizing...' : 'Summarize Thread'}</span>
        </button>
      </div>

      {/* Split-Screen Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-Columns: Conversation & AI Suggested Reply */}
        <div className="lg:col-span-2 space-y-4">
          {/* Ticket Header Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-slate-400">
                #{ticket.ticketNumber}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700">
                {ticket.status}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                {ticket.priority}
              </span>
              <span className="text-xs text-slate-500">
                Category: <strong>{ticket.category}</strong>
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900">{ticket.subject}</h1>
            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
              {ticket.description}
            </p>
          </div>

          {/* AI Handover Brief Card (if generated) */}
          {handoverSummary && (
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-indigo-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-indigo-300">
                <Sparkles className="w-4 h-4 text-brand-400" />
                <span>AI Handover & Shift Brief</span>
              </div>
              <p className="text-slate-200 leading-relaxed">{handoverSummary.summary}</p>
              {handoverSummary.handoverNotes && (
                <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-[11px] text-indigo-200 whitespace-pre-line">
                  {handoverSummary.handoverNotes}
                </div>
              )}
            </div>
          )}

          {/* Messages Thread */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 max-h-[480px] overflow-y-auto">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center pb-2 border-b border-slate-100">
              Conversation Thread
            </div>

            {messages.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No replies exchanged yet. Use the composer below or apply the AI draft.
              </div>
            ) : (
              messages.map((m) => {
                const isCust = m.senderType === 'CUSTOMER';
                const isInternalNote = m.isInternal;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      isCust ? 'items-start' : 'items-end'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs shadow-sm ${
                        isInternalNote
                          ? 'bg-amber-50 border border-amber-200 text-amber-900'
                          : isCust
                          ? 'bg-slate-100 text-slate-800 rounded-bl-sm'
                          : 'bg-brand-600 text-white rounded-br-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-80 font-semibold">
                        <span>
                          {isInternalNote
                            ? '🔒 Private Internal Note'
                            : isCust
                            ? ticket.customer?.name || 'Customer'
                            : m.sender?.name || 'Support Agent'}
                        </span>
                        <span>
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* AI Knowledge Suggestion Card */}
          {suggestion && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>AI Grounded Suggestion Draft</span>
                  <span className="text-[10px] font-semibold bg-emerald-200/60 text-emerald-900 px-1.5 py-0.5 rounded">
                    RAG Knowledge Grounded
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReplyText(suggestion.suggestedReply);
                    setIsInternal(false);
                  }}
                  className="text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300 transition shadow-xs"
                >
                  Use This AI Draft
                </button>
              </div>

              <div className="text-xs text-slate-700 bg-white/80 p-3 rounded-xl border border-emerald-100 whitespace-pre-line leading-relaxed">
                {suggestion.suggestedReply}
              </div>

              {suggestion.actionType && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-700">
                  <span className="font-semibold">Recommended Action:</span>
                  <span className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-800">
                    {suggestion.actionType}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Reply Composer */}
          <form
            onSubmit={handleSendMessage}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsInternal(false)}
                  className={`px-3 py-1 rounded-lg transition ${
                    !isInternal
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Public Reply to Customer
                </button>
                <button
                  type="button"
                  onClick={() => setIsInternal(true)}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                    isInternal
                      ? 'bg-amber-100 text-amber-800'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Internal Note</span>
                </button>
              </div>

              {isInternal && (
                <span className="text-[10px] text-amber-600 font-medium">
                  Hidden from customer
                </span>
              )}
            </div>

            <textarea
              rows={4}
              placeholder={
                isInternal
                  ? 'Add private notes, handover context, or engineering observations...'
                  : 'Type your message to the customer or apply the AI draft above...'
              }
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-[11px] text-slate-400">
                Press Send to update ticket status and notify recipient
              </div>
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition shadow-sm ${
                  isInternal
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-brand-600 hover:bg-brand-500'
                } disabled:opacity-40`}
              >
                <span>{sending ? 'Sending...' : isInternal ? 'Save Internal Note' : 'Send Reply'}</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>

        {/* Right 1-Column: AI Classification & Ticket Status Controls */}
        <div className="space-y-4">
          {/* AI Intelligence Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-3">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>AI Classification & Sentiment</span>
            </div>

            {analysis ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Customer Sentiment
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        analysis.sentiment === 'FRUSTRATED'
                          ? 'bg-rose-100 text-rose-700'
                          : analysis.sentiment === 'NEGATIVE'
                          ? 'bg-amber-100 text-amber-700'
                          : analysis.sentiment === 'POSITIVE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {analysis.sentiment}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Urgency Score ({analysis.urgencyScore}/10)
                  </span>
                  <div className="w-full bg-slate-100 h-2 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        analysis.urgencyScore >= 8
                          ? 'bg-rose-500'
                          : analysis.urgencyScore >= 5
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${analysis.urgencyScore * 10}%` }}
                    />
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Customer Intent
                  </span>
                  <p className="mt-0.5 text-slate-700 font-medium">{analysis.intent}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">AI analysis pending or in progress.</p>
            )}
          </div>

          {/* Ticket State Controls */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
              Ticket Controls
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Status
              </label>
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="PENDING_CUSTOMER">PENDING_CUSTOMER</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Priority
              </label>
              <select
                value={ticket.priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>

          {/* Customer Metadata Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
            <div className="font-bold text-slate-900 border-b border-slate-100 pb-2">
              Customer Details
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                {ticket.customer?.name?.charAt(0) || 'C'}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{ticket.customer?.name}</p>
                <p className="text-[11px] text-slate-400">{ticket.customer?.email}</p>
              </div>
            </div>
            {ticket.customer?.metadata && (
              <div className="mt-2 p-2 rounded-lg bg-slate-50 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Plan Tier:</span>
                  <span className="font-semibold text-brand-700">
                    {ticket.customer.metadata.plan || 'Standard'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
