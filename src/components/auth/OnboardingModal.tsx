import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ThemeToggle } from '../common/ThemeToggle.tsx';
import {
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  UserPlus
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
}

/**
 * Login screen for unauthenticated users.
 * Username + password only — no demo accounts.
 */
export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen }) => {
  const { loginWithUsername } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithUsername(username.trim(), password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col text-slate-900 dark:text-slate-100">
        <div className="bg-gradient-to-r from-emerald-600 to-slate-900 p-6 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/src/assets/images/phonemail_brand_mark_1790265389236.jpg"
                alt="PhoneMail"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-cover border border-white/20 shadow-sm"
              />
              <div>
                <h2 className="text-xl font-bold tracking-tight">PhoneMail</h2>
                <p className="text-xs text-emerald-100">Sign in with your username</p>
              </div>
            </div>
            <ThemeToggle variant="icon" className="bg-white/10 hover:bg-white/20 text-white border-white/20" />
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              Username
            </span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Password
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </label>

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? 'Signing in…' : (
              <>
                <span>Login</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">Don&apos;t have an account?</p>
            <a
              href="/register"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Create Account
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};
