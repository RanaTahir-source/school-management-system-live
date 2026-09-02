# School Mentor Feature List vs. Dar-e-Arqam SMS — Status Check (2026-09-01)

This updates the 2026-08-25 gap-check now that Milestones 1–10d have actual code
in the repo, and checks what is genuinely LIVE in production (app.nexoradsa.org /
api.nexoradsa.org) vs. what still needs a config step or was never started.

## ✅ Already live / matches School Mentor's list

- Bulk Excel import (Students & Teachers)
- Student & Teacher ID Card designer + batch print sheets + photo upload
- Admissions CRM (leads, follow-ups, sources, public enquiry form, convert-to-student)
- Online fee payment — proof-upload flow (JazzCash/EasyPaisa/Bank Transfer: family
  sends money, uploads a screenshot, staff approve) — live, no merchant account needed
- Inventory & POS + Assets Management (with profit/loss reporting, maintenance logs)
- Meetings Management, Staff Tasks, Suggestions Box (anonymous)
- 50-document Manuals/SOPs library (Academic/Admin/HR/Finance/Health&Safety/User manuals)
- Real-time Chat (direct, class/section groups, staff groups, broadcast) — Socket.io
- Video meetings/calls inside Chat threads — LiveKit (LiveKit env vars already set on Railway)
- AI Question Paper Generator + AI Lesson Plan Generator — code deployed
- Automated daily DB backup (cron + persistent Railway volume)
- System audit logs
- Role-based access control, fee structure/challan/receipts/defaulter reports,
  attendance, exams/results/report cards, homework, timetable, library, transport,
  hostel, payroll, announcements, parent portal, staff/teacher HR — all pre-existing
- Parent + Student mobile app (Expo/React Native) — Login, Home, Attendance, Fees,
  Results, Family Ledger (multi-child). An APK has already been built.

## ⚠️ Built in code but needs one more step before it actually works

1. **AI Tools (Question Paper + Lesson Plan generator) will fail in production right
   now** — checked Railway: `ANTHROPIC_API_KEY` is NOT set on the backend service.
   The page loads but "Generate" will return a 503. **Needs: an Anthropic API key
   from console.anthropic.com, then set as a Railway env var.**
2. **AI fallback receptionist (missed in-app call) + AI meeting notetaker** — the
   code exists (`voice-ai-agent/`, a separate Python service) but it has **never been
   deployed** — no such Railway service exists yet, and `AI_FALLBACK_ENABLED` is
   correctly left off. Needs: deploy `voice-ai-agent` as its own Railway service,
   set its env vars, register the agent with LiveKit Cloud, then flip
   `AI_FALLBACK_ENABLED=true` and test with a real call.
3. **Pending Prisma migrations** for several of the models above (ID cards' new
   `photoUrl` on TeacherProfile, Admissions, Online Payments, AI tools, Backup,
   Inventory/Assets, Meetings/Tasks/Suggestions, Manuals, Chat/Calls) — need to
   confirm these tables actually exist in the live production database (a
   `prisma migrate deploy` / `db push` should have run when this was last deployed,
   but this should be verified, not assumed).
4. **50 manuals need the seed script run** (`npm run seed:manuals`) against the
   production DB — migration alone creates an empty table.
5. Real card payments, and true JazzCash/EasyPaisa **API** (redirect) mode — schema
   is ready but no merchant credentials exist yet. Needs the user to obtain a
   JazzCash/EasyPaisa merchant account and/or a Stripe/PayFast account.
6. Real PSTN call bridging (Milestone 10e) — not started at all.

## ❌ Not built yet — genuine gaps against School Mentor's list

- **Teacher app & Principal app as native mobile screens** — only Parent/Student
  mobile screens exist; teachers/principals currently use the responsive web app only
  on mobile browsers, not a dedicated native app experience (mark attendance in 1 tap,
  assign homework, upload lesson plans, live attendance dashboard, staff HR overview,
  AI performance alerts on mobile, etc.)
- **General "Mentor AI" chat assistant** inside the platform (a free-form AI helper,
  distinct from the two specific generators already built)
- **Textbook scanning** (photograph a page → AI extracts content/generates questions)
- **AI Timetable Generator** (current Timetable module is manual entry, not an
  auto-scheduling algorithm)
- **Online Quiz Builder** for students to actually take a quiz in-app (the AI
  generators produce printable papers/worksheets, not an interactive quiz-taking flow)
- **Predictive AI analytics** — none of these 5 exist yet:
  - AI Fee Default Predictor (flags likely-to-miss-payment parents ~2 weeks ahead)
  - Attendance Anomaly Alerts (pattern detection + auto-alert to Principal)
  - Exam Risk Scoring (flags at-risk students ~3 months before exams)
  - Teacher Efficiency Analytics (lesson-plan/homework/quiz completion rates per teacher)
  - Auto Learning Reports (auto-generated monthly parent progress report)
- **Departments & Designations Management** (as its own structured module)
- **Houses / student-house system** (separate from academic Sections, which already exist)
- **Formal Accounts Manager / Chart of Accounts** (a real ledger with debit/credit
  entries) — Income/Expense records and Finance reports exist, but not double-entry
  bookkeeping
- **E-Tube style embedded video learning content** inside the app

## Notes

- "Native Android & iOS apps" and "SSL on every instance" and "separate isolated DB
  per school" are architecture-level items School Mentor markets — our system uses
  one shared Postgres DB with tenant scoping (School/Branch model) rather than a
  separate DB per school; SSL is already in place (Railway + Vercel both terminate
  HTTPS). This is a deliberate architectural difference, not an oversight — flagging
  it in case it matters for how the product is positioned to customers.
