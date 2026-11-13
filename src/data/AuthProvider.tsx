import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isCloudConfigured } from '../lib/config';
import { getSupabase } from '../lib/supabase';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  /** local = sem nuvem, dados só neste aparelho. */
  mode: 'local' | 'cloud';
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isCloudConfigured ? 'loading' : 'signedIn');

  useEffect(() => {
    if (!isCloudConfigured) return;
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
    });
    const { data } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      mode: isCloudConfigured ? 'cloud' : 'local',
      status,
      userId: isCloudConfigured ? (session?.user.id ?? null) : 'local',
      email: session?.user.email ?? null,
      async signIn(email, password) {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUp(email, password) {
        const { data, error } = await getSupabase().auth.signUp({ email, password });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },
      async resetPassword(email) {
        const { error } = await getSupabase().auth.resetPasswordForEmail(email);
        if (error) throw error;
      },
      async signOut() {
        if (isCloudConfigured) await getSupabase().auth.signOut();
      },
    }),
    [session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
