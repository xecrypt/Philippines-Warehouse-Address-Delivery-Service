'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { UserProfile, LoginRequest, RegisterRequest } from '@warehouse/shared';
import { Role } from '@warehouse/shared';
import * as authApi from '../api/auth';
import { setTokens, clearTokens, hasTokens } from './tokens';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!hasTokens()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await authApi.getProfile();
      // API returns data directly, not wrapped in {success, data}
      if (response && (response as any).id) {
        setUser(response as unknown as UserProfile);
      } else if ((response as any).success && (response as any).data) {
        setUser((response as any).data);
      } else {
        clearTokens();
        setUser(null);
      }
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = async (data: LoginRequest) => {
    const response = await authApi.login(data);
    // API returns {user, tokens} directly, not wrapped in {success, data}
    const authData = (response as any).tokens ? response : (response as any).data;
    if (authData && authData.tokens) {
      setTokens(authData.tokens.accessToken, authData.tokens.refreshToken);
      await fetchProfile();
    } else {
      throw new Error((response as any).message || 'Login failed');
    }
  };

  const register = async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    // API returns {user, tokens} directly, not wrapped in {success, data}
    const authData = (response as any).tokens ? response : (response as any).data;
    if (authData && authData.tokens) {
      setTokens(authData.tokens.accessToken, authData.tokens.refreshToken);
      await fetchProfile();
    } else {
      throw new Error((response as any).message || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
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

export function useRequireAuth(allowedRoles?: Role[]) {
  const { user, isAuthenticated, isLoading } = useAuth();

  const hasAccess =
    isAuthenticated &&
    (!allowedRoles || (user && allowedRoles.includes(user.role)));

  return {
    user,
    isAuthenticated,
    isLoading,
    hasAccess,
  };
}
