import React, { useState } from 'react';
import { api } from '../../services/api.ts';
import {
  User,
  Lock,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  UserPlus
} from 'lucide-react';

/**
 * Create Account page — username, password, confirm password, phone.
 */
export const RegistrationPortal: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setPhone('');
    setDisplayName('');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.registerAccount({
        username: username.trim(),
        password,
        confirmPassword,
        phone: phone.trim(),
        displayName: displayName.trim() || username.trim()
      });
      setSuccess(
        `Account created! Username @${result.username}. PhoneMail: ${result.emailAddress}. You can now log in.`
      );
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-4 font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-slate-900 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Create Account</h1>
              <p className="text-xs text-emerald-100">Choose a username and password</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleRegister} className="p-6 space-y-3.5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-semibold flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-emerald-600" /> Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alice"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
            <span className="text-[10px] text-slate-400">3–32 chars, start with a letter (a–z, 0–9, _)</span>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold">Display name (optional)</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alice Example"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-emerald-600" /> Phone number</span>
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
            <span className="text-[10px] text-slate-400">Used for your PhoneMail address (phone@phonemail.com)</span>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-600" /> Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-600" /> Confirm Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? 'Creating account…' : (
              <>
                <span>Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <a href="/" className="block text-center text-xs text-slate-500 hover:text-emerald-700 underline">
            Already have an account? Log in
          </a>
        </form>
      </div>
    </div>
  );
};
