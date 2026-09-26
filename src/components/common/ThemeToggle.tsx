import React from 'react';
import { useTheme } from '../../context/ThemeContext.tsx';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'icon' | 'pill' | 'segmented';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'icon', className = '' }) => {
  const { theme, toggleTheme, setTheme } = useTheme();

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${className}`}
        role="group"
        aria-label="Theme selection"
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
            theme === 'light'
              ? 'bg-white text-amber-600 shadow-xs dark:bg-slate-700'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          aria-pressed={theme === 'light'}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Light</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
            theme === 'dark'
              ? 'bg-slate-900 text-sky-400 shadow-xs dark:bg-slate-700 dark:text-sky-300'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          aria-pressed={theme === 'dark'}
        >
          <Moon className="w-3.5 h-3.5" />
          <span>Dark</span>
        </button>
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
          theme === 'dark'
            ? 'bg-slate-800 border-slate-700 text-sky-300 hover:bg-slate-700'
            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
        } ${className}`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? (
          <>
            <Moon className="w-3.5 h-3.5 text-sky-300" />
            <span>Dark Mode</span>
          </>
        ) : (
          <>
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>Light Mode</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-1.5 rounded-lg border transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
        theme === 'dark'
          ? 'bg-slate-800 border-slate-700 text-sky-300 hover:bg-slate-750 hover:text-sky-200'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-amber-600'
      } ${className}`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Moon className="w-4 h-4 transition-transform hover:-rotate-12" />
      ) : (
        <Sun className="w-4 h-4 transition-transform hover:rotate-45" />
      )}
    </button>
  );
};
