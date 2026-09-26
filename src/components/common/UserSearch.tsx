import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { UserSummary } from '../../types.ts';
import { Search, User, MessageCircle, AlertCircle } from 'lucide-react';

interface UserSearchProps {
  onSelectUser: (user: UserSummary) => void;
  placeholder?: string;
  compact?: boolean;
}

export const UserSearch: React.FC<UserSearchProps> = ({
  onSelectUser,
  placeholder = 'Search username to message…',
  compact = false
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      setError('');
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.searchUsers(query.trim());
        setResults(data);
        if (data.length === 0) {
          setError(`No users matching “${query.trim()}”`);
        }
        setOpen(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className={`relative ${compact ? '' : 'w-full'}`}>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder={placeholder}
          aria-label="Search users by username"
          className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {open && (query.trim().length > 0) && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>
          )}
          {!loading && error && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}
          {!loading &&
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onSelectUser(u);
                  setQuery('');
                  setOpen(false);
                  setResults([]);
                }}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {(u.username || u.display_name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                    <User className="w-3 h-3 text-emerald-600" />
                    @{u.username}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{u.display_name}</div>
                </div>
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
