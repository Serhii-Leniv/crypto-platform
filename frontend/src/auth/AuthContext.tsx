import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/auth';
import { tokenStore } from '../api/tokenStore';
import type { UserRole } from '../types';

interface AuthContextValue {
  isAuthenticated: boolean;
  isAdmin: boolean;
  userRole: UserRole | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseRoleFromToken(token: string): UserRole {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.role as UserRole) ?? 'USER';
  } catch {
    return 'USER';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('refreshToken');
  });
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const rt = localStorage.getItem('refreshToken');
    if (!rt) {
      tokenStore.clear();
      setIsAuthenticated(false);
      setUserRole(null);
    }
  }, []);

  async function login(email: string, password: string) {
    const { accessToken, refreshToken } = await apiLogin(email, password);
    tokenStore.set(accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUserRole(parseRoleFromToken(accessToken));
    setIsAuthenticated(true);
  }

  async function register(email: string, password: string) {
    const { accessToken, refreshToken } = await apiRegister(email, password);
    tokenStore.set(accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUserRole(parseRoleFromToken(accessToken));
    setIsAuthenticated(true);
  }

  function logout() {
    const rt = localStorage.getItem('refreshToken') ?? '';
    apiLogout(rt);
    tokenStore.clear();
    localStorage.removeItem('refreshToken');
    setIsAuthenticated(false);
    setUserRole(null);
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isAdmin: userRole === 'ADMIN',
      userRole,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
