import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from './api';
import { tokenStorage, StoredUser } from './storage';

type LoginResponse = {
  user: {
    id: string;
    fullName: string;
    email: string;
    schoolId: string | null;
    branchId: string | null;
    userRoles: { role: { name: string } }[];
    school: { name: string; code: string; isActive: boolean; settings: { logoUrl: string | null } | null } | null;
  };
  accessToken: string;
  refreshToken: string;
};

type AuthContextValue = {
  user: StoredUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toStoredUser(data: LoginResponse['user']): StoredUser {
  return {
    userId: data.id,
    fullName: data.fullName,
    email: data.email,
    roles: data.userRoles.map((ur) => ur.role.name),
    schoolId: data.schoolId,
    branchId: data.branchId,
    school: data.school
      ? { name: data.school.name, code: data.school.code, logoUrl: data.school.settings?.logoUrl ?? null }
      : null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(() => tokenStorage.getUser());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('sms:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('sms:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await api.post<LoginResponse>('/auth/login', { email, password }, { skipAuth: true });
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      const stored = toStoredUser(data.user);
      tokenStorage.setUser(stored);
      setUser(stored);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, { message: 'Could not reach the server. Is the backend running?' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    const refreshToken = tokenStorage.getRefresh();
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    tokenStorage.clear();
    setUser(null);
  }, []);

  const hasRole = useCallback((...roles: string[]) => !!user && roles.some((r) => user.roles.includes(r)), [user]);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: !!user, login, logout, hasRole }),
    [user, isLoading, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
