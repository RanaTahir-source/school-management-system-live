# School Management System — Render/Neon → Railway/Vercel Migration Status

Last updated: 2026-08-06 (frontend deployed to Vercel, DNS repointed, propagation in progress)

## Project
- **New repo (this is the one that's live/connected everywhere now):** `RanaTahir-source/school-management-system-live` (GitHub)
- Old repo `Das-Jandanwala/school-management-system` still exists but is NOT used for deployment anymore — it was abandoned because Vercel's GitHub App was only ever connected to the `RanaTahir-source` account, and cross-account linking kept failing. Safe to ignore/delete later.
- Local folder: `F:\My Claude Projects\School Software\school-management-system` — its `origin` remote now points to `https://github.com/RanaTahir-source/school-management-system-live.git`.
- Monorepo: `backend/` (NestJS + Prisma), `frontend/` (Vite + React), `desktop/` (Electron), `mobile/` (Expo/React Native)
- Real production system for Dar-e-Arqam school. Treat all data as live/real — no destructive actions without explicit confirmation.

## Current live architecture
- **Backend**: Railway service "backend" (project `867250d1-4faa-437c-b33d-1b9844d329d1`, service `3250cf8c-5468-4061-8e15-4e3bf85b45b3`, env `production` = `13ebc81b-0804-4023-9e88-a4f0c5230eb9`). Custom domain **`api.nexoradsa.org`** → CNAME → `f4y8w30k.up.railway.app`.
- **Database**: Railway Postgres "database" (`040cd681-7e98-4e16-bf12-4e759c6a6bca`). `postgresql://postgres:Sms2026RailwayDbSecurePwd9x@altaria.proxy.rlwy.net:20882/railway`. All 1327 rows / 59 tables migrated from Neon, verified.
- **Frontend**: Vercel project `school-management-system-live` (team "Tahir's Team", slug `tahir-s-team1`), imported from `RanaTahir-source/school-management-system-live` GitHub repo, branch `main`.
  - Root Directory picker in Vercel's UI was broken/unusable (folder-tree modal only ever showed a single "(root)" entry, no subfolder browsing, and the Root Directory text input reverts any typed value because it's purely a display mirror of modal-selected state). **Workaround**: left Root Directory at repo root (`./`) and instead used the "Override" toggles on Install/Build/Output Directory commands:
    - Install Command: `cd frontend && npm install`
    - Build Command: `cd frontend && npm run build`
    - Output Directory: `frontend/dist`
  - Repo-root `vercel.json` (NOT `frontend/vercel.json`, which is now a dead/unused file since Root Directory ≠ frontend) has the rewrites:
    ```json
    {
      "rewrites": [
        { "source": "/api/:path*", "destination": "https://api.nexoradsa.org/:path*" },
        { "source": "/(.*)", "destination": "/index.html" }
      ]
    }
    ```
  - Deployment succeeded, status "Ready". Direct deployment URL: `school-management-system-live-1vfea30lt-tahir-s-team1.vercel.app` — confirmed serving the actual login page correctly.
  - Custom domain **`app.nexoradsa.org`** added to this Vercel project. DNS CNAME updated from the old Railway target to `cname.vercel-dns.com` — confirmed correct via public DNS (Cloudflare DoH lookup), but as of last check the browser/sandbox environment was still resolving to the old Railway backend (stale cache) — **needs a few more minutes to fully propagate, then re-verify `https://app.nexoradsa.org` loads the login page (not backend JSON)**.
- **DNS**: all managed on Vercel nameservers (`ns1/ns2.vercel-dns.com`) for team "Tahir's Team", domain `nexoradsa.org`. Current records:
  - `api` CNAME → `f4y8w30k.up.railway.app.`
  - `app` CNAME → `cname.vercel-dns.com.` (points at the Vercel frontend project now)
  - Stale/unrelated leftovers on apex (blank name): TXT `_railway-verify`, ALIAS → `1v5ilaa6.up.railway.app`, wildcard `*` ALIAS → `cname.vercel-dns-017.com`. Not causing problems, not cleaned up.
  - `_railway-verify.app` TXT — leftover from when `app.nexoradsa.org` verified against the backend; harmless now, can be deleted later.

### 🧹 Cleanup still needed (low priority, non-blocking)
- Railway backend service still has `app.nexoradsa.org` registered as a **custom domain** (id `c5ac32e6-800c-4ca8-956c-861b557ea8be`) even though DNS no longer points there. Harmless (will just show unverified) but should be removed from Railway eventually for cleanliness.
- Delete the now-dead `frontend/vercel.json` (superseded by root `vercel.json`) and the leftover `frontend/server.js` + its `express`/`http-proxy-middleware` deps in `frontend/package.json` (added for an abandoned Railway-only frontend attempt, unused now).
- Old repo `Das-Jandanwala/school-management-system` can be deleted once everyone's confirmed the new repo is the sole source of truth.
- `_railway-verify.app` TXT record on Vercel DNS can be removed.

## Explicitly NOT done yet
1. **Verify `app.nexoradsa.org` fully propagated and serves the real login page** (last check still showed stale Railway response — re-check first thing next session).
2. **Verify login flow end-to-end** against real production data once (1) is confirmed — this is the actual functional test that matters.
3. Desktop app (`desktop/main.js` already points to `https://app.nexoradsa.org` — correct for this architecture) — needs `npm run dist` rebuild by the user.
4. Mobile app (`mobile/eas.json` / `.env.example` already point to `https://app.nexoradsa.org/api`) — needs `eas build` rebuild by the user.
5. Rebuilt apps not uploaded to the NDSA store admin panel.
6. NDSA marketing site's downloads section still shows old branding — not updated.
7. **Neon DB, Render hosting, and the old broken Railway "postgres" service (id `8360ea25-f5e0-4f3c-ad5c-df599889954a`) are all still live and NOT deleted** — deliberately kept as safety net. Do this LAST, only after everything above is verified.
8. Director account's default seeded password — remind user to change it once live.
9. Cleanup items listed above.

## Useful reference values
- Old Neon DB (untouched, still usable as backup/rollback): `postgresql://neondb_owner:npg_Gqbuyo7k0sDM@ep-plain-flower-azwc37xh.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30&connection_limit=20&pool_timeout=30`
- New Railway DB: `postgresql://postgres:Sms2026RailwayDbSecurePwd9x@altaria.proxy.rlwy.net:20882/railway`
- Railway backend generated domain: `culj6i53.up.railway.app` (old, was on `app.nexoradsa.org`) — new one is `f4y8w30k.up.railway.app` (on `api.nexoradsa.org`)
- Vercel team: "Tahir's Team", slug `tahir-s-team1`
- Vercel frontend project: `school-management-system-live`, direct URL `school-management-system-live-1vfea30lt-tahir-s-team1.vercel.app`
- GitHub repo (live/deployed): `RanaTahir-source/school-management-system-live`
- Old Render URL (still live, not yet decommissioned): `https://dar-e-arqam-sms.onrender.com`

## Immediate next steps on resume
1. Re-check `https://app.nexoradsa.org` — should now show the login page, not backend JSON. If still showing backend JSON after 10+ minutes, double check the Vercel DNS record for `app` is still `cname.vercel-dns.com` and that the Vercel project's domain shows "Valid Configuration".
2. Do a real login test against production data (need a valid user's email/password — ask the user, don't guess/brute force).
3. Test a few core flows (attendance, fee collection view, etc.) to confirm `/api` rewrite proxy is working correctly end-to-end, not just the login page rendering.
4. Guide user through desktop rebuild (`npm run dist`) and mobile rebuild (`eas build -p android --profile preview`).
5. Upload rebuilt apps to NDSA store admin panel, update NDSA marketing site branding.
6. Do the cleanup items listed above.
7. Only after ALL of the above is verified working: decommission Neon, Render, and the old broken Railway "postgres" service.
