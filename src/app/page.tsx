'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { KanbanBoard } from '../components/KanbanBoard';
import { useKanbanStore } from '../store/useKanbanStore';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { fetchBoard, fetchProfiles } = useKanbanStore();

  useEffect(() => {
    async function checkAuthAndLoad() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          // Check if running in a client environment where guest demo access is allowed or redirect
          // In Next.js: window.location.href = '/login'
          const allowGuest =
            typeof window !== 'undefined' &&
            window.sessionStorage.getItem('guest_mode') === 'true';

          if (!allowGuest) {
            // Redirect unauthenticated users
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.href = '/login';
              return;
            }
          }
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
          setUserEmail(session.user.email || null);
        }

        // Fetch real data from Supabase
        await fetchBoard('default-board-id');
        await fetchProfiles();
      } catch (err) {
        console.error('Failed to initialize dashboard data:', err);
        setIsAuthenticated(false);
      }
    }

    checkAuthAndLoad();

    // Listen to Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsAuthenticated(true);
        setUserEmail(session.user.email || null);
        fetchBoard('default-board-id');
        fetchProfiles();
      } else {
        setIsAuthenticated(false);
        setUserEmail(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchBoard, fetchProfiles]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('guest_mode');
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Loading indicator while resolving session
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-zinc-500 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-900" />
        <span className="text-xs font-medium text-zinc-600">Verifying session...</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <KanbanBoard onSignOut={handleSignOut} userEmail={userEmail} />
    </div>
  );
}
