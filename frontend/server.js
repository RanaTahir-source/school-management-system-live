// Production static file server for the built frontend (dist/), with a
// reverse proxy for /api/* to the backend NestJS service.
//
// Runs only on Railway (or any host) after `npm run build`. In local dev,
// Vite's own dev server + proxy (see vite.config.ts) is used instead.
//
// BACKEND_URL should point at the backend service's Railway *private*
// network address (e.g. http://backend.railway.internal:3000) so traffic
// between the two services never leaves Railway's internal network -
// faster and doesn't require the backend to have a public domain at all.
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend.railway.internal:3000';

app.use(
  '/api',
  createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    // The backend mounts its routes at root (e.g. /auth/login), matching
    // the same rewrite the Vite dev proxy does - see vite.config.ts.
    pathRewrite: { '^/api': '' },
  }),
);

const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

// SPA fallback: any non-API, non-static route serves index.html so
// react-router-dom's client-side routing works on hard refresh / deep links.
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend serving on port ${PORT}, proxying /api -> ${BACKEND_URL}`);
});
