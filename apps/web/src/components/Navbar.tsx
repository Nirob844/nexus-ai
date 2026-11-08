'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Building2, ChevronDown, Bell, User as UserIcon, ShieldAlert } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';

export function Navbar() {
  const { user, activeOrg, organizations, switchOrg, logout } = useAuth();
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Active Organization Switcher */}
      <div className="relative">
        <button
          onClick={() => setShowOrgMenu(!showOrgMenu)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition text-sm font-medium text-slate-800"
        >
          <div className="w-6 h-6 rounded bg-brand-500 text-white flex items-center justify-center font-bold text-xs">
            {activeOrg?.name ? activeOrg.name.charAt(0).toUpperCase() : 'N'}
          </div>
          <span>{activeOrg?.name || 'Select Organization'}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold uppercase">
            {activeOrg?.systemRole || 'MEMBER'}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

        {showOrgMenu && (
          <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Switch Organization
            </div>
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  switchOrg(org.id);
                  setShowOrgMenu(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition ${
                  org.id === activeOrg?.id ? 'bg-brand-50/60 text-brand-700 font-semibold' : 'text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>{org.name}</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1 rounded">
                  {org.systemRole}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Action Icons: Live WebSocket Indicator, Notifications, User */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium">Live Gateway</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 relative transition"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>
          {showNotifications && (
            <NotificationCenter onClose={() => setShowNotifications(false)} />
          )}
        </div>

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50 transition"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {user?.firstName?.charAt(0) || 'U'}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-sm font-semibold text-slate-800 leading-tight">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-xs text-slate-400 leading-tight">{user?.email}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs text-slate-400">Signed in as</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{user?.email}</p>
                {user?.isSuperAdmin && (
                  <span className="inline-block mt-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    SUPER ADMIN
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition font-medium"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
