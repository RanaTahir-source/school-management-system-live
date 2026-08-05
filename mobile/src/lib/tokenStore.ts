import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'das.accessToken';
const REFRESH_KEY = 'das.refreshToken';
const USER_KEY = 'das.user';

export type StoredUser = {
  userId: string;
  fullName: string;
  email: string | null;
  loginId: string | null;
  roles: string[];
  schoolId: string | null;
  branchId: string | null;
};

// expo-secure-store is async (backed by iOS Keychain / Android Keystore), so
// we keep an in-memory mirror for the synchronous getAccess()/getRefresh()
// reads that api.ts needs on every request. load() must be awaited once at
// app startup (see AuthProvider) before anything else touches these values.
let accessToken: string | null = null;
let refreshToken: string | null = null;
let cachedUser: StoredUser | null = null;

export const tokenStore = {
  async load() {
    const [access, refresh, userJson] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    accessToken = access;
    refreshToken = refresh;
    cachedUser = userJson ? JSON.parse(userJson) : null;
    return { accessToken, refreshToken, user: cachedUser };
  },

  getAccess: () => accessToken,
  getRefresh: () => refreshToken,
  getUser: () => cachedUser,

  async setTokens(access: string, refresh: string) {
    accessToken = access;
    refreshToken = refresh;
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, access),
      SecureStore.setItemAsync(REFRESH_KEY, refresh),
    ]);
  },

  async setUser(user: StoredUser) {
    cachedUser = user;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  async clear() {
    accessToken = null;
    refreshToken = null;
    cachedUser = null;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },
};
