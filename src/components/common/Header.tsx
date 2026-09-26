import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ViewportMode, FolderType } from '../../types.ts';
import { ThemeToggle } from './ThemeToggle.tsx';
import {
  Smartphone,
  Monitor,
  PhoneCall,
  Mail,
  MessageSquare,
  Settings,
  LogOut,
  RotateCcw,
  Sparkles,
  UserCheck,
  Download
} from 'lucide-react';

interface HeaderProps {
  viewportMode: ViewportMode;
  setViewportMode: (mode: ViewportMode) => void;
  onOpenSettings: () => void;
  onOpenInboundSimulator: () => void;
  onOpenIvrSimulator: () => void;
  onOpenSmsLogs: () => void;
  onResetSeed: () => void;
  unreadCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  viewportMode,
  setViewportMode,
  onOpenSettings,
  onOpenInboundSimulator,
  onOpenIvrSimulator,
  onOpenSmsLogs,
  onResetSeed,
  unreadCount
}) => {
  const { user, logout, switchDemoUser } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-xs transition-colors">
      {/* Zone 1: Wordmark & Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <img
            src="/src/assets/images/phonemail_brand_mark_1790265389236.jpg"
            alt="PhoneMail Logo"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-lg object-cover shadow-xs border border-slate-200 dark:border-slate-700"
          />
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
            Phone<span className="text-emerald-600 dark:text-emerald-400">Mail</span>
          </span>
        </div>

        {user && (
          <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">+{user.phoneNumber}</span>
            <span className="text-slate-400 dark:text-slate-600">·</span>
            <span className="text-emerald-700 dark:text-emerald-300 font-mono bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded text-[11px] border border-emerald-200 dark:border-emerald-800/60">
              {user.emailAddress}
            </span>
          </div>
        )}
      </div>

      {/* Zone 2: Buildathon Controls (Viewport Switcher & Telephony/Inbound Tools) */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Viewport Switcher */}
        <div className="bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg flex items-center border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setViewportMode('responsive')}
            title="Auto Responsive"
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
              viewportMode === 'responsive'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="hidden md:inline">Auto</span>
          </button>
          <button
            onClick={() => setViewportMode('mobile')}
            title="Force WhatsApp Mobile View"
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              viewportMode === 'mobile'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mobile (WhatsApp)</span>
          </button>
          <button
            onClick={() => setViewportMode('desktop')}
            title="Force Gmail Desktop View"
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              viewportMode === 'desktop'
                ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desktop (Gmail)</span>
          </button>
        </div>

        {/* Inbound Simulator Tool */}
        <button
          onClick={onOpenInboundSimulator}
          title="Simulate incoming email from external sender"
          className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
        >
          <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Inbound Webhook</span>
        </button>

        {/* IVR Toll-free simulator */}
        <button
          onClick={onOpenIvrSimulator}
          title="Simulate Toll-Free IVR Call (Press 1 to create account)"
          className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
        >
          <PhoneCall className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Toll-Free IVR</span>
        </button>

        {/* SMS Logs button */}
        <button
          onClick={onOpenSmsLogs}
          title="View SMS notification delivery logs"
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="hidden md:inline">SMS Logs</span>
        </button>

        {/* Download Full Project ZIP */}
        <a
          href="/phonemail-project.zip"
          download="phonemail-project.zip"
          title="Download entire PhoneMail project as ZIP"
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-semibold">Download ZIP</span>
        </a>
      </div>

      {/* Zone 3: Theme Toggle, User Switcher & Settings */}
      <div className="flex items-center gap-2">
        {/* Global Theme Switcher Component */}
        <ThemeToggle />

        {/* Quick Demo User Switcher */}
        {user && (
          <div className="hidden xl:flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => switchDemoUser('9876543210')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                user.phoneNumber === '9876543210'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Nikhil (User 1)
            </button>
            <button
              onClick={() => switchDemoUser('9123456789')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                user.phoneNumber === '9123456789'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Sarah (User 2)
            </button>
          </div>
        )}

        {!user && (
          <a
            href="/register"
            className="hidden sm:inline-flex px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
          >
            Register
          </a>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Settings & Aliases"
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User avatar / profile */}
        {user && (
          <div className="flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-slate-800">
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

