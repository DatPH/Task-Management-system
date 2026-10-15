import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import LoginPage from './app/login/page';
import DashboardPage from './app/page';
import { ThemeToggle } from './components/ThemeToggle';
import { useThemeStore } from './store/useThemeStore';

export default function App() {
  const [route, setRoute] = useState<'dashboard' | 'login'>('dashboard');
  const [sessionUser, setSessionUser] = useState<string | null>(null);
  const initTheme = useThemeStore((s) => s.initTheme);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionUser(data.session.user.email || null);
        setRoute('dashboard');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSessionUser(session.user.email || null);
        setRoute('dashboard');
      } else {
        setSessionUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased overflow-hidden">
      {/* Top Banner with route switcher for testing both login & protected dashboard in AI Studio preview */}
      <div className="bg-zinc-900 dark:bg-zinc-950 text-zinc-300 px-4 py-1.5 text-[11px] flex items-center justify-between border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          <span>Next.js & Supabase Architecture</span>
        </div>
        <div className="flex items-center gap-3">
          {sessionUser ? (
            <span className="text-zinc-400 hidden sm:inline">
              User: <strong className="text-white">{sessionUser}</strong>
            </span>
          ) : (
            <span className="text-zinc-400 hidden sm:inline">Demo Mode</span>
          )}
          <div className="flex items-center border border-zinc-700 rounded-md overflow-hidden text-[10px]">
            <button
              type="button"
              onClick={() => setRoute('dashboard')}
              className={`px-2 py-0.5 transition-colors ${
                route === 'dashboard'
                  ? 'bg-zinc-700 text-white font-semibold'
                  : 'hover:bg-zinc-800 text-zinc-400'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setRoute('login')}
              className={`px-2 py-0.5 transition-colors ${
                route === 'login'
                  ? 'bg-zinc-700 text-white font-semibold'
                  : 'hover:bg-zinc-800 text-zinc-400'
              }`}
            >
              Login
            </button>
          </div>

          {/* Quick Global Dark Mode Toggle in Top Banner */}
          <ThemeToggle size="sm" showLabel={false} />
        </div>
      </div>

      <div className={`flex-1 min-h-0 min-w-0 ${route === 'login' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        {route === 'login' ? (
          <LoginPage onSuccess={() => setRoute('dashboard')} />
        ) : (
          <DashboardPage />
        )}
      </div>
    </div>
  );
}
