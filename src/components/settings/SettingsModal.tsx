import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { ThemeToggle } from '../common/ThemeToggle.tsx';
import { api } from '../../services/api.ts';
import { Alias } from '../../types.ts';
import {
  X,
  User,
  Mail,
  Phone,
  Shield,
  Plus,
  Trash2,
  Globe,
  KeyRound,
  CheckCircle,
  AlertCircle,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, refreshUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [language, setLanguage] = useState<string>('en');

  const [aliases, setAliases] = useState<Alias[]>([]);
  const [newAliasName, setNewAliasName] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [aliasLoading, setAliasLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (user && isOpen) {
      setDisplayName(user.displayName);
      setAvatarUrl(user.avatarUrl || '');
      setLanguage(user.language || 'en');
      loadAliases();
      setStatusMsg('');
      setErrorMsg('');
    }
  }, [user, isOpen]);

  const loadAliases = async () => {
    try {
      const data = await api.getAliases();
      setAliases(data);
    } catch (err) {
      console.warn('Failed to load aliases', err);
    }
  };

  if (!isOpen || !user) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      await api.updateProfile({ displayName, avatarUrl, language });
      await refreshUser();
      setStatusMsg('Profile updated successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAliasName.trim()) return;

    setAliasLoading(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      await api.createAlias(newAliasName);
      setNewAliasName('');
      await loadAliases();
      await refreshUser();
      setStatusMsg('Alias created successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create alias');
    } finally {
      setAliasLoading(false);
    }
  };

  const handleDeleteAlias = async (aliasId: string) => {
    setErrorMsg('');
    try {
      await api.deleteAlias(aliasId);
      await loadAliases();
      await refreshUser();
      setStatusMsg('Alias removed.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete alias');
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      await api.setPassword(password);
      setPassword('');
      await refreshUser();
      setStatusMsg('Password fallback set successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold">Profile & Account Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Section: Appearance & Theme */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
                <span>Interface Theme</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono capitalize">
                Current: {theme}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs">
                Switch between crisp light mode and high-contrast dark mode for both mobile and desktop viewports.
              </p>
              <ThemeToggle variant="segmented" />
            </div>
          </div>

          {/* Section 1: PhoneMail Identities */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>PhoneMail Identities</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Verified Phone Number</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">+{user.phoneNumber}</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold rounded">
                  Primary Phone
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 rounded-lg shadow-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Official PhoneMail Address</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{user.emailAddress}</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-semibold rounded">
                  Active Inbound
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Alias Management */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Alias IDs Management</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {aliases.length} active {aliases.length === 1 ? 'alias' : 'aliases'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create secondary email addresses linked directly to your PhoneMail inbox without revealing your personal phone number.
            </p>

            {/* List of existing aliases */}
            <div className="space-y-1.5">
              {aliases.map((alias) => (
                <div
                  key={alias.id}
                  className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                >
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{alias.alias_email}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteAlias(alias.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                    title="Remove alias"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new alias form */}
            <form onSubmit={handleCreateAlias} className="flex gap-2 pt-1">
              <input
                type="text"
                value={newAliasName}
                onChange={(e) => setNewAliasName(e.target.value)}
                placeholder="e.g. support or work.9876543210"
                className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={aliasLoading || !newAliasName.trim()}
                className="px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Alias</span>
              </button>
            </form>
          </div>

          {/* Section 3: Profile Details */}
          <form onSubmit={handleUpdateProfile} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              Personal Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Avatar Image URL
                </label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Preferred Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="es">Español (Spanish)</option>
                <option value="fr">Français (French)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          {/* Section 4: Password Fallback Setup */}
          <form onSubmit={handleSetPassword} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Password Fallback</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Set or update your password fallback if you cannot access SMS/OTP on a particular device.
            </p>

            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New fallback password (min 6 chars)"
                className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={loading || password.length < 6}
                className="px-3.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
              >
                Update Password
              </button>
            </div>
          </form>

          {/* Logout button */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className="px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out of PhoneMail</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
