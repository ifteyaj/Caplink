import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from './types';

interface ActionResult {
  success: boolean;
  error?: string;
}

interface RequestCodeResult extends ActionResult {
  /** Development only: the API returns the code for local testing. */
  devCode?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Step 1 — request a one-time verification code for a university email. */
  requestCode: (email: string, name?: string) => Promise<RequestCodeResult>;
  /** Step 2 — verify the code; on success the session cookie is set. */
  verifyCode: (email: string, code: string) => Promise<ActionResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setUser(data.user ?? null);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const requestCode = async (email: string, name?: string): Promise<RequestCodeResult> => {
    try {
      // The API rejects a too-short name; only send one that can be accepted.
      const body: Record<string, string> = { email };
      if (name && name.trim().length >= 2) body.name = name.trim();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, devCode: data.dev_code };
      }
      return { success: false, error: data.error || 'Could not send a verification code.' };
    } catch (err) {
      return { success: false, error: 'Connection error' };
    }
  };

  const verifyCode = async (email: string, code: string): Promise<ActionResult> => {
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || 'Verification failed.' };
    } catch (err) {
      return { success: false, error: 'Connection error' };
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, requestCode, verifyCode, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
