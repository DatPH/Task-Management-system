import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  initTheme: () => void;
}

const STORAGE_KEY = 'kanban_theme_preference';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch (e) {
    console.warn('Could not read theme from localStorage', e);
  }

  return 'light';
};

const applyThemeToDOM = (theme: ThemeMode) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isDark = theme === 'dark';

  if (isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  isDark: false,

  initTheme: () => {
    const initialTheme = getInitialTheme();
    applyThemeToDOM(initialTheme);
    set({ theme: initialTheme, isDark: initialTheme === 'dark' });
  },

  setTheme: (theme: ThemeMode) => {
    applyThemeToDOM(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      console.warn('Could not save theme to localStorage', e);
    }
    set({ theme, isDark: theme === 'dark' });
  },

  toggleTheme: () => {
    const current = get().theme;
    const nextTheme: ThemeMode = current === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },
}));
