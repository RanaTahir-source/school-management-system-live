export type StoredSchool = {
  name: string;
  code: string;
  logoUrl: string | null;
};

export type StoredUser = {
  userId: string;
  fullName: string;
  email: string;
  roles: string[];
  schoolId: string | null;
  branchId: string | null;
  school: StoredSchool | null;
};

const ACCESS_KEY = 'sms.accessToken';
const REFRESH_KEY = 'sms.refreshToken';
const USER_KEY = 'sms.user';

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  getUser: (): StoredUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (user: StoredUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
