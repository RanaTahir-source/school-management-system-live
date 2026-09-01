import { io, Socket } from 'socket.io-client';
import { tokenStorage } from './storage';

// Derives the bare backend origin from VITE_API_URL (which points at
// ".../api") since socket.io needs a raw origin + namespace, not a REST path
// prefix. Falls back to localhost:3000 for local dev when VITE_API_URL isn't
// set (matches the backend's default PORT).
function resolveSocketBase(): string {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!apiUrl) return 'http://localhost:3000';
  return apiUrl.replace(/\/api\/?$/, '');
}

let socket: Socket | null = null;

// Single shared socket for the whole app - call this wherever a component
// needs live chat events; it lazily connects once and reuses the connection.
export function getChatSocket(): Socket {
  if (socket) return socket;
  const token = tokenStorage.getAccess();
  socket = io(`${resolveSocketBase()}/chat`, {
    auth: { token },
    transports: ['websocket'],
  });
  return socket;
}

// Call after logout, or after a token refresh if you want the new token
// picked up on the next connection (the current v1 doesn't hot-swap the
// auth token on an already-open socket).
export function disconnectChatSocket() {
  socket?.disconnect();
  socket = null;
}
