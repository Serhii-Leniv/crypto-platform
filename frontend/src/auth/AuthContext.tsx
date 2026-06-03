import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout, refreshAccessToken } from '../api/auth';
import { tokenStore } from '../api/tokenStore';

interface AuthContextValue {
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Decode JWT payload (without verification — used only to read claims locally). */
function adminFromJwt(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Boolean(payload.isAdmin);
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    refreshAccessToken()
      .then(({ accessToken }) => {
        tokenStore.set(accessToken);
        setIsAuthenticated(true);
        setIsAdmin(adminFromJwt(accessToken));
      })
      .catch(() => {
        tokenStore.clear();
        setIsAuthenticated(false);
        setIsAdmin(false);
      })
      .finally(() => setInitialized(true));
  }, []);

  async function login(email: string, password: string) {
    const res = await apiLogin(email, password);
    tokenStore.set(res.accessToken);
    setIsAuthenticated(true);
    // Prefer server-reported flag; fall back to decoded JWT claim if server omitted it.
    setIsAdmin(res.isAdmin ?? adminFromJwt(res.accessToken));
  }

  async function register(email: string, password: string) {
    const res = await apiRegister(email, password);
    tokenStore.set(res.accessToken);
    setIsAuthenticated(true);
    setIsAdmin(res.isAdmin ?? adminFromJwt(res.accessToken));
  }

  function logout() {
    apiLogout();
    tokenStore.clear();
    setIsAuthenticated(false);
    setIsAdmin(false);
  }

  if (!initialized) return null;

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAdmin, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
