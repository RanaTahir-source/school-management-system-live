import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from './api';
import { tokenStore, StoredUser } from './tokenStore';

type LoginResponse = {
  user: {
    id: string;
    fullName: string;
    email: string | null;
    loginId: string | null;
    schoolId: string | null;
    branchId: string | null;
    userRoles: { role: { name: string } }[];
  };
  accessToken: string;
  refreshToken: string;
};

type AuthContextValue = {
  user: StoredUser | null;
  isLoading: boolean;
  isBooting: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toStoredUser(data: LoginResponse['user']): StoredUser {
  return {
    userId: data.id,
    fullName: data.fullName,
    email: data.email,
    loginId: data.loginId,
    roles: data.userRoles.map((ur) => ur.role.name),
    schoolId: data.schoolId,
    branchId: data.branchId,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBooting, setIsBooting] = useState(true);

  // On cold start, restore whatever we last stored in SecureStore. We don't
  // round-trip to the server here - the first real API call will 401 and
  // trigger the refresh/clear flow in api.ts if the token turned out stale.
  useEffect(() => {
    (async () => {
      const { user: storedUser } = await tokenStore.load();
      setUser(storedUser);
      setIsBooting(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await api.post<LoginResponse>('/auth/login', { email, password }, { skipAuth: true });
      await tokenStore.setTokens(data.accessToken, data.refreshToken);
      const stored = toStoredUser(data.user);
      await tokenStore.setUser(stored);
      setUser(stored);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, { message: 'Could not reach the server. Check your internet connection.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefresh();
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    await tokenStore.clear();
    setUser(null);
  }, []);

  const hasRole = useCallback((...roles: string[]) => !!user && roles.some((r) => user.roles.includes(r)), [user]);

  const value = useMemo(
    () => ({ user, isLoading, isBooting, isAuthenticated: !!user, login, logout, hasRole }),
    [user, isLoading, isBooting, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
