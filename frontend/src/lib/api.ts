import { tokenStorage } from './storage';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
  const refreshToken = tokenStorage.getRefresh();
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
        tokenStorage.setTokens(data.accessToken, data.refreshToken);
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
  // BASE_URL may be relative (e.g. "/api" via the Vite proxy), so `new URL()`
  // needs an explicit base or it throws "Invalid URL" for relative inputs.
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
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

  const accessToken = tokenStorage.getAccess();
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
    tokenStorage.clear();
    window.dispatchEvent(new CustomEvent('sms:unauthorized'));
    throw new ApiError(401, { message: 'Session expired' });
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }
  return data;
}

// Posts a FormData body (file upload) with the auth header attached. Unlike
// coreRequest, this must NOT set Content-Type itself - the browser adds
// `multipart/form-data; boundary=...` automatically when it sees a FormData
// body, and setting it manually would drop the boundary and break parsing.
async function uploadForm(path: string, formData: FormData, isRetry = false): Promise<any> {
  const accessToken = tokenStorage.getAccess();
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  if (res.status === 401 && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) return uploadForm(path, formData, true);
    tokenStorage.clear();
    window.dispatchEvent(new CustomEvent('sms:unauthorized'));
    throw new ApiError(401, { message: 'Session expired' });
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Fetches a binary response (e.g. a generated PDF report) with the auth
// header attached, and opens it in a new tab as a Blob URL. Plain <a href>
// links can't carry the Authorization header, so downloads/print views that
// require auth go through this instead of api.get().
async function openBlobInNewTab(path: string) {
  const accessToken = tokenStorage.getAccess();
  const res = await fetch(buildUrl(path), {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Same auth-header problem as above, but forces a real file download (save-as)
// instead of opening a viewer tab - used for the "Download" action next to
// every report's "View" action. filename should include the extension.
async function downloadBlob(path: string, filename: string) {
  const accessToken = tokenStorage.getAccess();
  const res = await fetch(buildUrl(path), {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const api = {
  get: <T = any>(path: string, params?: RequestOptions['params']) =>
    coreRequest(path, { method: 'GET', params }) as Promise<T>,
  post: <T = any>(path: string, body?: unknown, options?: RequestOptions) =>
    coreRequest(path, { method: 'POST', body, ...options }) as Promise<T>,
  patch: <T = any>(path: string, body?: unknown) =>
    coreRequest(path, { method: 'PATCH', body }) as Promise<T>,
  put: <T = any>(path: string, body?: unknown) =>
    coreRequest(path, { method: 'PUT', body }) as Promise<T>,
  delete: <T = any>(path: string) => coreRequest(path, { method: 'DELETE' }) as Promise<T>,
  upload: <T = any>(path: string, formData: FormData) => uploadForm(path, formData) as Promise<T>,
  // Report actions: "View" opens the file inline in a new tab; "Download" forces
  // a save-as with a proper filename. Every report screen should offer both.
  openBlob: (path: string) => openBlobInNewTab(path),
  downloadBlob: (path: string, filename: string) => downloadBlob(path, filename),
};
