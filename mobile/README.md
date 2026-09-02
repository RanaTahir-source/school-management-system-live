# DAS Connect (mobile app)

Student/parent self-service app: login, fee status + receipts, attendance history, exam results + report card PDFs. Built with Expo (React Native) so it shares the same login/JWT backend as the web portal.

## First-time setup (run these on your own machine, not in this chat)

```
cd mobile
npm install
copy .env.example .env
```

Edit `.env` and set `EXPO_PUBLIC_API_URL` to your backend's URL, for example:

```
EXPO_PUBLIC_API_URL=https://dar-e-arqam-sms.onrender.com/api
```

If `npm install` prints peer-dependency warnings about package versions, run:

```
npx expo install --fix
```

This lets Expo pick the exact package versions that match your installed Expo SDK, instead of the approximate versions in package.json.

## Running the app

```
npx expo start
```

Scan the QR code with the **Expo Go** app (Android/iOS) to test on your phone, or press `a` / `i` in the terminal for an emulator.

## Who can log in right now

Any existing school login works. **Student** and **Parent** accounts see the fee/attendance/results self-service screens; **Teacher** accounts see their timetable, attendance marking, and leave; **Principal/Admin/Director** accounts see a school stats snapshot, staff directory, and leave approvals. Any other role (Accountant, Receptionist, Coordinator, etc.) still gets a "not supported on mobile yet" placeholder for now.

**Parents** can log in with their own account (linked to one or more children via `ParentStudent`). One child: the menu goes straight to that child's Fee/Attendance/Results. Two or more children: "My Children" shows a card per child (single-single) plus a **Family Ledger** card with the combined fee total across all of them.

## What's built (v2)

- Login (JWT, auto-refresh, secure on-device token storage)
- Fee Status: invoices, balances, and receipt PDFs (view/share/save) - Student and Parent
- Attendance: month-by-month present/absent/late/leave history - Student and Parent
- Results: exam list + report card PDF (view/share/save) - Student and Parent
- Parent: multi-child list, per-child menu, and a combined Family Ledger (total charged/paid/balance across all linked children)
- Teacher: weekly timetable, mark attendance for the section(s) they're the class teacher of, apply for leave, view announcements
- Principal/Admin/Director: quick school stats (student/teacher counts, today's attendance %, pending leave), staff directory (search by name/employee ID), approve/reject leave requests, view announcements

## What's not built yet

- **Push notifications / notices** - needs a new backend module (device token registration + a Notice model + a send endpoint) before this can be wired up. Bigger scope, planned as a follow-up.
- **Entering exam marks and other admin tools on mobile** - still web portal only for now.

## Building a real app (APK / TestFlight)

Once you're happy testing in Expo Go, use [EAS Build](https://docs.expo.dev/build/introduction/) to produce an installable Android APK / iOS build:

```
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```
