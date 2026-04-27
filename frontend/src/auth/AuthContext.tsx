import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/auth';
import { tokenStore } from '../api/tokenStore';

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('refreshToken');
  });

  useEffect(() => {
    // On mount, if we have a refresh token but no access token, the interceptor
    // will handle the first 401 automatically. We just track auth state here.
    const rt = localStorage.getItem('refreshToken');
    if (!rt) {
      tokenStore.clear();
      setIsAuthenticated(false);
    }
  }, []);

  async function login(email: string, password: string) {
    const { accessToken, refreshToken } = await apiLogin(email, password);
    tokenStore.set(accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setIsAuthenticated(true);
  }

  async function register(email: string, password: string) {
    const { accessToken, refreshToken } = await apiRegister(email, password);
    tokenStore.set(accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setIsAuthenticated(true);
  }

  function logout() {
    const rt = localStorage.getItem('refreshToken') ?? '';
    apiLogout(rt);
    tokenStore.clear();
    localStorage.removeItem('refreshToken');
    setIsAuthenticated(false);
  }

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
