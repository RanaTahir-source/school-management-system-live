# School Management System — Project Memory

Last updated: 2026-08-26 (Milestones 10c AND 10d - AI fallback call-answering + AI meeting notetaker - code-complete this session, on top of 2-9/10a/10b from before; nothing deployed yet - see "What to do first in a new session" below)

This file exists so a future Claude/Cowork session can pick up this project without
re-discovering everything from scratch. If you're starting a new conversation about
this system, read this file first (attach/reference it, or point Claude to
`F:\My Claude Projects\School Software\school-management-system\CLAUDE_PROJECT_MEMORY.md`).

## What this project is

A custom-built School Management System (NestJS + Prisma/Postgres backend, React +
Vite + Tailwind + shadcn/ui frontend) for **Dar-e-Arqam School**, run by the user
(Rana Tahir, jandanwala@das.edu.pk). Replaces an old Visual FoxPro desktop system.
Live at:
- Frontend: https://app.nexoradsa.org
- Backend API: https://api.nexoradsa.org

Ignore any reference to `dar-e-arqam-sms.onrender.com` from old sessions — that Render
deployment is stale/dead (returns "Not Found"). The real, current, live system is on
Railway (backend) + Vercel (frontend) at the nexoradsa.org URLs above. Also note
`nexoradsa.org` (no subdomain) is an UNRELATED site (a "Nexora Digital Services
Agency" marketing site, different project) — don't confuse it with `app.` / `api.`
subdomains, which ARE this project.

## Infrastructure

- **GitHub repo (source of truth, deploys from here):** `RanaTahir-source/school-management-system-live`
  — confirmed this is ALSO the user's own account (a second GitHub account, different
  login from `Das-Jandanwala`). Push access needs login as `RanaTahir-source` (or a
  short-lived PAT generated from that account — ask the user to generate one at
  github.com/settings/tokens/new with `repo` scope if push access is needed again;
  don't persist tokens to disk).
- There is also a `Das-Jandanwala/school-management-system` repo (an earlier import,
  the user's other GitHub account has full write access to it) — NOT currently
  connected to Railway/Vercel. Only use this if `RanaTahir-source` access is ever
  unavailable again.
- **Backend hosting:** Railway. Project `school-management-system`
  (id `867250d1-4faa-437c-b33d-1b9844d329d1`), service `backend`
  (id `3250cf8c-5468-4061-8e15-4e3bf85b45b3`), environment `production`
  (id `13ebc81b-0804-4023-9e88-a4f0c5230eb9`). Root directory `backend`. Auto-deploys
  on push to `main`. Custom domain `api.nexoradsa.org`. Also has `postgres` and
  `database` services in the same project.
- **Frontend hosting:** Vercel (root `vercel.json` + `frontend/vercel.json` in repo),
  auto-deploys on push to `main`. Custom domain `app.nexoradsa.org`.
- Repo layout: `backend/` (NestJS+Prisma), `frontend/` (React/Vite), `mobile/`
  (React Native, in progress — see mobile app notes below), `desktop/` (not worked on yet).
- Local repo lives at `F:\My Claude Projects\School Software\school-management-system`
  (mounted folder). `backend/.env` here has real production `DATABASE_URL` /
  `DIRECT_URL` (Railway Postgres, public proxy `altaria.proxy.rlwy.net:20882`) and JWT
  secrets — this is a live production credentials file sitting in the repo folder,
  treat carefully.

## Data model / architecture highlights (backend/prisma/schema.prisma)

- **CHAIRMAN** role = platform-wide, cross-tenant (sees every School). Only role in
  `UNRESTRICTED_ROLES` (see `common/utils/school-scope.ts`).
- **DIRECTOR** role = scoped to exactly one School (which can have multiple Branches).
  The user's own account (`director@daralarqam.local`) holds both CHAIRMAN + DIRECTOR
  (grandfathered).
- `School` → has `directorId`, `isActive` (Chairman's block/unblock toggle),
  `tenantCode`, `schoolSeq`. Each Director onboarded via `/platform/schools` or
  `/platform/directors` should own exactly one School.
- `Branch` → belongs to one School, has `genderScope` (BOYS/GIRLS/MIXED enum,
  currently unused for hard validation — real branches are MIXED even though they
  contain classes with names like "Nine Boys"/"Nine Girls" as SEPARATE CLASSES, not
  separate branches).
- `Class` has no gender field yet (only Branch does). Real class names in use:
  Play Group, Nursery, Prep, One–Ten (mostly), Hifz Two–Eight, "Nine Boys"/"Nine Girls"
  as distinct classes.
- Login ID convention: e.g. `020101060001` = tenant 02, school 01, branch 01,
  role 06 (Teacher), person 0001. Students/Teachers get password `student<SR_NO>` /
  `teacher<SR_NO>` as first-login defaults.
- `/platform` module (CHAIRMAN-only): `GET/POST /platform/schools` (list / onboard a
  School+Director together), `POST /platform/directors` (onboard just a Director login,
  no school yet — they create their own via `/schools/mine`), `PATCH
  /platform/schools/:id/block` and `/unblock`. **No branch-transfer or school-delete
  endpoint exists in the app** — see "Branch transfer" note below for how that was done
  as a one-off.
- Reports module has `GET /reports/branch-summary` (added 2026-08-09) — per-branch
  student/teacher/staff/class counts, used by the Dashboard's "Students & Teachers by
  Branch" card.
- Tables with a direct (denormalized) `schoolId` AND optional `branchId`, relevant if
  ever moving a branch between schools again: `users`, `classes`, `staff_profiles`,
  `income_records`, `expense_records`, `fee_invoices`, `announcements`, `vehicles`,
  `routes`, `hostel_rooms`. `sections` has no schoolId itself but is indirectly scoped
  via `academic_years.school_id` (through `class → section → academicYear`) — moving a
  branch's classes to a new school means academic_year rows need find-or-create +
  remap too. `fee_structures`/`subjects`/`exams` are school-level only (no branchId) —
  check for rows before moving a branch if the target has real fee/exam setup (Ali Khel
  had 0 of these, so untested for a branch that DOES have them).

## Current real data / tenant structure (as of 2026-08-10)

**Three separate Schools now** (previously all 3 branches lived under one School):

1. **Dar e Arqam School Jandanwala** (`a78fa6d7-44c6-4757-92ab-1ccffcadd3c4`, code
   `DAS-JND-01`, tenantCode `01`) — director@daralarqam.local (Chairman + Director,
   the user's own grandfathered account). Contains:
   - **Jandanwala branch** — 319 students, 21 staff/teachers, 20 classes.
   - **Rodi branch** (`6d428d96-aa20-410f-b935-4a3b64a71063`) — exists but EMPTY, real
     data not yet migrated (FoxPro source not yet located/requested from the user).
2. **Dar e Arqam School Ali Khel** (`2d0f73ae-8747-43ed-8313-686fa6bc7477`, code
   `DAS-AKC-01`, tenantCode `02`, schoolSeq `01`) — **NEW, created 2026-08-10**.
   Director: **Tariq Ishaq**, login `director.alikhel@das.edu`, phone `03015842634`,
   password `ChangeMe123!` (default — tell the user to change it after first login).
   Contains the real Ali Khel branch (`f172a1fd-b373-4937-9545-8f64cda869d4`) —
   **migrated 2026-08-10** from the Jandanwala school: 18 students, 4 staff/teachers,
   8 classes, all moved cleanly (verified: 0 left behind). Students/teachers kept their
   existing Login IDs/passwords — only the owning School/Director changed, no
   credentials were regenerated.
3. **Dar e Arqam School Rodi** (`c302013d-522d-4e2f-ae1c-a00940017c4d`, code
   `DAS-RODI-01`, tenantCode still `null` — not backfilled yet since empty) — **NEW,
   created 2026-08-10**. Director: **Tariq Ishaq** (same person as Ali Khel), login
   `director.rodi@das.edu`, phone `03407486534`, password `ChangeMe123!`. **Currently
   EMPTY** — no branch/data moved into it yet, since Rodi's real data was never
   migrated in the first place (see Rodi branch note above, still under Jandanwala
   school). When Rodi's real data is eventually migrated/entered, it should go here,
   not under Jandanwala.

Two stray test entries also exist: "Public" (code `02`) and "Publicschool" (code
`02.bk`) — empty, no branches, harmless, not yet asked about whether to remove.

**Cleaned up 2026-08-10:** there used to be 3 duplicate EMPTY branches (Ali Khel /
Jandanwala-Esha / Rodi-Ibtehaj, all named the same as the real ones) sitting under an
orphan School id (`92117c7a-7632-4849-9b69-308e05b1c6ea`) that didn't even show up in
`/platform/schools` — a pre-existing data-quality leftover from some earlier
migration attempt, not something this session created. All 3 were soft-deleted
(`deletedAt` set) via `DELETE /branches/:id`. If you ever see duplicate-named branches
again, check `schoolId` carefully before trusting counts — don't assume the first
match is the real one.

FoxPro source data locations (Windows paths, for future migrations):
- Ali Khel: already migrated, source no longer needed.
- Jandanwala: `D:\das jandanwala\session 2026-27\Dar Arqam School Software 2025-26\Student System`
  (DBF files: student.DBF, staff.DBF, class.DBF, branch.DBF, session.DBF, etc. —
  parse with Python `dbfread`, `encoding='latin1'`, `ignore_missing_memofile=True`,
  and EXCLUDE the `PICTURE` memo field, it's huge binary blobs).
- Rodi: still not located/requested from the user.

## Pending feature requests from the user

1. ✅ **DONE** (2026-08-09) — Chairman dashboard branch-wise student/teacher totals.
   `/reports/branch-summary` + Dashboard card. Commit `a0befe2`.
2. **PARTIALLY DONE** (2026-08-10) — Give Ali Khel and Rodi their own separate
   Director logins (Option A: separate School/tenant each, chosen by the user
   earlier).
   - ✅ Ali Khel: new School + Director created, real branch data (8 classes/22 users)
     migrated over. Done and verified.
   - ✅ Rodi: new School + Director created (empty, ready).
   - ⏳ **STILL PENDING**: Rodi has no real data yet anywhere in the system — need to
     get Rodi's source data from the user (FoxPro DBFs or fresh entry) and migrate it
     into the new `Dar e Arqam School Rodi` tenant once available.
   - ⏳ **STILL PENDING**: tell the user to have Tariq Ishaq change both default
     passwords (`ChangeMe123!`) after first login.
   - ⏳ **STILL PENDING**: two temporary Railway "Function" services used for the
     migration (`data-migration-dry-run`, `data-migration-write`) are marked for
     removal but stuck awaiting 2FA approval in the Railway dashboard (API/MCP tokens
     can't complete 2FA) — ask the user to approve the removal from the dashboard, or
     just leave them (they're idle, one-shot, no ongoing cost/risk, just clutter).
3. ⏳ **PENDING** — Chairman should be able to Block and Delete any Director account
   except their own. Block already exists (`/platform/schools/:id/block`). Delete does
   not exist yet. Needs new backend endpoint(s) + frontend UI.
4. ⏳ **PENDING** — Only the Chairman should be able to create single-gender
   (BOYS/GIRLS) branches; other Directors only MIXED. Needs a role check in branch
   creation (backend `branches` module) — not yet implemented.
5. ⏳ **PENDING** — Business rule: classes up to 5 (Play Group–Five) co-ed/mixed;
   classes 6–10 gender-separated. Recommended approach (not yet built): add optional
   `classGender` field to `Class`, auto-backfill from name suffix, soft-validate on
   new class creation for grades 6–10 (excluding Hifz track). Needs a Prisma migration.
6. ⏳ **PENDING** — Mobile view bug: screen only shows half on every tab. Not yet
   reproduced (browser resize_window tool doesn't change actual viewport in sandbox).
   Still waiting on 2–3 screenshots from the user's actual phone to diagnose.

## Useful gotchas / lessons learned this project

- Sandbox bash (`mcp__workspace__bash`) **cannot** reach `api.nexoradsa.org`,
  `github.com`, OR the Railway Postgres proxy (`*.proxy.rlwy.net`) directly — DNS
  itself fails (`EAI_AGAIN`), network allowlist blocks it entirely. `pg`/`psql`
  from the sandbox is a dead end for touching the production DB.
- The Railway MCP's `list-variables` tool returns **redacted** values when connected
  via OAuth app (which this session is) — no way to read `DATABASE_URL` etc. in
  plaintext through it. The plaintext DB credentials DO exist in the local repo's
  `backend/.env` (see Infrastructure section) but the sandbox can't reach that host
  anyway (see above).
- **How to actually run one-off scripts/migrations against the production DB**: use
  the `railway-agent` MCP tool (Railway's own AI agent). It can create a temporary
  Railway "Function" service (a one-shot Bun/Node container with access to real env
  vars like `DATABASE_URL`, since it runs inside Railway's network) — give it exact
  JS using the `pg` package (raw SQL, NOT Prisma Client — Prisma Client isn't
  available/generatable in that throwaway context either). Pattern that worked well:
  (1) ask it to build + run a READ-ONLY dry-run function first, verify the exact
  numbers before writing anything; (2) then send the WRITE script wrapped in a single
  Postgres `BEGIN`/`COMMIT`/`ROLLBACK` transaction with verification queries at the
  end, logged via `console.log(JSON.stringify(...))` so you can read results from
  `get-logs`; (3) ask it to delete the temp function(s) afterward — but deletion can
  get stuck needing **2FA approval in the Railway dashboard** if triggered via
  API/MCP token, so warn the user they may need to clean up manually.
- The `railway-agent` MCP call can drop the connection/error out (`MCP server
  connection lost`) right after it finishes a long operation — **don't assume
  failure**. Check `list-services` (did the temp service get created?) and
  `list-deployments` + `get-logs` on that service directly via the regular Railway MCP
  tools to see what actually happened before retrying or reporting failure to the user.
- No built-in API endpoint exists to move a Branch between Schools (`UpdateBranchDto`
  only allows name/genderScope/isActive, not schoolId) — that's why the raw-SQL
  Function approach above was needed. If this need comes up again (e.g. Rodi later),
  either reuse that same pattern, or consider actually building a proper
  `/platform/branches/:id/transfer` endpoint in the codebase if it becomes a recurring
  operation.
- JWT access tokens expire in 15 minutes — long sequential API-call loops from the
  browser can hit this mid-batch. Fix pattern: reload the app page, re-fetch a fresh
  token from `localStorage.getItem('sms.accessToken')`, retry.
- Railway's "redeploy" button/tool reuses the OLD commit snapshot — does NOT re-fetch
  from GitHub. A genuine new push to the connected branch triggers a proper "deploy"
  with the new commit. Use `list-deployments` and check `meta.commitHash` to confirm.
- `/tmp` in the bash sandbox is **not** reliably persistent across tool calls in a long
  session — don't assume a `git clone` in `/tmp` survives a long gap. The mounted
  project folder IS persistent for the session.
- `git push` needs a PAT since no `gh` CLI / stored credentials are available in the
  sandbox — ask the user to generate one at github.com/settings/tokens/new (repo
  scope, short expiry) when code needs to go live and the browser/GitHub-web-editor
  route isn't practical.
- Claude in Chrome extension can silently disconnect mid-session with no clear cause —
  just retry `tabs_context_mcp`, fall back to `web_fetch` / Railway MCP / asking the
  user to check the live site themselves when it's down for a while.
- Prisma's `npx prisma generate` fails in this sandbox (403 fetching engine binaries,
  network-restricted) — can't get a full typed build locally. Rely on: (a) closely
  mirroring existing, already-deployed working code patterns, (b) `npx tsc -b` on the
  frontend, (c) manual review, (d) Railway's own build failing loudly if something's
  actually broken — check `list-deployments` status after pushing.
- Multiple parallel Cowork/Claude sessions can exist for this project at once (seen via
  `mcp__session_info__list_sessions`) — worth checking those transcripts for context
  before assuming something hasn't been done yet, especially for anything that looks
  like it might already be "in progress" elsewhere.

## Feature-gap roadmap vs. competitor (School Mentor) — started 2026-08-25

The user shared two competitor PDFs (School Mentor App Pvt Ltd's feature list +
customer doc). They were catalogued into
`F:\My Claude Projects\School Software\SchoolMentor-Feature-List.txt` (125 features +
50 SOPs, with a "QUICK GAP-CHECK" section listing what our system was missing). The
user then asked to close those gaps AND separately build a parent/admin communication
system (calls/video/chat/meetings) integrated with the existing voice-agent-service —
explicitly asked to do this **one milestone at a time**, and explicitly said to keep
writing code without waiting for the deploy pipeline to recover (**"Abhi sirf code
likhte raho, deploy baad mein"**) because `mcp__workspace__bash` has been down
(`VM_DISK_SPACE_INSUFFICIENT`) since partway through Milestone 1. Nothing below has
been committed/pushed/deployed yet — it all exists only in the local mounted repo.

Milestone list (status as of 2026-08-25):

1. ✅ **DONE** — Bulk Excel Import (Students & Teachers). New shared util
   `backend/src/common/utils/excel-import.ts` (`parseExcelRows`, `buildExcelTemplate`,
   `BulkImportSummary` type). Added `buildImportTemplate()` + `bulkImport()` to both
   `students.service.ts`/`teachers.service.ts`, new endpoints `GET .../bulk-import/template`
   + `POST .../bulk-import` on both controllers. Frontend: `BulkImportDialog.tsx`
   (reusable, `kind: 'students'|'teachers'`), wired into `StudentsPage.tsx`/
   `TeachersPage.tsx` with a "Bulk Import" button. Added `exceljs` to
   `backend/package.json`.
2. ✅ **DONE** — Student/Teacher ID Card Designer. New module
   `backend/src/modules/id-cards/` (`id-card-pdf.service.ts` draws a CR80-size
   (243×153pt) card front+back using pdfkit, matching the brand-color conventions in
   `certificate-pdf.service.ts`; `id-cards.service.ts` loads Student/Teacher profiles
   with school/branch/section relations and builds `IdCardData`; `id-cards.controller.ts`
   exposes `GET /id-cards/students/:id`, `GET /id-cards/teachers/:id`, and batch/print-
   sheet routes `GET /id-cards/students/batch/section/:sectionId`,
   `GET /id-cards/teachers/batch/branch/:branchId`, `GET /id-cards/teachers/batch/school`
   — batch routes lay cards out 2×4 on A4 pages for print-and-cut). Registered in
   `app.module.ts`.
   - Discovered **`TeacherProfile` had no `photoUrl` field at all** (only
     `StudentProfile` did) — added `photoUrl String? @map("photo_url")` to
     `TeacherProfile` in `schema.prisma`. **A Prisma migration/`db push` for this new
     column is still needed once the deploy pipeline is back** (nothing auto-runs
     migrations in this project — check `backend/prisma/migrations/` convention before
     deploying, or run `prisma db push` against production).
   - Discovered there was **no way for anyone to actually upload a student/teacher
     photo** — `photoUrl` was schema-only, presumably meant to be populated externally.
     Added `POST /students/:id/photo` and `POST /teachers/:id/photo` (multipart,
     3MB limit, roles DIRECTOR/ADMIN/PRINCIPAL[/RECEPTIONIST for students]) —
     `uploadPhoto()` in both services saves via a new shared helper
     `backend/src/common/utils/photo-storage.ts` (`savePersonPhoto`/`fetchPersonPhoto`),
     filename = the profile's own id (re-upload overwrites, no orphaned files).
   - `fetchPersonPhoto()` accepts EITHER a full `http(s)://` URL (network fetch — for
     any legacy/external photoUrl values) OR a relative fileKey saved by
     `savePersonPhoto()` (read straight off local disk, no HTTP round-trip since PDF
     generation runs in-process). **Also swapped the existing local `fetchPhoto()`
     implementations in `finance/fee-receipt.service.ts` and
     `exams/result-card-pdf.service.ts` to delegate to this same shared helper** — so
     a photo uploaded via the new endpoints now shows up on fee receipts and result
     cards too, not just ID cards. Uses `UPLOADS_DIR` (falls back to
     `<cwd>/uploads`) — same root as `documents/storage.service.ts`, so make sure
     that env var (and its persistent volume, if any) covers `photos/students/` and
     `photos/teachers/` subfolders too, not just `documents/`.
   - Frontend: new `frontend/src/components/IdCardActions.tsx` exports
     `IdCardButton` (per-row "download this person's card"), `PhotoUploadButton`
     (per-row hidden-file-input upload), and `IdCardBatchDialog` (toolbar "Print ID
     Cards" — students: pick school→branch→class→section; teachers: pick
     school→branch). Wired into both `StudentsPage.tsx` and `TeachersPage.tsx` (a
     new "Print ID Cards" toolbar button + per-row Card/Camera icon buttons, visible
     to `canManage`, not just `canDeactivate`).
3. ✅ **DONE** — Admissions CRM (leads/follow-ups/lead sources). New Prisma models
   `AdmissionEnquiry` + `AdmissionFollowUp` (enums `AdmissionSource`, `AdmissionStatus`)
   added to `schema.prisma`, right after the `EnrollmentStatus` enum — required adding
   back-relation fields on `School`, `Branch`, `User` (×3: assignedTo/createdBy on
   enquiries, createdBy on follow-ups), and `StudentProfile` (`sourceEnquiry`).
   **Needs the same pending migration/`db push` as the ID-card TeacherProfile.photoUrl
   change above** once deploy is back.
   - New module `backend/src/modules/admissions/` (`admissions.service.ts`,
     `admissions.controller.ts`, `admissions.module.ts`, 4 DTOs). Staff-authenticated
     routes: `POST/GET /admissions/enquiries`, `GET /admissions/enquiries/summary`
     (pipeline counts by status + by source, for a dashboard widget),
     `GET/PATCH/DELETE /admissions/enquiries/:id`, `POST
     /admissions/enquiries/:id/follow-ups` (append-only activity log, auto-bumps
     NEW/CONTACTED status to FOLLOW_UP). Roles: DIRECTOR/ADMIN/PRINCIPAL/RECEPTIONIST
     can manage, DIRECTOR/ADMIN can delete (soft-delete, for mistaken entries only -
     genuine drop-offs should be marked REJECTED/LOST via status instead so history
     is kept).
   - **Public, unauthenticated route** `POST /admissions/public/:schoolCode/enquiries`
     (identifies the school by its short `code`, not an internal id) - this is the
     "Online Admission/Enquiry" form entry point. No `@UseGuards` on this one method
     specifically (there's no global auth guard in this app, so this was safe to do
     per-route rather than needing an `@Public()` decorator).
   - **Closing the loop with real admissions**: `CreateStudentDto` gained an optional
     `enquiryId` field; `StudentsService.create()` now marks that enquiry ADMITTED +
     links `convertedStudentId`/`convertedAt` inside the same transaction, when
     provided. `AdmissionsPage.tsx`'s "Convert to Student" button calls
     `POST /students` directly with `enquiryId` set (own small form for
     admissionNo/password/branch/class/section, pre-filling name/guardian/phone/address
     from the enquiry) rather than duplicating account-creation logic anywhere.
   - Frontend: new `frontend/src/pages/AdmissionsPage.tsx` (pipeline view with
     status-pill filters from the summary endpoint, search, create dialog, detail
     dialog with inline status/assign-to-me/follow-up-log/add-follow-up, and the
     Convert-to-Student sub-dialog) + new **public, unauthenticated**
     `frontend/src/pages/PublicEnquiryPage.tsx` at route `/apply?school=<code>`
     (outside `ProtectedRoute` in `App.tsx`) - shareable as a direct link or
     embeddable on the school's own website, POSTs to the public backend route above.
     Added "Admissions" to the sidebar (`lib/nav.ts`, `UserPlus` icon, right after
     Students) for DIRECTOR/ADMIN/PRINCIPAL/RECEPTIONIST. Also added a small shared
     `frontend/src/components/ui/textarea.tsx` (didn't exist before - needed for
     follow-up notes and the enquiry notes/address fields).
4. ✅ **DONE (proof-upload flow only - see caveat)** — Online Fee Payment Gateway.
   User was asked which payment method to build (JazzCash/EasyPaisa API, bank-transfer
   + proof upload, card gateway, or all) and chose **"Sab kuch" (all of them)**. Built:
   - New Prisma model `OnlinePaymentAttempt` (+ enums `OnlinePaymentMethod` JAZZCASH/
     EASYPAISA/BANK_TRANSFER/CARD, `OnlinePaymentStatus`
     PENDING/SUBMITTED/APPROVED/COMPLETED/REJECTED/FAILED), added right after
     `FeePayment` in `schema.prisma`, with back-relations on `FeeInvoice` and `User`
     (×2: initiatedBy/reviewedBy) and a nullable back-relation on `FeePayment` itself.
     **Needs the same pending migration as the other two schema changes above.**
   - New module `backend/src/modules/online-payments/` (service/controller/module +
     2 DTOs). `FinanceModule` now `exports: [FeePaymentService]` so this module can
     call the *exact same* `FeePaymentService.record()` logic used for manual
     receipts - an approved online payment creates a real `FeePayment` +
     `IncomeRecord` exactly as if an Accountant typed it in.
   - **What's actually live and usable today, with zero external accounts needed**:
     JazzCash / EasyPaisa / Bank Transfer via a "proof-upload" flow -
     `POST /online-payments/initiate` (PARENT/STUDENT) returns the school's own
     JazzCash number / EasyPaisa number / bank account (from `SchoolSetting`) so the
     family sends money directly, then `POST /online-payments/:id/proof` (multipart,
     reuses the `photo-storage.ts` helper from Milestone 2, stored under
     `payment-proofs/`) uploads a screenshot/receipt. Staff see it in
     `GET /online-payments/pending` and `POST /online-payments/:id/approve` (or
     `/reject`) - approving is what actually books the `FeePayment`.
   - **What is NOT live - CARD payments, and JazzCash/EasyPaisa in true redirect/API
     mode**: `initiate()` deliberately throws a clear "not yet set up" error for
     `CARD` rather than faking a working checkout, because **no real merchant
     credentials exist for any gateway** (no JazzCash/EasyPaisa merchant API keys, no
     Stripe/PayFast account) and I have no sandbox to test against. Building a
     webhook-signature-verification flow blind, for real money, with zero ability to
     verify it actually works, was judged too risky to ship silently - the schema
     (`gatewayTxnRef`/`gatewayResponse` fields) is ready for this, but the actual
     gateway adapter code has NOT been written. **Before offering true card/API
     payments, the user needs to decide + obtain**: (a) a JazzCash/EasyPaisa merchant
     account (if they want real-time wallet API instead of proof-upload), and/or (b)
     a Stripe or PayFast merchant account for cards - then this can be finished.
   - Frontend: `frontend/src/components/PayOnlineDialog.tsx` (parent-facing, two-step:
     pick method+amount → shown payTo details → upload proof), wired into
     `ParentsPage.tsx`'s existing Fees card with a "Pay Online" button per unpaid/
     partial invoice. Staff-facing `frontend/src/components/finance/
     OnlinePaymentsReviewTab.tsx` (approve/reject queue with a proof "View" button
     via `api.openBlob`), added as a new "Online Payments" tab on `FinancePage.tsx`.
     New shared `frontend/src/components/ui/textarea.tsx` (added in this milestone,
     reused by Admissions CRM too).
5. ✅ **DONE (needs ANTHROPIC_API_KEY set before it'll actually work)** — AI features:
   Question Paper Generator + Lesson Plan Generator. New Prisma models
   `AiQuestionPaper` + `AiLessonPlan` added right before the "MILESTONE 5 — EXAMS &
   RESULTS" section in `schema.prisma` (unrelated historical numbering, just a
   comment - don't confuse with this roadmap's Milestone 5), each storing the AI's
   structured output as a `Json` `content` field so a teacher can edit before
   printing - nothing auto-publishes. Back-relations added on `School`, `Subject`,
   `Class`, and `User` (×2: aiQuestionPapersCreated/aiLessonPlansCreated).
   **Needs the same pending migration as the other schema changes above.**
   - Added `@anthropic-ai/sdk` to `backend/package.json`. New
     `backend/src/modules/ai/anthropic-client.service.ts` wraps the Anthropic
     Messages API - reads `ANTHROPIC_API_KEY` (throws a clear 503 if missing, model
     name from `ANTHROPIC_MODEL` env var, defaults to `claude-sonnet-5`), sends a
     system prompt demanding raw JSON, and defensively strips markdown code fences /
     stray prose before `JSON.parse`. **This env var is NOT set yet anywhere -
     the feature will 503 with a clear message until it is added to Railway.**
   - New module `backend/src/modules/ai/` : `ai-question-paper.service.ts` (prompts
     for a full exam paper - sections/questions/marks/types MCQ|SHORT|LONG|
     TRUE_FALSE|FILL_BLANK, grounded on teacher-given topics/chapters, marks must
     sum correctly), `ai-lesson-plan.service.ts` (objectives/materials/warm-up/
     main activities/assessment/homework), `ai-document-pdf.service.ts` (pdfkit,
     same brand-color conventions as other PDF services), `ai.controller.ts` (routes
     under `/ai/question-papers/*` and `/ai/lesson-plans/*` - generate/list/get/
     patch/delete/pdf for each), `ai.module.ts`.
   - Frontend: new `frontend/src/pages/AiToolsPage.tsx` (two tabs, each with a
     "Generate" dialog and a list of saved drafts with View/Edit, Download PDF, and
     Delete). The edit dialogs let a teacher tweak every question's text/marks or
     every lesson-plan list item inline before saving - not just view read-only AI
     output. Added "AI Tools" to the sidebar (`lib/nav.ts`, `Sparkles` icon, right
     before Exams & Results) for DIRECTOR/ADMIN/PRINCIPAL/COORDINATOR/TEACHER.
   - **Outstanding for this milestone**: get an Anthropic API key from
     console.anthropic.com and set `ANTHROPIC_API_KEY` (and optionally
     `ANTHROPIC_MODEL`) as a Railway backend env var - the code is complete and
     ready, it just has no key to call yet.
6. ✅ **DONE (code only)** — Automated daily DB backup. Added `@nestjs/schedule` to
   `app.module.ts` (`ScheduleModule.forRoot()`), `@Cron(EVERY_DAY_AT_2AM)` method
   `runScheduledBackup()` in `backend/src/modules/backup/backup.service.ts` (attributes
   the run to the oldest CHAIRMAN user, since `BackupLog.triggeredById` is non-nullable
   and adding a "system user" concept felt like overkill for this). **Also fixed a real
   infra gap while here**: the `backend` Railway service had NO volume attached, so
   `backups/` was ephemeral container disk — created a Railway Volume
   (`backend-backups`, 10GB) mounted at `/data/backups` + set `BACKUPS_DIR=/data/backups`
   via `railway-agent` (both staged, take effect on next deploy — `BackupService`
   already reads `process.env.BACKUPS_DIR` so no code change was needed for that part).
   **NOTE**: given the new `photos/` storage above also uses a similar
   `UPLOADS_DIR`-rooted path, check whether that also needs a persistent volume — right
   now it's likely pointed at the same ephemeral disk unless `UPLOADS_DIR` already maps
   to something persistent; worth confirming before relying on uploaded photos surviving
   a redeploy.
7. ✅ **DONE (code only)** — Inventory/POS + Assets Management. Two new areas sharing
   one module, `backend/src/modules/inventory/`:
   - **Inventory & POS**: new Prisma models `InventoryItem` (name/category/sku/unit,
     `costPrice`/`sellPrice`/`quantityOnHand`/`reorderLevel`, scoped to
     `schoolId`+optional `branchId`) and `InventoryTransaction` (`type` enum
     PURCHASE/SALE/ADJUSTMENT, positive `quantity`, `unitPrice`/`totalAmount`,
     optional `studentId` link so a uniform/book sale can be tied to a specific
     student, `note`, `createdById`). Appended at the end of `schema.prisma` (after
     `SchoolSetting`, the prior EOF). Back-relations: `School.inventoryItems`,
     `Branch.inventoryItems`, `StudentProfile.inventoryTransactions`,
     `User.inventoryTransactionsCreated`.
     `inventory.service.ts`: `createItem()` (optionally books an opening-stock
     PURCHASE transaction), `recordTransaction()` (computes signed delta by type -
     PURCHASE +qty, SALE -qty, ADJUSTMENT ±qty per a `direction` field - throws if it
     would take stock negative, and does the transaction-row-insert + item-quantity-
     update inside one `$transaction`), `profitLossReport()` (aggregates SALE
     transactions in a date range, profit = revenue - qty×item's *current* cost
     price - simple but clearly documented as such, not FIFO/weighted-average
     costing). Routes under `/inventory` (`items`, `items/:id`, `transactions`,
     `reports/profit-loss`) for DIRECTOR/ADMIN/ACCOUNTANT/PRINCIPAL.
   - **Assets**: new Prisma models `Asset` (name/category/assetTag, purchase date+
     cost, `condition` enum NEW/GOOD/FAIR/POOR/DAMAGED, `location`, optional
     `assignedToId` → User, warranty expiry, `isDisposed`/`disposedAt`) and
     `AssetMaintenanceLog` (date/description/cost per asset). Back-relations:
     `School.assets`, `Branch.assets`, `User.assetsAssigned`,
     `User.assetMaintenanceLogsCreated`. `asset.service.ts`: standard CRUD +
     `addMaintenanceLog()`; `update()` auto-sets `disposedAt` when `isDisposed`
     flips to true. Routes under `/assets` for DIRECTOR/ADMIN/PRINCIPAL.
   - **Needs the same pending migration/`db push` as every other schema change in
     this section** — `InventoryItem`, `InventoryTransaction`, `Asset`,
     `AssetMaintenanceLog` do not exist in the real database yet.
   - Frontend: new `frontend/src/pages/InventoryPage.tsx` — two tabs
     ("Inventory & POS": item list with low-stock badges, Add Item dialog with
     optional opening stock, a Stock Movement dialog per item for
     Sale/Purchase/Adjustment with an optional student picker on sales, plus a
     revenue/cost/profit summary card from the P&L report; "Assets": asset list
     with condition badges, Add Asset dialog, a detail dialog showing/adding
     maintenance logs and a "Mark Disposed" action). Added "Inventory & Assets" to
     the sidebar (`lib/nav.ts`, `Boxes` icon, right before Payroll) for
     DIRECTOR/ADMIN/PRINCIPAL/ACCOUNTANT. Route registered at `/inventory` in
     `App.tsx`.
8. ✅ **DONE (code only)** — Suggestions Box + Meetings/Tasks admin tools (matches
   SchoolMentor items #24 Meetings Management, #25 Tasks Management, #27
   Suggestions Box exactly). Three independent new modules, all appended at the
   end of `schema.prisma` after the Inventory/Assets section:
   - **Meetings** (`Meeting` + `MeetingAttendee` models, `MeetingStatus` enum
     SCHEDULED/COMPLETED/CANCELLED): schedule/notify/take minutes/archive.
     `backend/src/modules/meetings/meetings.service.ts` - `create()` invites
     attendees and fires an in-app `Notification` (type SYSTEM, reusing the
     existing `notifications` table/feed from the Communication module - no new
     notification infra needed) and stamps `MeetingAttendee.notifiedAt`;
     `update()` handles status changes and free-text `minutes`; `markAttendance()`
     toggles each attendee's `attended` boolean after the fact; `mine()` returns
     meetings where the current user is either the creator or an invited
     attendee - open to every role, not just managers. Routes under `/meetings`
     (DIRECTOR/ADMIN/PRINCIPAL/COORDINATOR manage; `/meetings/mine` and
     `/meetings/:id` open to any authenticated role via an explicit empty
     `@Roles()` override on those two handlers specifically).
   - **Staff Tasks** (`StaffTask` model, `StaffTaskPriority` LOW/MEDIUM/HIGH,
     `StaffTaskStatus` PENDING/IN_PROGRESS/COMPLETED/CANCELLED): assign to
     staff, track completion - deliberately NOT wired to the voice-agent/
     calling system (SchoolMentor's spec literally says "no follow-up calls"
     for this one - it's a simple internal to-do, not a calling workflow).
     `staff-tasks.service.ts` - `create()` notifies the assignee;
     `updateStatus()` lets the assignee update their own task's status without
     needing a manager role (checked in code: assignee OR
     DIRECTOR/ADMIN/PRINCIPAL/COORDINATOR), auto-sets/clears `completedAt`;
     `mine()` = tasks assigned to me. Routes under `/staff-tasks`
     (create/edit/delete restricted to managers; `/staff-tasks/mine` and
     `PATCH /staff-tasks/:id/status` open to any authenticated role).
   - **Suggestions Box** (`Suggestion` model, `SuggestionStatus` NEW/REVIEWED/
     IN_PROGRESS/RESOLVED/DISMISSED): anonymous feedback channel, staff/parents
     to management. `submittedById` is always stored (audit/anti-abuse), but
     `suggestions.service.ts` has a `sanitize()` step that strips
     `submittedById`/`submittedBy` from every response shown to management
     whenever `isAnonymous` is true - true anonymity is enforced in the API
     layer, not left to the frontend to hide. `mine()` lets a person track their
     own (even anonymous) submissions and any response. `respond()` only sends
     an in-app notification back to the submitter when the suggestion was
     NOT anonymous (notifying an "anonymous" submitter would out them the
     moment they see it). Routes under `/suggestions` - `POST /suggestions` and
     `GET /suggestions/mine` open to anyone logged in; list/detail/respond
     restricted to DIRECTOR/ADMIN/PRINCIPAL.
   - **Needs the same pending migration/`db push` as every other schema change
     above** - none of `Meeting`, `MeetingAttendee`, `StaffTask`, `Suggestion`
     exist in the real database yet.
   - Frontend: new `frontend/src/pages/MeetingsTasksPage.tsx` (two tabs -
     "Meetings": All/Mine toggle for managers, Schedule dialog with a
     checkbox attendee picker, detail dialog with agenda/attendance-marking/
     status/minutes; "Tasks": All/Mine toggle, Assign dialog, inline status
     `Select` per row, delete for managers) and
     `frontend/src/pages/SuggestionsPage.tsx` (two tabs - "Submit & Track": a
     form with an anonymous checkbox plus a personal submission history with
     any management response shown; "Review" (managers only): status filter,
     list, and a respond dialog to set status + write a response). Added
     "Meetings & Tasks" (`CalendarCheck` icon) and "Suggestions Box"
     (`Lightbulb` icon) to `lib/nav.ts`, visible to every non-CHAIRMAN role
     (same role list as Schedule/Dashboard) since "my meetings"/"my tasks"/
     "submit a suggestion" apply to everyone, not just management. Routes
     registered at `/meetings-tasks` and `/suggestions` in `App.tsx`.
9. ✅ **DONE (code + content)** — SOPs/Manuals content library (SchoolMentor item
   #121: "50 documents bundled into the product"). New `ManualDocument` model
   (`ManualCategory` enum ACADEMIC/ADMINISTRATION/HUMAN_RESOURCE/FINANCE/
   HEALTH_SAFETY/USER_MANUAL/CUSTOM), appended after Suggestions in
   `schema.prisma`. Back-relations: `School.manuals`, `User.manualsCreated`/
   `manualsUpdated`. Key design point: `schoolId: null` = a bundled manual
   shipped with the product, visible to every school; `schoolId` set = a
   school's own CUSTOM manual, visible only to that school (in addition to the
   global ones). `slug` is `@unique` (Postgres allows multiple NULLs, so
   school-authored CUSTOM manuals - which have no slug - aren't affected) so
   the seed script can safely re-run without duplicating.
   - `backend/src/modules/manuals/manuals.service.ts` - `create()` defaults to
     a global (schoolId null) manual only for CHAIRMAN, otherwise falls back to
     the caller's own school; `findAll()` returns global + the caller's own
     school's manuals combined, hides unpublished drafts from non-managers;
     `update()`/`remove()` reuse `assertSchoolAccess` against the manual's
     `schoolId`, which - as a side effect of how that helper works - naturally
     blocks any non-CHAIRMAN from editing a global manual (schoolId null fails
     the access check for everyone except the UNRESTRICTED_ROLES/CHAIRMAN
     case), no special-case code needed. Routes under `/manuals`
     (CHAIRMAN/DIRECTOR/ADMIN/PRINCIPAL manage; list/detail open to any
     authenticated role via `@Roles()` overrides).
   - **The actual 50-manual content**: written out in full (not stubs) in
     `backend/prisma/manuals-data.ts` - 8 Academic, 8 Administration, 8 HR, 8
     Finance, 8 Health & Safety, and 10 "User Manuals" (rewritten to describe
     THIS system's actual modules/roles/routes rather than generic ERP text,
     since I know the real feature set - e.g. the "Admission CRM Manual"
     walks through the actual Admissions module, "Fee Module Manual" the
     actual Finance/online-payments flow, etc.). One naming change from the
     SchoolMentor list: item #50 "Mentor AI User Manual" was renamed to
     **"AI Tools User Manual"** to describe our own AI Question Paper/Lesson
     Plan generator without borrowing the competitor's product name. Each
     manual is a practical, concise SOP (Purpose/Scope/Procedure/Responsible
     Roles) - genuinely usable, not filler text, but intentionally not
     exhaustive corporate-policy-length documents.
   - `backend/prisma/seed-manuals.ts` - idempotent loader, upserts by `slug`
     (bumps `version` on content changes). **Not run yet** (bash sandbox is
     down) - run `npm run seed:manuals` (script added to `backend/package.json`)
     against the production database once deploy access is back, to actually
     populate the 50 manuals in the real DB.
   - **Needs the same pending migration/`db push` as every other schema change
     above**, plus the `seed:manuals` run described above (migration alone
     only creates the empty table - the seed script is what loads the 50
     documents into it).
   - Frontend: new `frontend/src/pages/ManualsPage.tsx` - two-pane library
     browser (category-grouped list on the left with search + category
     filter, reading pane on the right with a small dependency-free markdown-
     subset renderer for the `##`-heading/numbered-list content - no markdown
     npm package was added). Managers can add/edit/delete their own school's
     CUSTOM manuals (bundled global ones are read-only in the UI for
     non-CHAIRMAN). Added "Manuals & SOPs" (`BookOpen` icon) to `lib/nav.ts`,
     visible to every non-CHAIRMAN role. Route registered at `/manuals` in
     `App.tsx`.
10. 🔶 **IN PROGRESS** — Parent/admin communication system (calls, video calls, chat,
    online meetings), now discussed and broken into 5 sub-milestones (10a-10e).
    Architecture decisions locked in with the user:
    - **Video/voice platform: LiveKit Cloud** (chosen over Daily.co/Twilio/Agora/
      self-hosted Jitsi for free-tier generosity + React Native SDK maturity for the
      in-progress mobile app + a self-host escape hatch later since it's open-source).
      **A real LiveKit Cloud project now exists**: project name `dar-e-arqam-school`
      (id `p_4gwijtetgjb`), owner account `ranatahirchan@gmail.com`, created live via
      the Claude-in-Chrome browser tools in this same session (user had started the
      signup, said "ap khud kr lo baqi kam" - I finished the onboarding wizard,
      created the project with Agent observability **disabled** for cost control, and
      generated a service-account API key named "school-backend"). **Its
      `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` are already set as
      Railway env vars on the `backend` service** (via the Railway MCP tool,
      `skipDeploys: true` since no LiveKit code exists yet to redeploy for) - do NOT
      recreate this project or regenerate these keys; they're ready to use as soon as
      Milestone 10b's code lands. The API secret was only ever shown once in the
      LiveKit dialog and was not written to any file - if it's ever needed again,
      generate a new key from cloud.livekit.io → this project → Settings → API keys.
    - **Real PSTN calls**: wanted (not deferred) - Milestone 10e will use Twilio
      Voice API for human-to-human call bridging, distinct from Vapi (which is
      AI-driven). Likely reuses the same Twilio account already behind
      `voice-agent-service`'s Vapi setup - not yet investigated in detail.
    - **AI agent role**: confirmed **both** - (a) fallback call-answering when a
      staff member doesn't pick up an in-app call/video call (Milestone 10c), and
      (b) a silent "notetaker" participant in video meetings that transcribes and
      generates minutes/summaries (Milestone 10d).
    - **Mobile**: web-first: build/ship 10a-10e for the web app only, but design
      choices (LiveKit's React Native SDK) keep a future mobile build straightforward
      - no React Native screens are being built as part of this milestone.

    **10a - Real-time Chat: ✅ DONE (code only).** New Prisma models (appended after
    `ManualDocument`, the prior EOF): `ChatThread` (`ChatThreadType` enum
    DIRECT/CLASS_GROUP/BROADCAST/STAFF_GROUP; `sectionId` link for CLASS_GROUP so
    membership can be resynced from `Section`/`ParentStudent` any time the thread is
    opened; `postingRestricted` boolean - always true for BROADCAST, meaning only
    MODERATOR members or manager roles can post, everyone else is read-only),
    `ChatThreadMember` (`ChatMemberRole` MEMBER/MODERATOR, `lastReadAt` for unread
    counts), `ChatMessage` (simple body + optional `attachmentUrl`). Back-relations:
    `School.chatThreads`, `Branch.chatThreads`, `Section.chatThreads`,
    `User.chatThreadsCreated`/`chatThreadMemberships`/`chatMessagesSent`.
    - `backend/src/modules/chat/chat.service.ts`: `createGroup()` (STAFF_GROUP/
      BROADCAST, manual member list, BROADCAST restricted to DIRECTOR/ADMIN/
      PRINCIPAL), `getOrCreateSectionGroup(sectionId, user)` (auto-resolves members =
      that section's `classTeacherId` + every parent via `ParentStudent` where
      `student.sectionId` matches - idempotent, re-syncs/adds any new members each
      call via `createMany({skipDuplicates:true})`, never removes anyone
      automatically), `findOrCreateDirect(otherUserId, user)` (reuses an existing
      2-member DIRECT thread if one exists between the pair, else creates one),
      `myThreads()` (per-thread last message + unread count = messages after
      `member.lastReadAt` not sent by me), `getMessages()` (cursor-paginated via
      `before` timestamp), `sendMessage()` (enforces `postingRestricted`),
      `markRead()`, `addMembers()`/`removeMember()` (moderator/manager-only, blocked
      entirely for DIRECT threads).
    - `backend/src/modules/chat/chat.gateway.ts` (NEW real-time layer): a
      `@WebSocketGateway({namespace:'/chat'})` using **socket.io** (new deps added:
      `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` in
      `backend/package.json` - **not yet `npm install`ed, needs it on next deploy**).
      Auth happens once at connection: the client passes the same JWT access token
      via `handshake.auth.token`, verified with `jsonwebtoken.verify()` against
      `process.env.JWT_ACCESS_SECRET` (same secret/strategy as the HTTP
      `JwtStrategy`) - no separate socket auth system. Events: `joinThread`/
      `leaveThread` (join/leave a `thread:{id}` socket.io room, membership checked by
      calling `chatService.getMessages()` under the hood so a socket can never join a
      room the REST API wouldn't also allow), `sendMessage` (persists via
      `ChatService` then broadcasts), `typing` (ephemeral, no DB write). Exposes a
      public `broadcastMessage(threadId, message)` method that `ChatController` also
      calls after a REST-sent message, so clients that sent via plain HTTP (or
      haven't opened a socket yet) still notify everyone with an active connection.
      **Known v1 limitation**: gateway message bodies aren't run through
      class-validator DTOs (only the REST DTOs are) - acceptable for now since
      `ChatService` still enforces every real rule, but worth hardening later.
      Another known gap: the client socket doesn't hot-swap its JWT if the access
      token refreshes mid-session (would need a reconnect) - fine for session
      lengths seen so far, revisit if users report disconnects after ~15-60 min.
    - `backend/src/modules/chat/chat.controller.ts`: REST fallback/complement to the
      gateway - `POST /chat/threads` (STAFF_GROUP/BROADCAST), `POST
      /chat/threads/direct/:userId`, `POST /chat/threads/section/:sectionId`, `GET
      /chat/threads` (mine), `GET /chat/threads/:id/messages`, `POST
      /chat/threads/:id/messages` (also calls `chatGateway.broadcastMessage()`),
      `PATCH /chat/threads/:id/read`, `POST`/`DELETE .../members`. Open to every
      authenticated role (`@Roles()` at class level) since chat is inherently
      cross-role (parent-teacher, etc.) - only BROADCAST creation is role-gated,
      enforced inside the service, not the controller.
    - **Needs the same pending migration/`db push` as every other schema change
      above**, plus `npm install` for the new socket.io deps before the gateway will
      actually boot.
    - Frontend: `frontend/package.json` - added `socket.io-client`. New
      `frontend/src/lib/socket.ts` (`getChatSocket()`/`disconnectChatSocket()` -
      derives the bare backend origin from `VITE_API_URL` by stripping a trailing
      `/api`, since socket.io needs a raw origin + namespace, not a REST path
      prefix; falls back to `http://localhost:3000` for local dev). Wired
      `disconnectChatSocket()` into `lib/auth.tsx`'s `logout()`. New
      `frontend/src/pages/ChatPage.tsx`: left-panel conversation list (unread
      badges, last-message preview) + right-panel message thread with a composer;
      "New Conversation" dialog (DIRECT via a staff picker, Class/Section group via
      a Class→Section cascade, Staff Group/Broadcast via a checkbox member picker -
      Broadcast option only shown to DIRECTOR/ADMIN/PRINCIPAL). Live incoming
      messages arrive over the socket and merge into the sidebar/thread view;
      sending still goes through the REST endpoint for reliability, with the gateway
      broadcasting the result to anyone else connected. Added "Chat" to `lib/nav.ts`
      (`MessageCircle` icon, above Meetings & Tasks), visible to every non-CHAIRMAN
      role. Route registered at `/chat` in `App.tsx`.
    - **Known v1 scope limits, by design, to keep this shippable**: parents/students
      cannot browse a general "start a direct message with anyone" picker (the
      `/users` staff directory endpoint is DIRECTOR/ADMIN/PRINCIPAL-only) - they can
      only participate in threads a staff member/teacher already started with them,
      or their auto-created class/section group. A future improvement would be a
      narrower endpoint (e.g. "my linked teachers" for parents) to let them
      initiate conversations too.

    **10b - Video Meetings via LiveKit: ✅ DONE (code only).** Deliberately reuses
    Chat's exact membership model instead of a separate meeting-invite system - any
    ChatThread (DIRECT/CLASS_GROUP/STAFF_GROUP/BROADCAST) can have a call started
    inside it, so "class-wise", "whole-parent broadcast", "principal-teacher",
    "director-teacher", "director-management-committee" video meetings are all just
    "start a call in the right kind of thread" rather than new plumbing per case.
    - New Prisma model `ChatCall` (`CallStatus` ACTIVE/ENDED), appended after
      `ChatMessage` (prior EOF). `roomName` is stable (`thread-{threadId}`) - LiveKit
      rooms are ephemeral on their side, this row is purely our own bookkeeping
      (notifications, "ongoing call" banner, and - later - Milestone 10d's AI
      notetaker `transcript`/`summary` fields, already on the model unused for now).
      Back-relations: `ChatThread.calls`, `User.chatCallsStarted`.
    - `backend/src/modules/chat/livekit.service.ts` (NEW): wraps `livekit-server-sdk`
      (added to `backend/package.json`, **not yet `npm install`ed**). `mintToken()`
      builds an `AccessToken` grant (`roomJoin`, `canPublish`, `canPublishData`,
      `canSubscribe`) - throws a clear `ServiceUnavailableException` if
      `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` aren't set (same pattern
      as the AI module's missing-Anthropic-key check) - **these three ARE already
      set on Railway** (see Milestone 10 intro above), so this will actually work
      once deployed, no further config needed. `endRoom()` uses `RoomServiceClient`
      (converts the `wss://` URL to `https://` for LiveKit's REST API) to forcibly
      disconnect everyone when a call is explicitly ended, rather than just marking
      our own DB row.
    - `backend/src/modules/chat/chat-call.service.ts` (NEW): `joinCall()` -
      reuses `ChatService.assertMember()` (made public specifically so this service
      could share the exact same membership check, made `isManager()` public too for
      the same reason) - if no `ACTIVE` `ChatCall` exists for the thread it starts
      one (blocked for non-moderators in a BROADCAST thread - "wait for it to
      begin"), posts a "📹 X started a video call" system chat message (broadcast
      live via `ChatGateway.broadcastMessage()`), and notifies every other member.
      Publish permission in the minted token: full publish+subscribe for
      DIRECT/CLASS_GROUP/STAFF_GROUP and for anyone in a BROADCAST thread who is a
      MODERATOR/manager; **listen/watch-only** (`canPublish:false`) for a regular
      member joining a BROADCAST call - turns "whole-parent broadcast" into an
      actual one-to-many webinar rather than an open mic for everyone. `endCall()` -
      moderator/manager/original-starter only, marks the row `ENDED` and force-closes
      the LiveKit room via `livekit.endRoom()`. Added `ChatGateway.broadcastCallEvent()`
      (`started`/`ended`) so connected clients refresh their "ongoing call" banner
      instantly instead of only via their next poll.
    - `chat.controller.ts` extended: `GET /chat/threads/:id/call` (status/banner),
      `POST /chat/threads/:id/call/join` (returns `{token, url, roomName, callId,
      canPublish}`), `POST /chat/threads/:id/call/end`.
    - **Needs the same pending migration/`db push`** for `ChatCall`, plus `npm
      install` for `livekit-server-sdk` (backend) alongside the socket.io deps from
      10a.
    - Frontend: added `livekit-client`, `@livekit/components-react`,
      `@livekit/components-styles` to `frontend/package.json` - used the official
      prebuilt component library (`<LiveKitRoom>` + `<VideoConference />`) rather
      than hand-rolling WebRTC tile/track management, since it's the well-tested,
      officially maintained option for exactly this (full Zoom-like grid/mute/
      camera/screen-share/leave UI out of the box) - it brings its own CSS
      (`@livekit/components-styles`), which looks visually distinct from the rest of
      the app's shadcn/Tailwind design; treated as an acceptable, deliberate
      trade-off for a working call UI over a custom-but-unverified one, given no
      way to test WebRTC code in this session's broken sandbox. New
      `frontend/src/components/VideoCallOverlay.tsx` (full-screen overlay wrapping
      `LiveKitRoom`/`VideoConference`, with a close (X) button). `ChatPage.tsx`
      extended: thread header shows a "Start Call"/"Join Call" button (polls `GET
      .../call` every 8s, also refreshes instantly on the socket's new `callEvent`),
      an "End Call" button for whoever started it/a moderator/a manager, and opens
      `VideoCallOverlay` with the minted token on join.
    **10c - AI fallback call-answering: ✅ DONE (code only).** Scope, locked in with the
    user: the AI should genuinely talk/answer within its own jurisdiction (not just a
    missed-call notice), falling back to a logged "callback" promise for anything
    outside it - and it must **reuse the user's already-built voice-agent-service**
    (a separate NestJS+Prisma backend at `../voice-agent-service` for the phone/Vapi
    assistant's 9 duties: complaints, leave requests, absence notices, admission
    leads, feedback, appointments, schedule updates, calendar events, call-log
    memory) rather than building a new AI backend from scratch. Investigated that
    service thoroughly before writing anything: it's a pure data/CRM backend behind
    a shared `X-API-Key` (`VOICE_AGENT_SERVICE_API_KEY`) - the actual "Middleware"
    that would translate Vapi tool-calls into HTTP requests was explicitly documented
    as **not built yet** (its own README's "Not built yet" section), and there's no
    Vapi assistant config or Claude prompt code anywhere in the repo - just the data
    layer + a `verify_student` flow (`../voice-agent-service/src/verify-student`,
    calls the ERP's `GET /voice-integration/lookup-student`) and a fully documented
    conversation-branching doc (`docs/caller-verification-flow.md`). Milestone 10c
    below is therefore the first real "AI brain" wired to any of this.

    **Voice pipeline choice** (discussed at length with the user in Roman Urdu -
    they asked for real pricing, not assumptions): **Deepgram for both STT and TTS**
    (direct plugin, own API key) + **Claude** (Anthropic plugin) for the LLM - not
    ElevenLabs (2-3x more expensive per the researched 2026 pricing, ~$30/1M chars
    for Deepgram Aura-2 vs ~$50-100/1M for ElevenLabs) and not OpenAI Realtime
    (would mean a non-Claude "brain", inconsistent with the rest of the project).

    - **New duty added to `voice-agent-service`**: `CallbackRequest` model +
      `callback-requests` module (`dto/create-callback-request.dto.ts`,
      `update-callback-request-status.dto.ts`, `.service.ts`, `.controller.ts`,
      `.module.ts`, registered in `app.module.ts`) - `CallbackChannel` enum
      (`PHONE_AI` / `IN_APP_AI`) so the SAME table serves both the existing phone
      assistant and the new in-app one. Maps to prompt-library tool `request_callback`.
      README's endpoint table updated with this row + an explanatory paragraph.
    - **ERP backend (`school-management-system/backend`) additions**:
      - `ChatCall` gained `aiJoined Boolean @default(false)` / `aiDispatchedAt
        DateTime?` (prevents dispatching the AI twice for the same call).
      - `livekit.service.ts`: added `participantCount(roomName)` (returns 0 on any
        error so callers don't need try/catch) and `dispatchAgent(roomName,
        agentName, metadata)` using `livekit-server-sdk`'s `AgentDispatchClient`
        (verified the exact `createDispatch(roomName, agentName, {metadata})`
        signature against LiveKit's live docs before writing this, since the
        framework's API surface moves fast).
      - `chat-call.service.ts`: new private config getters (`aiFallbackEnabled` -
        reads `AI_FALLBACK_ENABLED==='true'`, **defaults OFF** so nothing breaks
        before `voice-ai-agent` is actually deployed; `aiFallbackTimeoutMs` - reads
        `AI_FALLBACK_TIMEOUT_SECONDS`, default 45s; `aiAgentName` - reads
        `LIVEKIT_AI_AGENT_NAME`, default `"school-ai-receptionist"`) and
        `isAiFallbackEligible(threadType)` - **scoped to DIRECT (1:1) threads only**
        for now, a deliberate, disclosed choice (group/broadcast calls already have
        several humans who might answer; widening this later is easy but wasn't
        asked for). `scheduleAiFallback(callId, threadId)` fires a `setTimeout` from
        inside `joinCall()`'s "new call" branch - re-reads the call/thread/LiveKit
        participant count from scratch when it fires (never trusts closure state,
        since 45 seconds is a long time), and if still empty: looks up the school
        name + the caller's (`call.startedById`) `fullName`/`phone` from `User` to
        build the dispatch metadata JSON (`threadId, callId, roomName, schoolId,
        schoolName, branchId, threadTitle, threadType, callerName, callerPhone`),
        calls `dispatchAgent()`, flips `aiJoined`, and posts a "🤖 No one answered -
        the AI assistant has joined the call" system chat message. Also added two
        service-facing methods used only by the AI worker (never by a browser):
        `postAiMessage(callId, body)` (posts the AI's spoken replies into the thread
        as a normal-looking message, attributed to whoever started the call - no
        dedicated "AI" user account exists) and `endCallByAgent(callId, transcript?,
        summary?)` (same ENDED/endRoom/broadcast sequence as a human hanging up).
      - New `ai-fallback.controller.ts` (`@Controller('chat/ai')`, protected by the
        **existing** `ServiceApiKeyGuard`/`VOICE_AGENT_INTEGRATION_KEY` - reused
        deliberately rather than adding a third shared secret, since it's the exact
        same trust boundary as `voice-integration`: "a backend service we run, not a
        person with a JWT"): `POST /chat/ai/messages`, `POST /chat/ai/end-call`.
        New DTOs `dto/ai-post-message.dto.ts`, `dto/ai-end-call.dto.ts`. Registered
        in `chat.module.ts`.
    - **New service: `school-management-system/voice-ai-agent/`** (Python, NOT
      NestJS - LiveKit's Agents framework is Python-first, so this is intentionally
      a separate small service, same pattern as `voice-agent-service` being kept out
      of the main ERP codebase). Verified the current (2026) LiveKit Agents API
      surface directly against live docs before writing any of this (framework
      moves fast - `AgentServer()` + `@server.rtc_session(agent_name=...)` +
      `agents.cli.run_app(server)` is the *current* pattern, replacing the older
      `WorkerOptions(entrypoint_fnc=...)` style):
      - `clients/voice_agent_client.py`: thin async HTTP wrapper (using the shared
        `utils.http_context.http_session()` LiveKit gives every job) over every
        `voice-agent-service` duty endpoint, including the new
        `request_callback()`.
      - `clients/erp_client.py`: thin async HTTP wrapper over just the two new
        `/chat/ai/*` ERP routes (`post_message`, `end_call`).
      - `agent.py`: `ReceptionistAgent(Agent)` - one instance per dispatched call,
        holds whatever gets learned mid-call (`erp_student_id`, `admission_no`,
        `verification_status`, `last_admission_lead_id`) so later tool calls in the
        same conversation don't need to re-verify. Tools (all `@function_tool()`
        methods, one per duty): `verify_student`, `log_complaint`, `request_leave`,
        `report_absence`, `log_admission_inquiry`, `book_campus_tour`,
        `log_feedback`, `request_appointment`, `check_schedule`, `check_calendar`,
        **`request_callback`** (the fallback - instructions explicitly tell Claude
        to never guess/invent an answer outside these 9 things or outside what it
        actually knows, and to use this tool instead), and `end_call` (posts a
        summary back into chat via `erp_client`, logs a `CallLog` via
        `voice_agent_client`, then ends the call via `erp_client` - all
        best-effort/non-fatal if any one step fails). Entrypoint parses the LiveKit
        job's dispatch metadata (`ctx.job.metadata`, JSON) built by
        `scheduleAiFallback()` above, refuses to join if `callId` is missing, builds
        the pipeline (`deepgram.STT(model="nova-3")`, `anthropic.LLM(model=
        "claude-sonnet-4-6")`, `deepgram.TTS(model="aura-2-asteria-en")`,
        `silero.VAD.load()`), starts the session, and greets the caller explaining
        nobody at the office could take the call.
      - `requirements.txt` (`livekit-agents[anthropic,deepgram,silero]~=1.6`),
        `Dockerfile` (same deploy pattern as `voice-agent-service` - own Railway
        service), `.env.example`, `README.md` (explains the full dispatch flow,
        explicit reminder that `AI_FALLBACK_ENABLED` must be flipped to `"true"` on
        the **backend** only after this worker is actually deployed and registered).
    - **Explicit dispatch, not automatic**: this worker does NOT join every LiveKit
      room - it only joins when the ERP calls the Agent Dispatch API after its
      45-second fallback timer. This was a deliberate design choice (automatic
      dispatch is LiveKit's own documented anti-pattern for production use, and would
      mean paying for/running the AI on every single call, answered or not).
    - **Nothing in this milestone can be tested or deployed this session** (bash
      sandbox still down) - written entirely from directly-verified LiveKit/Deepgram/
      Anthropic-plugin documentation rather than from memory, given how fast that
      framework's API surface changes, but still unverified by any actual run.
      Before flipping `AI_FALLBACK_ENABLED=true` in production: deploy
      `voice-ai-agent` as its own Railway service, set all the env vars listed in its
      README, register it with LiveKit Cloud, then test via a real in-app DIRECT
      call before trusting it with real callers.
    **10d - AI meeting notetaker: ✅ DONE (code only).** Opt-in (not a fallback) -
    whoever starts a call ticks "Enable AI notetaker" and it joins immediately,
    silently, alongside them. Reuses the SAME `voice-ai-agent` worker process as
    10c (one Railway service, two dispatch names) rather than a separate service,
    per the plan noted in 10c's README.

    - **Prisma**: `ChatCall.notetakerJoined Boolean @default(false)` (separate
      concept from 10c's `aiJoined` - deliberately not reused, since confusing an
      opt-in notetaker dispatch with a fallback-receptionist dispatch would make
      the "did the AI already join?" checks in both flows unreliable). The
      `transcript`/`summary` fields (added in 10b, unused until now) are what the
      notetaker fills in.
    - **Backend**: `chat-call.service.ts` gained `notetakerAgentName` getter
      (`LIVEKIT_NOTETAKER_AGENT_NAME`, default `"school-ai-notetaker"`) and
      `dispatchNotetaker()` - immediate, no-timeout dispatch (unlike
      `scheduleAiFallback()`'s 45s wait), called from `joinCall()` right after a
      NEW call is created, only when the caller passed `withNotetaker: true`.
      Posts a "📝 AI notetaker has joined..." system message. New
      `JoinCallDto` (`withNotetaker?: boolean`) - `chat.controller.ts`'s
      `POST /chat/threads/:id/call/join` now accepts a body. New
      `ChatCallService.saveNotetakerOutput(callId, transcript, summary)` -
      deliberately does NOT touch call status/end the room (the notetaker only
      ever records what was said, never controls the call) - just saves
      transcript/summary and posts the summary into the thread as a normal
      "📝 Meeting notes: ..." chat message, which is also how users "view" past
      notes - no separate viewer UI was needed, the summary just shows up in the
      conversation automatically. New DTO `dto/ai-notetaker-finalize.dto.ts`, new
      route `POST /chat/ai/notetaker/finalize` on the existing (10c)
      `ai-fallback.controller.ts` - same `ServiceApiKeyGuard` trust boundary.
    - **Frontend**: `ChatPage.tsx` - a small "Enable AI notetaker" checkbox next to
      the Start Call button (only shown before a call exists), passed as
      `withNotetaker` on the join mutation; while a notetaker is active, a small
      "AI notetaker on" indicator (`NotebookPen` icon) appears next to "Call in
      progress". `ChatCallStatus` type gained `notetakerJoined: boolean`.
    - **`voice-ai-agent` restructured** to cleanly serve both 10c and 10d from one
      process: new `server.py` (just `server = AgentServer()`, imported by both),
      `receptionist.py` (10c's `ReceptionistAgent` + entrypoint, moved out of the
      old `agent.py` unchanged), new `notetaker.py` (10d), and `agent.py` slimmed
      down to just import both (registers their `@server.rtc_session` handlers as
      an import side-effect) and call `agents.cli.run_app(server)`.
    - **`notetaker.py`** - explicitly flagged in its own docstring and the
      project README as **the least-verified code in this milestone**: it does
      NOT use the higher-level `AgentSession` (that assumes one conversational
      "user", which doesn't fit a silent multi-participant transcriber). Instead
      it uses LiveKit's lower-level APIs directly - `ctx.connect(auto_subscribe=
      AUDIO_ONLY)`, a `track_subscribed` room event handler that spins up one
      `ParticipantTranscriber` per remote participant (own `deepgram.STT(model=
      "nova-3", language="multi")` stream, `rtc.AudioStream(track)` pushed frame-
      by-frame via `stt_stream.push_frame()`, collecting `FINAL_TRANSCRIPT` events
      into a shared, speaker-labeled `transcript_lines` list), a
      `participant_disconnected` handler that waits 5s after the room empties out
      (debounce against flaky reconnects, not an actual meeting end) before
      finalizing, AND a `ctx.add_shutdown_callback(finalize)` safety net in case
      the job gets torn down some other way first. `finalize()` calls Claude
      **directly** via the raw `anthropic` Python SDK (`AsyncAnthropic().messages
      .create(...)`, model `claude-sonnet-4-6`) with a fixed summarization prompt
      - deliberately NOT through the `livekit-plugins-anthropic` conversational
      LLM wrapper, since summarizing a finished transcript once is a different
      shape of call than a turn-taking chat loop - then posts the result via
      `erp_client.finalize_notes()`. **Must be tested against LiveKit's current
      `livekit.rtc`/STT-streaming docs and a real multi-person room (e.g. via
      LiveKit's Agent Console) before trusting it in production** - this was
      written from directly-fetched docs this session but never executed (bash
      sandbox down all session).
    - `requirements.txt` gained a direct `anthropic~=0.40` dependency (used only by
      `notetaker.py`'s one-shot summarization call, as above).
    **10e - Real PSTN call bridging: NOT STARTED.**

    `CommunicationModule` (separate, pre-existing module) still only handles
    Messages/Notifications/Announcements - the new `ChatModule` is intentionally
    separate rather than folded into it, since real-time chat has a fundamentally
    different data model (threads/members/live delivery) from the old one-shot
    Message model.

## What to do first in a new session

1. Read this file.
2. Check whether `mcp__workspace__bash` is working yet (it was down with
   `VM_DISK_SPACE_INSUFFICIENT` as of 2026-08-25 — if it's back, that's the moment to
   finally `git add/commit/push` everything accumulated under "Feature-gap roadmap"
   above and verify the Railway/Vercel deploys succeed, including running the pending
   Prisma migration for `TeacherProfile.photoUrl`). If it's still down, don't keep
   re-checking it every session — just keep building the next milestone in the list,
   per the user's explicit instruction.
3. If bash is fine and nothing above is blocking, continue the milestone list in
   order (Admissions CRM is next) rather than re-asking the user what to do —
   they've already said to go one-by-one without stopping for confirmation each time.
4. Ask the user what's next from the "Pending feature requests" list above only if the
   milestone roadmap is fully done, or whether priorities changed.
5. For anything touching live student/staff data or account/permission structure,
   confirm specifics with the user before executing (this is a real school with real
   students) — dry-run/verify first if it's a direct database operation.
