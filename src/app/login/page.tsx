'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Kanban, Loader2, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  onSuccess?: () => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if session already active
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (onSuccess) {
          onSuccess();
        } else if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    }
    checkSession();
  }, [onSuccess]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isSignUp) {
        // Sign Up flow
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        // If auto-confirmed or profiles hook runs:
        if (data.user) {
          // Attempt profile upsert
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email: data.user.email || email,
              full_name: fullName || null,
              created_at: new Date().toISOString(),
            });
          } catch (e) {
            console.log('Profile insert handled by DB trigger or manual hook:', e);
          }
        }

        if (data.session) {
          if (onSuccess) {
            onSuccess();
          } else if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        } else {
          setSuccessMessage('Registration successful! Please check your email for confirmation, or log in.');
          setIsSignUp(false);
        }
      } else {
        // Sign In with password flow
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          if (onSuccess) {
            onSuccess();
          } else if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = () => {
    if (onSuccess) {
      onSuccess();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <div className="relative min-h-full w-full flex flex-col items-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-4 py-4 sm:py-8 lg:px-8 overflow-y-auto transition-colors">
      {/* Top Right Dark Mode Toggle */}
      <div className="absolute top-3 right-3 sm:top-5 sm:right-5 z-20">
        <ThemeToggle showLabel={true} size="sm" />
      </div>

      <div className="w-full max-w-md space-y-3 sm:space-y-4 my-auto pb-6 sm:pb-8">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 shadow-sm mb-2 sm:mb-2.5">
            <Kanban className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Kanban Task Manager
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 sm:mt-1">
            Zero-Cost SME Task Management with Optimistic Sync
          </p>
        </div>

        <Card className="border-zinc-200/80 dark:border-zinc-800 shadow-md">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3 space-y-1">
            <CardTitle className="text-base sm:text-lg font-semibold">
              {isSignUp ? 'Create your account' : 'Sign in to your workspace'}
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">
              {isSignUp
                ? 'Enter your company email to setup your profile'
                : 'Enter your credentials to access your boards'}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 pt-0 space-y-3 sm:space-y-3.5">
            {errorMessage && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-700">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-2.5 sm:space-y-3">
              {isSignUp && (
                <div className="space-y-1">
                  <Label htmlFor="fullname" className="text-xs font-medium">Full Name</Label>
                  <Input
                    id="fullname"
                    type="text"
                    placeholder="e.g. Sarah Jenkins"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={isSignUp}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-9 sm:h-10 text-sm"
                  />
                  <Mail className="absolute right-3 top-2.5 sm:top-3 h-4 w-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    className="h-9 sm:h-10 text-sm"
                  />
                  <Lock className="absolute right-3 top-2.5 sm:top-3 h-4 w-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full h-9 sm:h-10 text-sm font-medium mt-1">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {isSignUp ? 'Create Account' : 'Sign In'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="relative flex py-1.5 sm:py-2 items-center">
              <div className="flex-grow border-t border-zinc-200"></div>
              <span className="flex-shrink mx-3 text-xs text-zinc-400 uppercase tracking-wider text-[10px]">or</span>
              <div className="flex-grow border-t border-zinc-200"></div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleDemoAccess}
              className="w-full h-9 sm:h-10 text-xs sm:text-sm font-medium text-zinc-800 hover:text-zinc-950 hover:bg-zinc-100/90 border-zinc-300 shadow-2xs"
            >
              <ShieldCheck className="h-4 w-4 mr-2 text-zinc-600 shrink-0" />
              <span>Explore as Guest</span>
              <span className="text-zinc-400 text-xs font-normal ml-1">(No login required)</span>
            </Button>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-zinc-100 dark:border-zinc-800 py-2.5 sm:py-3 px-4 sm:px-6 text-xs text-zinc-500 dark:text-zinc-400">
            {isSignUp ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setErrorMessage(null);
                  }}
                  className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </span>
            ) : (
              <span>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setErrorMessage(null);
                  }}
                  className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline cursor-pointer"
                >
                  Create one
                </button>
              </span>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
