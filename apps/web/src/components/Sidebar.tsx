'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Ticket,
  CheckCircle2,
  BookOpen,
  Activity,
  PlusCircle,
  Cpu,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Operations Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: 'Support Tickets',
      href: '/dashboard/tickets',
      icon: Ticket,
      exact: false,
    },
    {
      label: 'AI Approvals Center',
      href: '/dashboard/approvals',
      icon: CheckCircle2,
      exact: false,
    },
    {
      label: 'Knowledge Base & RAG',
      href: '/dashboard/knowledge',
      icon: BookOpen,
      exact: false,
    },
    {
      label: 'AI Observability & Cost',
      href: '/dashboard/analytics',
      icon: Activity,
      exact: false,
    },
  ];

  const isActive = (item: { href: string; exact: boolean }) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Title */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-white tracking-wide text-lg">NEXUS</span>
          <span className="ml-1 text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            AI SaaS
          </span>
        </div>
      </div>

      {/* Quick Action Button: New Customer Ticket */}
      <div className="p-4">
        <Link
          href="/dashboard/tickets/new"
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Support Ticket</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                active
                  ? 'bg-slate-800 text-white font-semibold border-l-4 border-brand-500 pl-2'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition ${
                  active ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 space-y-1">
        <p className="font-medium text-slate-400">NEXUS AI Suite v2.0</p>
        <p>PostgreSQL 16 + pgvector</p>
        <p>FastAPI RAG + NestJS BullMQ</p>
      </div>
    </aside>
  );
}
