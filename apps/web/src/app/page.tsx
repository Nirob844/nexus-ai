'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { Cpu, ArrowRight, ShieldCheck, Zap, Database } from 'lucide-react';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-500 flex items-center justify-center mb-6 shadow-2xl shadow-brand-500/30">
        <Cpu className="w-8 h-8 text-white animate-pulse" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">NEXUS AI</h1>
      <p className="mt-3 text-slate-400 text-center max-w-md text-sm sm:text-base">
        Multi-Tenant AI-Powered Business Operations & Customer Support Platform
      </p>

      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition shadow-lg shadow-brand-600/20"
        >
          <span>Sign In</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/register"
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition border border-slate-700"
        >
          <span>Create Workspace</span>
        </Link>
      </div>

      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl text-left border-t border-slate-900 pt-8">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-slate-200">RAG Knowledge Base</h4>
            <p className="text-xs text-slate-400 mt-1">pgvector HNSW cosine search with source citations.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-brand-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-slate-200">AI Background Worker</h4>
            <p className="text-xs text-slate-400 mt-1">BullMQ queue for automated classification & suggestions.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Human-in-the-Loop</h4>
            <p className="text-xs text-slate-400 mt-1">Audit-logged approval center for sensitive AI actions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
