import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { tokenStore } from './tokenStore';

// Set EXPO_PUBLIC_API_URL in mobile/.env (copy from .env.example). Expo only
// exposes env vars prefixed EXPO_PUBLIC_ to the JS bundle.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(body?.message || `Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        await tokenStore.setTokens(data.accessToken, data.refreshToken);
        return data.accessToken as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
};

function buildUrl(path: string, params?: RequestOptions['params']) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function coreRequest(path: string, options: RequestOptions = {}, isRetry = false): Promise<any> {
  const { method = 'GET', body, params, skipAuth } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const accessToken = tokenStore.getAccess();
  if (accessToken && !skipAuth) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipAuth && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return coreRequest(path, options, true);
    }
    await tokenStore.clear();
    throw new ApiError(401, { message: 'Session expired, please log in again' });
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }
  return data;
}

// Downloads a PDF (fee receipt / report card / attendance register) with the
// auth header attached, saves it into the app's cache dir, then opens the
// native share/preview sheet - the mobile equivalent of the web app's
// api.openBlob()/api.downloadBlob().
async function openOrSharePdf(path: string, filename: string): Promise<string> {
  const accessToken = tokenStore.getAccess();
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;

  const result = await FileSystem.downloadAsync(buildUrl(path), fileUri, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (result.status !== 200) {
    throw new ApiError(result.status, { message: 'Could not download the file' });
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }

  return result.uri;
}

export const api = {
  get: <T = any>(path: string, params?: RequestOptions['params']) =>
    coreRequest(path, { method: 'GET', params }) as Promise<T>,
  post: <T = any>(path: string, body?: unknown, options?: RequestOptions) =>
    coreRequest(path, { method: 'POST', body, ...options }) as Promise<T>,
  patch: <T = any>(path: string, body?: unknown) => coreRequest(path, { method: 'PATCH', body }) as Promise<T>,
  delete: <T = any>(path: string) => coreRequest(path, { method: 'DELETE' }) as Promise<T>,
  openOrSharePdf,
};
