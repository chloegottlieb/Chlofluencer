import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onUnauthorized, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function applyAppearance(settings) {
  const root = document.documentElement;
  const theme = settings?.appearance?.theme ?? 'dark';
  const resolved =
    theme === 'system'
      ? window.matchMedia?.('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : theme;
  root.dataset.theme = resolved;
  root.classList.toggle('reduce-motion', !!settings?.appearance?.reduceMotion);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
    if (!tokenStore.get()) return;
    api('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  useEffect(() => applyAppearance(user?.settings), [user?.settings]);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(login, password) {
        const { token, user } = await api('/auth/login', { method: 'POST', body: { login, password } });
        tokenStore.set(token);
        setUser(user);
        return user;
      },
      async signup(fields) {
        const { token, user } = await api('/auth/signup', { method: 'POST', body: fields });
        tokenStore.set(token);
        setUser(user);
        return user;
      },
      logout,
      setUser,
      updateUser: (patch) => setUser((u) => ({ ...u, ...patch })),
      setToken: (token) => tokenStore.set(token),
    }),
    [user, loading, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
