import React, { useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false,
  size = 'md',
}) => {
  const { theme, isDark, toggleTheme, initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-1.5 rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 ${
        isSmall ? 'p-1.5 text-xs' : 'px-2.5 py-1.5 text-xs'
      } ${
        isDark
          ? 'bg-zinc-800/90 hover:bg-zinc-700 text-amber-300 border-zinc-700 hover:border-zinc-600 shadow-xs'
          : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-200/90 hover:border-zinc-300 shadow-2xs'
      } ${className}`}
      title={isDark ? 'Switch to Light Mode (Normal mode)' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? (
        <Sun className={`${isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-amber-400 shrink-0 transition-transform duration-200 rotate-0`} />
      ) : (
        <Moon className={`${isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-zinc-600 shrink-0 transition-transform duration-200 rotate-0`} />
      )}

      {showLabel && (
        <span className="font-medium select-none">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
};
