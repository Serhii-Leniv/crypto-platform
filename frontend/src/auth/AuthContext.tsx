import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout, refreshAccessToken } from '../api/auth';
import { tokenStore } from '../api/tokenStore';

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Try to restore session via httpOnly cookie on mount
    refreshAccessToken()
      .then(({ accessToken }) => {
        tokenStore.set(accessToken);
        setIsAuthenticated(true);
      })
      .catch(() => {
        tokenStore.clear();
        setIsAuthenticated(false);
      })
      .finally(() => setInitialized(true));
  }, []);

  async function login(email: string, password: string) {
    const { accessToken } = await apiLogin(email, password);
    tokenStore.set(accessToken);
    setIsAuthenticated(true);
  }

  async function register(email: string, password: string) {
    const { accessToken } = await apiRegister(email, password);
    tokenStore.set(accessToken);
    setIsAuthenticated(true);
  }

  function logout() {
    apiLogout();
    tokenStore.clear();
    setIsAuthenticated(false);
  }

  if (!initialized) return null;

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
