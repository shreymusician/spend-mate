import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, authPost, logoutRequest, refreshSession, setAccessToken, setSessionLostHandler, takeRestoredDevice } from '@/lib/api';
import { forgetSeen, markSeen, shouldGreetOnOpen } from '@/lib/greeting';
import type { Device, SessionResponse, User } from '@/types';

/** Which greeting to play: a brand-new account, or someone coming back (signing in, or reopening a remembered device). */
export type Greeting = 'welcome' | 'back' | null;

interface AuthState {
  user: User | null;
  /** This device as the server detected it, and whether it is remembered. */
  device: Device | null;
  loading: boolean;
  greeting: Greeting;
  dismissGreeting: () => void;
  login: (mobile: string, pin: string, remember: boolean) => Promise<void>;
  register: (input: { name: string; gender: string; dob: string; mobile: string; pin: string; theme?: 'light' | 'dark' }) => Promise<void>;
  logout: () => Promise<void>;
  updatePrefs: (prefs: Partial<User['prefs']>) => Promise<void>;
  /** Pass a small JPEG data URL, or null to remove the photo. */
  setAvatar: (image: string | null) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [greeting, setGreeting] = useState<Greeting>(null);
  const [loading, setLoading] = useState(true);

  const start = useCallback((s: SessionResponse, g: Greeting) => {
    setAccessToken(s.accessToken);
    setUser(s.user);
    setDevice(s.device);
    setGreeting(g);
    markSeen(s.user.id);
  }, []);

  // Reopening the app on a remembered device: restore the session and go straight to the greeting.
  useEffect(() => {
    setSessionLostHandler(() => { setAccessToken(null); setUser(null); setGreeting(null); });
    (async () => {
      if (await refreshSession()) {
        try {
          const me = (await api<{ user: User }>('/users/me')).user;
          setUser(me);
          setDevice(takeRestoredDevice());
          // Only greet if they have been away a while; a quick refresh just carries on.
          if (shouldGreetOnOpen(me.id)) setGreeting('back');
          markSeen(me.id);
        } catch { /* signed out */ }
      }
      setLoading(false);
    })();
  }, []);

  // Keep "last seen" fresh while the app is in use, so a refresh a moment later is not treated as reopening.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const touch = () => markSeen(userId);
    const onHide = () => { if (document.visibilityState === 'hidden') touch(); };
    const id = setInterval(() => document.visibilityState === 'visible' && touch(), 30_000);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', touch);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', touch); };
  }, [userId]);

  const value = useMemo<AuthState>(() => ({
    user,
    device,
    loading,
    greeting,
    dismissGreeting: () => setGreeting(null),
    login: async (mobile, pin, remember) => start(await authPost<SessionResponse>('/login', { mobile, pin, remember }), 'back'),
    register: async (input) => start(await authPost<SessionResponse>('/register', { ...input, remember: true }), 'welcome'),
    logout: async () => { await logoutRequest().catch(() => {}); forgetSeen(); setAccessToken(null); setUser(null); setDevice(null); setGreeting(null); },
    updatePrefs: async (prefs) => {
      const r = await api<{ user: User }>('/users/me/prefs', { method: 'PATCH', json: prefs });
      setUser(r.user);
    },
    setAvatar: async (image) => {
      const r = image
        ? await api<{ user: User }>('/users/me/avatar', { method: 'PUT', json: { image } })
        : await api<{ user: User }>('/users/me/avatar', { method: 'DELETE' });
      setUser(r.user);
    },
  }), [user, device, loading, greeting, start]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
