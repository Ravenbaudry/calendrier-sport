import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { get, post, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  // « loading » tant qu'on vérifie un jeton existant au démarrage
  const [status, setStatus] = useState(() => (tokenStore.get() ? 'loading' : 'anonymous'));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    get('/auth/me')
      .then(({ user: me }) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) logout();
      });
    return () => {
      cancelled = true;
    };
  }, [logout]);

  // Déclenché par le client HTTP quand l'API répond 401
  useEffect(() => {
    window.addEventListener('auth:logout', logout);
    return () => window.removeEventListener('auth:logout', logout);
  }, [logout]);

  const applySession = useCallback(
    ({ token, user: sessionUser }) => {
      tokenStore.set(token);
      queryClient.clear();
      setUser(sessionUser);
      setStatus('authenticated');
    },
    [queryClient],
  );

  const login = useCallback(
    async (username, password) => applySession(await post('/auth/login', { username, password })),
    [applySession],
  );

  const register = useCallback(
    async (username, password, inviteCode) =>
      applySession(await post('/auth/register', { username, password, inviteCode })),
    [applySession],
  );

  const value = useMemo(
    () => ({ user, status, login, register, logout, applySession, setUser }),
    [user, status, login, register, logout, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
