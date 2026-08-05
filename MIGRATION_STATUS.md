# School Management System — Render/Neon → Railway/Vercel Migration Status

Last updated: 2026-08-05 (session paused for restart, mid-task)

## Project
- Repo: `Das-Jandanwala/school-management-system` (GitHub)
- Local folder: `F:\My Claude Projects\School Software\school-management-system`
- Monorepo: `backend/` (NestJS + Prisma), `frontend/` (Vite + React), `desktop/` (Electron), `mobile/` (Expo/React Native)
- Real production system for Dar-e-Arqam school. Treat all data as live/real — no destructive actions without explicit confirmation.

## Goal
Move off Render (hosting) + Neon (Postgres) onto Railway (backend + DB) and the already-owned domain `nexoradsa.org` (DNS currently on Vercel nameservers), then update desktop/mobile apps to point at the new backend and have the user rebuild/redistribute them. Decommission Neon/Render only after everything is verified working.

## Where things stand right now

### ✅ Done and verified working
1. **Railway project** `school-management-system` (id `867250d1-4faa-437c-b33d-1b9844d329d1`, workspace "ranatahir-source's Projects", environment "production" id `13ebc81b-0804-4023-9e88-a4f0c5230eb9`).
2. **Database service** "database" (id `040cd681-7e98-4e16-bf12-4e759c6a6bca`) — clean Postgres, working credentials:
   `postgresql://postgres:Sms2026RailwayDbSecurePwd9x@altaria.proxy.rlwy.net:20882/railway`
   Prisma schema pushed successfully (`npx prisma db push`). All real production data migrated from Neon: **1327 rows across 59 tables**, zero data loss, via `migrate-neon-to-railway.js` (in repo root, already committed). Neon source was NOT modified — still exists as a safety backup.
3. **Backend service** "backend" (id `3250cf8c-5468-4061-8e15-4e3bf85b45b3`) — NestJS API, deployed successfully (latest good deployment `b275eea4-0bf0-4e71-998c-3cbe176d40dd`, commit `5a55dd8`). Env vars copied from old `.env` (JWT secrets, `VOICE_AGENT_INTEGRATION_KEY`) so existing sessions/integrations keep working. Railway-generated domain: `culj6i53.up.railway.app`.
4. **Two TypeScript build errors fixed and pushed** (commit `5a55dd8` on `main`):
   - `backend/src/modules/auth/auth.service.ts` line 243: was passing nullable `user.email` to `sendEmail`, changed to `dto.email`.
   - `backend/src/modules/finance/fee-payment.service.ts`: added a guard for optional `currentUser.userId` before using it in a composite key lookup.
5. **Domain DNS** — confirmed `nexoradsa.org` nameservers are Vercel's (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`), managed under Vercel team **"Tahir's Team"** (slug `tahir-s-team1`). Added and verified working:
   - `app` CNAME → `culj6i53.up.railway.app`
   - `_railway-verify.app` TXT → `railway-verify=de58b2762d751eab241c2e6af3430e3bb79de545778201c97a4f4f7d3f0b40a3`
   - Confirmed: `https://app.nexoradsa.org` correctly resolves to the Railway backend (returns the backend's own `{"message":"Cannot GET /","error":"Not Found"}` JSON — expected, since backend has no route at `/`).
   - Note: there are pre-existing, unrelated **stale** records on the apex domain (blank name) — TXT `_railway-verify` → `railway-verify=db1f1665...` and ALIAS → `1v5ilaa6.up.railway.app` — leftover from an earlier, different attempt. Left untouched, not currently causing problems. There's also a wildcard `*` ALIAS → `cname.vercel-dns-017.com` (pre-existing, unrelated to this migration).
   - Vercel dashboard showed "No projects on this team are using this domain" for `nexoradsa.org` — the NDSA marketing site must be on a different domain/project, not `nexoradsa.org` itself. Not investigated further.

### ⚠️ Critical gap discovered (unresolved)
The **backend is API-only** — confirmed via `backend/src/main.ts`: it only serves `/branding` static logo images, nothing else. It does NOT serve the built frontend HTML/JS.

But the **desktop app** (`desktop/main.js`) loads `APP_URL` directly as the Electron window's content, expecting the actual UI (login page, dashboard, etc.) — not raw API JSON. On the old Render setup, a separate service served the built frontend AND proxied `/api/*` to the backend (confirmed via `frontend/.env.example` comment and `frontend/src/lib/api.ts` which defaults `BASE_URL` to relative `/api`).

**The frontend (`frontend/` — Vite + React SPA) was never deployed to the new Railway/Vercel infrastructure.** This is the actual blocker right now — `app.nexoradsa.org` currently shows only backend JSON, not the real app.

### 🟡 Decision made, then re-opened by user
I proposed and the user initially approved (via AskUserQuestion):
- Deploy `frontend/` to **Vercel** as its own project, assign `app.nexoradsa.org` to it (Vercel-native domain assignment).
- Move the backend's custom domain from `app.nexoradsa.org` to **`api.nexoradsa.org`** (reuse Railway domain-verification flow, will get a new TXT code).
- `frontend/vercel.json` rewrites `/api/*` → `https://api.nexoradsa.org/*` so the frontend's existing relative `/api` calls keep working unchanged (mirrors the old Render proxy setup).

**I already created `frontend/vercel.json`** (NOT yet committed — need to check if it made it into a git commit) with:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://api.nexoradsa.org/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Then the user pushed back**, saying (Roman Urdu): domain isn't really "on Vercel", Vercel hosting is paid, the domain was purchased via Railway, and asked whether *both* frontend and backend can just run on Railway instead. I clarified (with direct evidence — I personally verified the DNS records in the Vercel dashboard) that the domain's DNS zone is genuinely on Vercel's nameservers regardless of where it was registered, and that yes, running both on Railway is also technically possible (deploy frontend as another Railway service, e.g. a static file server, with some proxy mechanism for `/api`).

**This decision is UNRESOLVED as of the restart.** Two options on the table:
- **A) Vercel frontend + `api.nexoradsa.org` Railway backend** (in progress, closer to done, mirrors old architecture, uses Vercel's native rewrites — clean).
- **B) Everything on Railway** — deploy frontend as a third Railway service (needs a static server + reverse proxy for `/api`, e.g. Caddy or a small Express server; more manual setup, no existing tooling for it yet).

**Next action on restart: ask the user to confirm which option (A or B) before proceeding further.**

### 🔧 Partial / interrupted work
- A background subagent was deploying `frontend/` to Vercel via the `deploy_to_vercel` MCP tool (packaging all ~55 frontend files by reading them directly with the Read tool, since `mcp__workspace__bash` was completely wedged/unresponsive in this session — 7 consecutive timeouts, gave up on it). The agent's first `deploy_to_vercel` call accidentally only included root config files (missing all of `src/`) — it identified this itself and was about to redeploy with the complete file set when the message got cut off (API stream error). A continuation message was sent but interrupted by the user before running.
  - **Likely state on Vercel right now:** a project named `school-management-system-frontend` may exist under team "Tahir's Team" with either a failed/broken first deployment, or nothing successful yet. **Check via `list_projects` (Vercel MCP) on restart before doing anything else.**
- Binary image files were deliberately **excluded** from the frontend deploy so far (`frontend/public/logo.png`, `images.jpg`, `images.png`) because base64-encoding them requires bash, which was wedged. `logo.png` IS referenced in code (`frontend/src/components/layout/Sidebar.tsx`, `PLATFORM_BRAND.logoUrl = '/logo.png'`) — cosmetic-only gap (broken image icon), not functionality-breaking. Need to add these separately later (retry bash, or upload manually via Vercel dashboard, or find another path).
- `frontend/vite.config.js` and `frontend/vite.config.d.ts` are **stale compiled duplicates** of `frontend/vite.config.ts` sitting in the repo by accident (someone ran `tsc` in the wrong place once). Only `vite.config.ts` is the real source — do not upload/deploy the `.js`/`.d.ts` versions, they'd create ambiguity about which config Vite picks up. Should probably be deleted from the repo at some point (cleanup, not urgent).

### 📝 File edits made locally, NOT YET committed/pushed by user
Check git status on restart — these were edited via the Edit/Write tools in this session but I have no evidence the user has run `git add/commit/push` since:
- `desktop/main.js`: `APP_URL` changed from `https://dar-e-arqam-sms.onrender.com` → `https://app.nexoradsa.org`
- `mobile/eas.json`: `EXPO_PUBLIC_API_URL` changed (all 3 build profiles) from the old Render URL → `https://app.nexoradsa.org/api`
- `mobile/.env.example`: same URL update + comment cleanup
- `frontend/vercel.json`: newly created (see above)

These URLs (`app.nexoradsa.org` for desktop, `app.nexoradsa.org/api` for mobile) are **correct for Option A** (Vercel frontend with rewrite proxy) since both would hit the same host Vercel serves. If Option B is chosen instead (frontend also on Railway), these values might still be correct depending on how the Railway static+proxy setup is built — revisit if B is chosen.

## Explicitly NOT done yet (deliberately deferred)
- Frontend not live anywhere yet (see above — the actual current blocker).
- Desktop app not rebuilt (`npm run dist` — must be run by the user, sandbox can't build Windows installers).
- Mobile app not rebuilt (`eas build -p android --profile preview` — must be run by the user).
- Rebuilt apps not uploaded to the NDSA store admin panel.
- NDSA marketing site's downloads section still shows old "Dar-e-Arqam School Management System" branding/filename — not updated.
- **Neon DB, Render hosting, and the old broken Railway "postgres" service (id `8360ea25-f5e0-4f3c-ad5c-df599889954a`) are all still live and NOT deleted** — deliberately kept as safety net until the new system is fully verified end-to-end. User has explicitly asked for these to be removed eventually ("neon or render sy bhi hata do") — do this LAST, only after frontend is live and login/core flows are verified working.
- Director account's default seeded password — remind user to change it once live.

## Useful reference values
- Old Neon DB (untouched, still usable as backup/rollback): `postgresql://neondb_owner:npg_Gqbuyo7k0sDM@ep-plain-flower-azwc37xh.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30&connection_limit=20&pool_timeout=30`
- New Railway DB: `postgresql://postgres:Sms2026RailwayDbSecurePwd9x@altaria.proxy.rlwy.net:20882/railway`
- Railway backend generated domain: `culj6i53.up.railway.app`
- Vercel team: "Tahir's Team", slug `tahir-s-team1`
- Old Render URL (still live, not yet decommissioned): `https://dar-e-arqam-sms.onrender.com`

## Immediate next steps on resume
1. Re-confirm with user: Option A (Vercel frontend, recommended) or Option B (everything on Railway)?
2. Test if `mcp__workspace__bash` has recovered (it was fully wedged all session).
3. Check Vercel `list_projects` for any partial `school-management-system-frontend` project state from the interrupted deploy.
4. Proceed with whichever option is confirmed, get the frontend actually live and serving the login page at `app.nexoradsa.org`.
5. If Option A: move backend custom domain from `app.nexoradsa.org` to `api.nexoradsa.org` on Railway, get new TXT verify record, add DNS records, point `app.nexoradsa.org` at the Vercel frontend project instead.
6. Verify login flow works end-to-end against real data.
7. Confirm git status / push any uncommitted local edits (desktop/main.js, mobile/eas.json, mobile/.env.example, frontend/vercel.json).
8. Then proceed to desktop/mobile rebuilds, NDSA store upload, marketing site update, and finally old infra decommissioning.
