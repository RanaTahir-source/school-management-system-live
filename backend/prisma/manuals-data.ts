// The 50-manual bundled Operational Manuals / SOPs library shipped with the
// product (schoolId: null in ManualDocument = visible to every school).
// Run `npx ts-node prisma/seed-manuals.ts` (or `npm run seed:manuals`) against
// the production database to load/refresh these - see seed-manuals.ts.
//
// Content here is intentionally concise and practical (a real SOP a school
// can actually follow) rather than exhaustive - schools/Directors can extend
// or override any of these with their own CUSTOM manuals through the
// Manuals Library UI once this is loaded.

export type ManualCategory =
  | 'ACADEMIC'
  | 'ADMINISTRATION'
  | 'HUMAN_RESOURCE'
  | 'FINANCE'
  | 'HEALTH_SAFETY'
  | 'USER_MANUAL'
  | 'CUSTOM';

export type ManualSeed = {
  slug: string;
  category: ManualCategory;
  title: string;
  summary: string;
  content: string;
};

export const MANUALS_SEED: ManualSeed[] = [
  // ── ACADEMIC (8) ──────────────────────────────────────────────────────
  {
    slug: 'lesson-planning-manual',
    category: 'ACADEMIC',
    title: 'Lesson Planning Manual',
    summary: 'How teachers prepare, submit, and get lesson plans approved before teaching.',
    content: `## Purpose
Ensure every class is taught from a written, approved plan aligned to the curriculum and academic calendar.

## Scope
All teaching staff, all classes/sections, every academic year.

## Procedure
1. Teachers prepare weekly lesson plans covering learning objectives, teaching method, resources needed, and an assessment/homework tie-in, at least 3 working days before the week begins.
2. Plans are submitted through the school's system (Homework/Timetable modules) or the format the Coordinator specifies.
3. The Subject Coordinator/Principal reviews plans for curriculum alignment and gives feedback within 2 working days.
4. Teachers revise and resubmit if changes are requested; approved plans are filed against that class/section/week.
5. Any deviation from an approved plan during the week (e.g. school event disruption) is noted and the plan is adjusted for the following week.
6. Lesson plans are retained for the full academic year for inspection/audit and used as input for Classroom Observation visits.

## Responsible Roles
Teacher (prepares), Subject Coordinator (reviews), Principal (final approval, spot-checks).`,
  },
  {
    slug: 'homework-management-manual',
    category: 'ACADEMIC',
    title: 'Homework Management Manual',
    summary: 'Consistent rules for assigning, submitting, and grading homework across classes.',
    content: `## Purpose
Keep homework purposeful, age-appropriate, and consistently tracked so parents and management can see it happening.

## Scope
All teaching staff and students, Playgroup through the senior classes (volume scaled by age group per school policy).

## Procedure
1. Teachers assign homework through the Homework module immediately after the relevant lesson, with a clear due date.
2. Daily homework load per student is capped per the school's age-band policy (set by the Principal) to avoid over-burdening.
3. Students/parents view assignments and due dates through the Student/Parent portal.
4. Teachers mark homework as reviewed/graded within 2 working days of the due date.
5. Repeated non-submission (3+ times in a term) triggers a note to the Class Teacher, who informs the parent.
6. Class Teachers spot-check homework diaries/portal entries weekly as part of routine monitoring.

## Responsible Roles
Subject Teacher (assigns/grades), Class Teacher (monitors patterns), Principal (sets load policy).`,
  },
  {
    slug: 'assessment-examination-manual',
    category: 'ACADEMIC',
    title: 'Assessment & Examination Manual',
    summary: 'Standard process for setting, conducting, and securing all school exams.',
    content: `## Purpose
Ensure exams are fair, secure, and consistent across classes and campuses.

## Scope
All formal assessments: class tests, monthly/term exams, and final/board-track exams.

## Procedure
1. The Exam Coordinator publishes the exam calendar (dates, subjects, syllabus coverage) at least 2 weeks before each exam cycle, via the Exams module.
2. Subject teachers submit question papers for review 1 week before the exam date (or use the AI Question Paper Generator as a drafting aid, always reviewed by the teacher before use).
3. Papers are checked for syllabus alignment, mark distribution, and difficulty balance by the Subject Coordinator.
4. Question papers are kept confidential - printed/copied only by authorized staff, stored securely until the exam.
5. Invigilation duty is assigned by the Exam Coordinator; invigilators follow the school's exam-hall conduct rules (seating, ID checks, no unauthorized material).
6. Any irregularity (malpractice, missing student, medical emergency) is logged immediately and escalated to the Principal.
7. Answer scripts are collected, counted, and handed to subject teachers under signature within the same day.

## Responsible Roles
Exam Coordinator (schedule, papers, security), Subject Teachers (paper setting, marking), Principal (irregularity escalation).`,
  },
  {
    slug: 'result-preparation-manual',
    category: 'ACADEMIC',
    title: 'Result Preparation Manual',
    summary: 'How marks are entered, verified, and turned into report cards.',
    content: `## Purpose
Guarantee that published results are accurate before they reach students and parents.

## Scope
All exams that produce a result card (term exams, finals).

## Procedure
1. Subject teachers enter marks into the Exams module within 3 working days of marking being complete.
2. A second person (Subject Coordinator or Exam Coordinator) cross-checks a sample of entries for transcription errors before results are finalized.
3. The system computes grades/GPA per the school's configured grading scale; any manual override requires Principal sign-off, logged in the audit trail.
4. Draft result cards are reviewed by Class Teachers for any student flags (e.g. incomplete subjects) before publishing.
5. Results are published to the Parent/Student portal and report cards are generated (PDF) only after this review is complete.
6. Any post-publication correction follows a formal correction request, approved by the Principal, with the change logged.

## Responsible Roles
Subject Teacher (marks entry), Exam/Subject Coordinator (verification), Class Teacher (final review), Principal (approvals, overrides).`,
  },
  {
    slug: 'student-performance-monitoring-manual',
    category: 'ACADEMIC',
    title: 'Student Performance Monitoring Manual',
    summary: 'How the school tracks academic trends and intervenes early for struggling students.',
    content: `## Purpose
Catch academic decline early and act on it, rather than waiting for the next exam.

## Scope
All enrolled students, ongoing throughout the academic year.

## Procedure
1. Class Teachers review each student's attendance, homework completion, and test scores monthly using the Reports module.
2. A student is flagged for follow-up if: 2+ consecutive tests below the pass threshold, attendance drops below 85%, or a subject teacher raises a concern directly.
3. Flagged cases are discussed at the monthly academic review meeting (see Meetings Management); an action plan is agreed (extra help, parent meeting, counseling referral).
4. The Class Teacher informs the parent of the concern and the plan, and logs the conversation.
5. Progress against the plan is re-checked at the next monthly review; escalate to the Principal if no improvement after two cycles.

## Responsible Roles
Subject Teachers (raise concerns), Class Teacher (owns the case), Principal/Coordinator (reviews escalations).`,
  },
  {
    slug: 'academic-calendar-manual',
    category: 'ACADEMIC',
    title: 'Academic Calendar Manual',
    summary: 'How the yearly academic calendar is planned, approved, and communicated.',
    content: `## Purpose
Give every stakeholder one reliable source of term dates, exams, holidays, and events for the year.

## Scope
The full academic year, all campuses/branches of the school.

## Procedure
1. The Principal drafts the academic year structure (term start/end, exam windows, holidays, major events) at least 4 weeks before the year begins, using the Academic Years module.
2. The Director/management committee reviews and approves the calendar.
3. Once approved, the calendar is locked in the system and classes/sections/subjects are set up against it.
4. The calendar is shared with parents/staff via Announcements and remains visible on the portal all year.
5. Any mid-year change (e.g. holiday shift, exam reschedule) requires Principal approval, is updated in the system, and is announced immediately - never communicated only verbally.

## Responsible Roles
Principal (drafts, maintains), Director (approves), Admin (publishes/announces changes).`,
  },
  {
    slug: 'classroom-observation-manual',
    category: 'ACADEMIC',
    title: 'Classroom Observation Manual',
    summary: 'Structured, fair process for observing and coaching teachers in the classroom.',
    content: `## Purpose
Support teaching quality through regular, constructive, non-punitive classroom observation.

## Scope
All teaching staff, at least once per term.

## Procedure
1. The Principal/Coordinator schedules observations in advance (not surprise visits, except for serious concerns) and shares the observation checklist beforehand.
2. During the visit, the observer notes: lesson plan adherence, student engagement, classroom management, and use of assessment.
3. A feedback conversation happens within 2 working days - strengths first, then 1-2 specific, actionable improvement points.
4. Observation notes are filed against the teacher's record and referenced at the next Performance Appraisal.
5. Where a serious concern is found (safety, conduct), it is escalated immediately per the Staff Discipline Manual rather than waiting for the feedback conversation.

## Responsible Roles
Principal/Academic Coordinator (observes, gives feedback), Teacher (receives feedback, follows up).`,
  },
  {
    slug: 'curriculum-implementation-manual',
    category: 'ACADEMIC',
    title: 'Curriculum Implementation Manual',
    summary: 'How the chosen curriculum/syllabus is rolled out consistently across classes.',
    content: `## Purpose
Make sure every section of the same class covers the same syllabus to the same depth.

## Scope
All subjects, all classes, all branches of the school.

## Procedure
1. The Academic Coordinator maps the approved syllabus to the Academic Calendar (which chapters/topics in which weeks) before the term starts, recorded in the Classes/Subjects setup.
2. Subject teachers of the same class level align lesson plans to this map; cross-section consistency is checked at monthly subject meetings.
3. Any gap (a topic consistently skipped or rushed) identified via lesson plan review or exam results triggers a syllabus-pacing review.
4. Curriculum changes (new textbook, revised syllabus) are approved by the Principal/Director and rolled out with teacher briefing before the term they apply to.

## Responsible Roles
Academic Coordinator (mapping, consistency checks), Subject Teachers (execution), Principal (change approval).`,
  },

  // ── ADMINISTRATION (8) ────────────────────────────────────────────────
  {
    slug: 'student-admission-manual',
    category: 'ADMINISTRATION',
    title: 'Student Admission Manual',
    summary: 'End-to-end admission process, from enquiry to enrolled student.',
    content: `## Purpose
Convert enquiries into enrolled students through a consistent, documented process.

## Scope
All new admissions and re-admissions, all classes.

## Procedure
1. Enquiries are logged in the Admissions CRM (walk-in, phone, or the public online enquiry form) immediately, with source recorded.
2. Reception/Admissions staff schedule a school visit or test (if applicable) and log every follow-up conversation against the enquiry.
3. Required documents (birth certificate/B-Form, previous school leaving certificate, photos, CNIC copies of parents) are collected and checked against the school's admission checklist.
4. Seat availability is confirmed against the class/section capacity before an offer is made.
5. On acceptance, the Admissions team converts the enquiry directly into a Student record (linking back to the original enquiry for source tracking) and generates the fee invoice for admission fee/first term.
6. The family is added to the Parent Portal and given login access.

## Responsible Roles
Receptionist/Admissions staff (enquiry handling, documents), Principal (test/interview decisions where used), Accountant (admission fee invoicing).`,
  },
  {
    slug: 'student-withdrawal-manual',
    category: 'ADMINISTRATION',
    title: 'Student Withdrawal Manual',
    summary: 'Clean, documented process for a student leaving the school.',
    content: `## Purpose
Ensure withdrawals are properly recorded, dues are settled, and records are handed over correctly.

## Scope
Any student leaving before graduating (transfer, relocation, etc.).

## Procedure
1. Parent submits a written withdrawal request (or email/portal message) stating the last date of attendance.
2. Accounts confirms all fee dues are cleared (or a settlement plan is agreed) before documents are released.
3. Library/Hostel/Transport clear any outstanding issues (books returned, hostel/transport dues settled).
4. The school issues a School Leaving Certificate and academic transcript once clearances are complete.
5. The student's enrollment status is updated (not deleted - kept as an inactive/withdrawn record for audit) and portal access is disabled.
6. The seat is released and may be offered to the next admission enquiry in the pipeline.

## Responsible Roles
Admissions/Admin staff (paperwork, certificate), Accountant (dues clearance), Librarian/Transport (clearances).`,
  },
  {
    slug: 'parent-communication-manual',
    category: 'ADMINISTRATION',
    title: 'Parent Communication Manual',
    summary: 'How and when the school communicates with parents, and through which channel.',
    content: `## Purpose
Keep communication with parents timely, consistent, and appropriately channeled.

## Scope
All staff-to-parent communication regarding academics, conduct, fees, and events.

## Procedure
1. Routine updates (homework, attendance, results, fee due) go through the Parent Portal/app and Announcements - not ad hoc phone calls, so there's a record.
2. Academic or behavioral concerns about a specific child are first raised by the Class Teacher directly with the parent (call or portal message), documented afterward.
3. School-wide notices (holidays, events, policy changes) are issued only through Announcements, approved by the Principal before posting.
4. Urgent/safety matters use the fastest available channel immediately (phone call first), followed by a written record.
5. Parent-initiated queries/complaints are logged and routed per the Complaint Handling Manual, not handled informally and forgotten.

## Responsible Roles
Class Teachers (day-to-day contact), Principal (approves school-wide notices), Admin (manages portal/Announcements).`,
  },
  {
    slug: 'school-event-management-manual',
    category: 'ADMINISTRATION',
    title: 'School Event Management Manual',
    summary: 'Planning checklist for school events (sports day, annual function, parent-teacher meetings).',
    content: `## Purpose
Run school events safely and smoothly with clear ownership of each task.

## Scope
Any school-wide or class-wide event outside the normal daily schedule.

## Procedure
1. Event is proposed and added to the Academic Calendar at least 3 weeks ahead (more for large events); Principal/Director approves.
2. An event owner is assigned who plans logistics: venue, schedule, staff duty roster, safety/first-aid coverage, and a parent-notification plan.
3. Announcements go out to parents at least 1 week before, with any action needed (permission slips, dress code, timing changes).
4. On the day: attendance/safety headcount is taken as students arrive and leave the event area; any incident is logged per the Crisis Management Manual.
5. After the event, the owner records a short debrief (what worked, what to change next time) for future reference.

## Responsible Roles
Event Owner (assigned by Principal), all on-duty staff (per roster), Admin (announcements/logistics support).`,
  },
  {
    slug: 'record-keeping-manual',
    category: 'ADMINISTRATION',
    title: 'Record Keeping Manual',
    summary: 'What records the school keeps, for how long, and how they are secured.',
    content: `## Purpose
Keep student, staff, and financial records accurate, secure, and available when needed (audits, transfers, legal requirements).

## Scope
All student academic/admission records, staff HR files, and financial documents.

## Procedure
1. All core records (admission documents, attendance, results, fee history) are maintained in the school system as the primary record - not only on paper.
2. Physical documents (original certificates, signed forms) are filed in locked storage, indexed by student/employee ID, accessible only to authorized Admin staff.
3. Digital records are backed up automatically every night (see the system's automated backup); Admin verifies backup status weekly.
4. Records are retained per policy: student academic records permanently, staff HR files for the duration of employment plus 3 years, financial records per the school's audit/tax retention requirement.
5. Access to sensitive records (medical info, disciplinary history) is restricted by role - Audit Logs track who viewed/changed what.

## Responsible Roles
Admin/Records staff (filing, retention), IT/System Admin (backups), Principal (access-exception approvals).`,
  },
  {
    slug: 'visitor-management-manual',
    category: 'ADMINISTRATION',
    title: 'Visitor Management Manual',
    summary: 'How visitors are logged, verified, and escorted on campus.',
    content: `## Purpose
Know who is on campus at all times and keep students safe from unauthorized access.

## Scope
Any non-staff, non-student adult entering school premises during school hours.

## Procedure
1. Every visitor reports to Reception first; ID is checked and the visit purpose is logged (paper register or Hostel Visitor module where applicable).
2. Visitors are issued a visible visitor badge and are not permitted beyond common areas without an escort.
3. A parent collecting a child outside normal pick-up must be verified against the authorized-pickup list before the child is released.
4. Vendors/contractors are logged separately with the work they're performing and are supervised while on site.
5. Reception reviews the visitor log daily; anything unusual is reported to the Principal.

## Responsible Roles
Receptionist/Security guard (logging, badges), Class Teacher (verifies pickup authorization), Principal (daily review, exceptions).`,
  },
  {
    slug: 'complaint-handling-manual',
    category: 'ADMINISTRATION',
    title: 'Complaint Handling Manual',
    summary: 'A consistent path for handling complaints from parents, staff, or students.',
    content: `## Purpose
Make sure every complaint is heard, tracked, and resolved - not lost informally.

## Scope
Complaints from parents, students, or staff about any aspect of school operations.

## Procedure
1. Complaints can be raised in person, by phone/portal message, or anonymously through the Suggestions Box.
2. Every complaint is logged with date, nature, and who raised it (or marked anonymous) - never handled purely verbally with no record.
3. The relevant owner (Class Teacher for academic concerns, Accountant for fee disputes, Principal for conduct/policy issues) responds within 3 working days.
4. Serious complaints (safety, harassment, financial impropriety) are escalated immediately to the Principal/Director, bypassing the normal queue.
5. The resolution and any action taken is recorded and communicated back to the complainant.
6. Recurring complaint themes are reviewed monthly by management to identify systemic issues, not just one-off fixes.

## Responsible Roles
Front-line staff (log and first response), Principal (escalations, monthly theme review).`,
  },
  {
    slug: 'transport-management-manual',
    category: 'ADMINISTRATION',
    title: 'Transport Management Manual',
    summary: 'Safe, organized operation of the school's own transport/van service.',
    content: `## Purpose
Run student transport safely, on time, and with clear accountability for every child on every route.

## Scope
All school-operated vehicles, drivers, and routes.

## Procedure
1. Routes and stops are defined and maintained in the Transport module; each student is allocated to exactly one route/stop.
2. Drivers are verified (license, background check) before assignment and re-checked annually.
3. A staff member or the driver takes attendance as students board/alight, matched against the allocation list - discrepancies are reported to the Transport Coordinator same-day.
4. Vehicles undergo a documented safety/maintenance check on a fixed schedule (monthly at minimum); defects ground the vehicle until fixed.
5. Any incident (breakdown, accident, delay beyond 20 minutes) is reported immediately to the Transport Coordinator, who informs affected parents.
6. Route/fee changes are approved by the Principal/Accountant and communicated to affected families in advance.

## Responsible Roles
Transport Coordinator (routes, allocation, incidents), Drivers (daily attendance, vehicle checks), Accountant (transport fee billing).`,
  },

  // ── HUMAN RESOURCE (8) ────────────────────────────────────────────────
  {
    slug: 'recruitment-hiring-manual',
    category: 'HUMAN_RESOURCE',
    title: 'Recruitment & Hiring Manual',
    summary: 'Fair, documented process for hiring teaching and non-teaching staff.',
    content: `## Purpose
Hire the right people through a consistent, documented, and fair process.

## Scope
All teaching and non-teaching staff positions.

## Procedure
1. The hiring manager (Principal for teaching staff, Director/Admin for others) defines the role, qualifications, and salary band before advertising.
2. Applications are collected and shortlisted against the stated criteria - shortlisting notes are kept, not just a verbal decision.
3. Shortlisted candidates are interviewed by at least two staff members; a simple scoring/notes sheet is used for consistency.
4. Reference checks are completed before an offer is extended.
5. A written offer (role, salary, start date, probation terms) is issued and accepted in writing before the candidate starts.
6. On acceptance, HR/Admin creates the staff record in the system and hands off to the Teacher/Staff Onboarding process.

## Responsible Roles
Hiring Manager (defines role, interviews), Admin/HR (advertising, offer letter, records), Principal/Director (final approval).`,
  },
  {
    slug: 'teacher-onboarding-manual',
    category: 'HUMAN_RESOURCE',
    title: 'Teacher Onboarding Manual',
    summary: 'First-week checklist to get a new teacher fully set up and supported.',
    content: `## Purpose
Get new teachers productive quickly and clear on expectations from day one.

## Scope
All newly joined teaching staff, first 4 weeks of employment.

## Procedure
1. Before the first day: staff account is created in the system, class/section/subject assignments are set, and a mentor teacher is assigned.
2. Day one: orientation covering the school's policies (this manual library), curriculum expectations, the Lesson Planning process, and system training (attendance, homework, exams modules).
3. Week one: the mentor teacher shadows/is shadowed at least twice, and answers day-to-day questions.
4. End of week two: the Principal/Coordinator checks in on how lesson planning and classroom management are going.
5. End of probation period (per contract, typically 3 months): a formal review is held, feeding into the Performance Appraisal process, with a clear confirm/extend/exit decision.

## Responsible Roles
Principal/Coordinator (orientation, check-ins), Mentor Teacher (day-to-day support), HR/Admin (system setup).`,
  },
  {
    slug: 'employee-attendance-manual',
    category: 'HUMAN_RESOURCE',
    title: 'Employee Attendance Manual',
    summary: 'How staff attendance is marked, monitored, and tied to payroll.',
    content: `## Purpose
Keep an accurate, fair record of staff attendance that both staff and management can trust.

## Scope
All teaching and non-teaching staff.

## Procedure
1. Staff attendance is marked daily through the Staff Attendance module (or biometric/QR where installed), by the staff member or a designated marker.
2. Late arrivals and early departures are recorded, not just present/absent - repeated lateness (3+ times a month) is flagged to the Principal.
3. Uninformed absence (no leave request on file) is followed up by the Principal/HR the same day.
4. Monthly attendance summaries feed directly into Payroll processing - unpaid leave/absences are deducted per the school's policy.
5. Attendance records are available to the staff member themselves at all times for transparency, and are retained for the full employment period.

## Responsible Roles
Staff (mark own attendance where self-service), Principal/HR (monitor, follow up), Accountant (payroll deduction application).`,
  },
  {
    slug: 'leave-management-manual',
    category: 'HUMAN_RESOURCE',
    title: 'Leave Management Manual',
    summary: 'How staff request, approve, and track leave of all types.',
    content: `## Purpose
Handle leave requests fairly, consistently, and with enough notice to arrange cover.

## Scope
All staff leave types: casual, sick, and any school-specific leave category.

## Procedure
1. Staff submit leave requests through the Leave module as early as possible (same-day for sick leave, at least 3 working days ahead for planned leave).
2. The Principal (for teachers) or Director/HR (for other staff) reviews and approves/rejects with a reason, considering coverage/substitute-teacher availability.
3. Approved leave is reflected automatically in attendance records and the timetable substitution plan.
4. Leave balances (per the school's policy, e.g. annual casual/sick leave entitlement) are tracked in the system and visible to the staff member.
5. Leave taken without prior approval (except genuine emergencies) is treated as unauthorized absence per the Staff Discipline Manual.

## Responsible Roles
Staff (request leave), Principal/HR (approve, arrange cover), Accountant (unpaid-leave payroll impact).`,
  },
  {
    slug: 'performance-appraisal-manual',
    category: 'HUMAN_RESOURCE',
    title: 'Performance Appraisal Manual',
    summary: 'Structured, once/twice-yearly review of every staff member's performance.',
    content: `## Purpose
Give every staff member fair, structured feedback and a documented performance history.

## Scope
All staff, at least once per academic year (teaching staff ideally each term-end).

## Procedure
1. Inputs are gathered ahead of the appraisal: Classroom Observation notes (for teachers), attendance record, student performance trends for their classes, and any complaints/commendations on file.
2. The Principal/Director holds a one-to-one appraisal meeting, discussing strengths, areas to improve, and agreeing 2-3 concrete goals for the next period.
3. The appraisal is documented (a simple written summary is sufficient) and signed by both parties; disagreements are noted, not suppressed.
4. Appraisal outcomes inform decisions on increments, role changes, or a Professional Development plan.
5. Consistently low appraisal outcomes (two consecutive periods) trigger a formal improvement plan before any disciplinary step is considered.

## Responsible Roles
Principal/Director (conducts appraisal), Staff member (self-review input, sign-off), HR/Admin (records the outcome).`,
  },
  {
    slug: 'staff-discipline-manual',
    category: 'HUMAN_RESOURCE',
    title: 'Staff Discipline Manual',
    summary: 'A fair, staged process for addressing staff conduct issues.',
    content: `## Purpose
Handle conduct/performance issues fairly, consistently, and with a clear paper trail.

## Scope
All staff; does not cover student discipline (separate school policy).

## Procedure
1. Minor issues (e.g. repeated lateness, missed deadlines) start with a verbal counseling conversation from the direct supervisor, noted informally.
2. If unresolved, a written warning is issued, specifying the issue, expected change, and timeframe, copied to the staff file.
3. Serious misconduct (safety breach, dishonesty, harassment, financial impropriety) goes straight to a formal investigation led by the Principal/Director, with the staff member given a chance to respond before any decision.
4. Outcomes (warning, suspension, termination) follow the school's employment contract terms and applicable labor law; all decisions are documented.
5. An appeal path exists: the staff member may request review by the Director if they believe the process was unfair.

## Responsible Roles
Direct Supervisor (informal step), Principal/Director (formal process, decisions), HR/Admin (documentation).`,
  },
  {
    slug: 'professional-development-manual',
    category: 'HUMAN_RESOURCE',
    title: 'Professional Development Manual',
    summary: 'How training needs are identified and delivered across the year.',
    content: `## Purpose
Keep staff skills current and directly tied to what the school actually needs.

## Scope
All teaching and non-teaching staff.

## Procedure
1. Training needs are identified from three sources: Performance Appraisals, Classroom Observation feedback, and staff self-nomination.
2. The Principal/Director sets a termly training calendar (workshops, subject-specific training, system/ERP refreshers) and communicates it via Announcements.
3. Attendance at mandatory training is tracked; staff who miss a session are scheduled for a make-up session.
4. New system features (as the ERP evolves) are rolled out with a short training session before staff are expected to use them.
5. Training completion is noted in the staff record and considered at the next appraisal.

## Responsible Roles
Principal/Director (sets calendar), Coordinators (deliver subject training), HR/Admin (tracks attendance/records).`,
  },
  {
    slug: 'employee-exit-procedure-manual',
    category: 'HUMAN_RESOURCE',
    title: 'Employee Exit Procedure Manual',
    summary: 'Clean handover and clearance process when a staff member leaves.',
    content: `## Purpose
Ensure a smooth handover and proper closure when employment ends, for any reason.

## Scope
Resignation, contract end, or termination of any staff member.

## Procedure
1. Resignation is submitted in writing with the required notice period per contract; HR acknowledges and confirms the last working day.
2. A handover plan is agreed with the supervisor: class/section reassignment (for teachers), pending tasks, and access to shared materials.
3. Final dues (salary, any outstanding reimbursements, gratuity/severance per policy and law) are calculated by Accounts and settled by or before the last working day.
4. System access is deactivated on the last working day (Users module) - not before, unless the exit is for cause.
5. An exit conversation is held (optional but recommended) to capture honest feedback about the workplace.
6. The staff record is retained (deactivated, not deleted) for the required retention period.

## Responsible Roles
HR/Admin (handover, deactivation), Accountant (final settlement), Direct Supervisor (handover plan).`,
  },

  // ── FINANCE (8) ───────────────────────────────────────────────────────
  {
    slug: 'fee-collection-manual',
    category: 'FINANCE',
    title: 'Fee Collection Manual',
    summary: 'How fee invoices are generated, collected, and receipted.',
    content: `## Purpose
Collect fees accurately, on schedule, and with a clean audit trail for every rupee.

## Scope
All student fee categories: tuition, admission, transport, hostel, exam fees, etc.

## Procedure
1. Fee structures per class/category are set up at the start of the academic year in the Finance module and approved by the Director.
2. Invoices are generated automatically each billing cycle (monthly/term, per school policy) against every active student.
3. Parents pay via the accepted channels: cash/bank at the school counter (receipted immediately), or online via the Pay Online flow (JazzCash/EasyPaisa/bank transfer with proof upload, reviewed and approved by Accounts before it posts).
4. Every payment - cash or online - produces a numbered receipt, printed or downloadable from the Parent Portal.
5. Concessions/scholarships are applied only with the documented approval on file (see Fee Recovery Manual for overdue handling).
6. Daily cash collection is reconciled and deposited per the Cash Book procedure before end of day.

## Responsible Roles
Accountant/Cashier (collection, receipts), Accounts staff (online payment review/approval), Director (fee structure, concession approval).`,
  },
  {
    slug: 'fee-recovery-manual',
    category: 'FINANCE',
    title: 'Fee Recovery Manual',
    summary: 'A graduated, respectful process for following up on overdue fees.',
    content: `## Purpose
Recover overdue fees consistently while treating every family fairly and respectfully.

## Scope
Any invoice past its due date.

## Procedure
1. A gentle reminder (portal notice/message) goes out automatically once an invoice is 3-5 days overdue.
2. If unpaid after 2 weeks, the Class Teacher or Accounts sends a direct, courteous follow-up message.
3. If unpaid after 30 days, Accounts contacts the parent directly to understand the situation and, where genuine hardship exists, discuss a payment plan or concession request (escalated to the Director for approval).
4. Persistent non-payment without communication (60+ days, no response) is escalated to the Principal/Director for a decision on further steps per school policy.
5. All reminders and conversations are logged against the family record so nobody is ever contacted twice with conflicting information.
6. Concessions or write-offs always require documented Director approval - never applied informally.

## Responsible Roles
Accountant (reminders, conversations), Class Teacher (first informal nudge where appropriate), Director (hardship decisions, write-offs).`,
  },
  {
    slug: 'expense-management-manual',
    category: 'FINANCE',
    title: 'Expense Management Manual',
    summary: 'How school expenses are requested, approved, recorded, and paid.',
    content: `## Purpose
Keep school spending controlled, approved in advance, and properly recorded.

## Scope
All operational expenses: supplies, maintenance, utilities, events, etc.

## Procedure
1. Any expense above the school's petty-cash threshold requires a request with reason and estimated cost, approved by the Director/Principal before commitment.
2. Approved expenses are recorded in the Finance module (Expense Records) with category, amount, and supporting invoice/receipt attached or filed.
3. Payment is made by cheque/bank transfer for larger amounts, cash only for small/petty items (see Petty Cash Management Manual).
4. Recurring expenses (utilities, rent) are reviewed at least annually for cost-effectiveness.
5. Monthly expense reports are reviewed by the Director as part of the Financial Reporting cycle.

## Responsible Roles
Requesting staff (raises request), Director/Principal (approval), Accountant (recording, payment).`,
  },
  {
    slug: 'budget-planning-manual',
    category: 'FINANCE',
    title: 'Budget Planning Manual',
    summary: 'Annual process for planning income and expense budgets.',
    content: `## Purpose
Plan the school's finances ahead of the year rather than reacting month to month.

## Scope
The full academic year's income (fees) and expense budget.

## Procedure
1. Accounts prepares a draft budget 1-2 months before the new academic year, based on prior-year actuals (Income/Expense Records) and known changes (enrollment projection, salary increments, planned expenses).
2. The Director reviews and approves the budget, including any planned fee structure changes.
3. The approved budget becomes the reference point for the year - actual income/expense is tracked against it monthly.
4. Significant variances (actual vs. budget beyond an agreed threshold) are investigated and explained in the monthly financial report.
5. Mid-year budget revisions are only made with Director approval and are documented alongside the original budget, not silently overwritten.

## Responsible Roles
Accountant (drafts, tracks variance), Director (approves budget and revisions).`,
  },
  {
    slug: 'payroll-processing-manual',
    category: 'FINANCE',
    title: 'Payroll Processing Manual',
    summary: 'Monthly cycle for calculating and paying staff salaries.',
    content: `## Purpose
Pay staff accurately and on time, every time, with a clear calculation trail.

## Scope
All staff on the school's payroll.

## Procedure
1. Each staff member's salary structure (basic pay, allowances, deductions) is set up in the Payroll module when they join and updated on any change (increment, role change).
2. At month-end, attendance/leave records are finalized first (Employee Attendance Manual) since they affect deductions.
3. Accounts generates payslips for the month, reviews for anomalies (e.g. an unexpectedly large deduction), and gets Director sign-off before disbursing.
4. Salaries are disbursed via bank transfer or cash, marked as paid in the system with the payment date and method.
5. Payslips are available to each staff member through their portal; discrepancies are raised within 5 working days of payment.
6. Statutory deductions/contributions (where applicable) are calculated and remitted per the relevant regulations.

## Responsible Roles
Accountant (payslip generation, disbursement), Director (sign-off), Staff (review own payslip).`,
  },
  {
    slug: 'financial-reporting-manual',
    category: 'FINANCE',
    title: 'Financial Reporting Manual',
    summary: 'What financial reports are produced, how often, and who reviews them.',
    content: `## Purpose
Give the Director/management a clear, regular view of the school's financial health.

## Scope
Monthly and annual financial reporting.

## Procedure
1. Accounts closes each month's Income and Expense Records within 5 working days of month-end.
2. A monthly report is produced (via the Reports/Finance module) covering: fee collection vs. billed, expense vs. budget, and outstanding receivables.
3. The Director reviews the report and flags any item needing explanation or action.
4. An annual financial summary is prepared at year-end for the Director/Audit Compliance process, reconciled against the Cash Book and bank statements.
5. All reports are retained per the Record Keeping Manual's financial-document retention rule.

## Responsible Roles
Accountant (prepares reports), Director (reviews, acts on findings).`,
  },
  {
    slug: 'petty-cash-management-manual',
    category: 'FINANCE',
    title: 'Petty Cash Management Manual',
    summary: 'Controls for small day-to-day cash spending.',
    content: `## Purpose
Allow small, routine purchases without bureaucracy, while keeping cash fully accounted for.

## Scope
Small expenses below the school's petty-cash threshold (set by the Director).

## Procedure
1. A fixed petty cash float is maintained by a designated custodian (usually the Accountant or Admin Officer).
2. Every disbursement requires a signed voucher stating purpose, amount, and recipient, with the receipt attached once the purchase is made.
3. The float is reconciled (cash on hand + vouchers = original float) at least weekly; any shortfall is investigated immediately.
4. The float is topped up only after all vouchers for the period are recorded in the Expense Records.
5. Petty cash is never used for salary payments, large purchases, or anything requiring formal approval under the Expense Management Manual.

## Responsible Roles
Petty Cash Custodian (day-to-day handling), Accountant (weekly reconciliation), Director (float size approval).`,
  },
  {
    slug: 'audit-compliance-manual',
    category: 'FINANCE',
    title: 'Audit Compliance Manual',
    summary: 'How the school prepares for and responds to internal or external audits.',
    content: `## Purpose
Be audit-ready at all times, not scrambling when an audit is announced.

## Scope
Financial records, fee records, payroll, and supporting documentation.

## Procedure
1. All financial transactions are recorded in the system as they happen (not batched/backdated), which is itself the primary audit trail alongside the Audit Logs feature.
2. Supporting documents (invoices, receipts, approval records) are filed and cross-referenced to their system entries per the Record Keeping Manual.
3. An internal review of a sample of transactions is conducted quarterly by the Director (or an appointed reviewer) to catch issues before an external audit would.
4. When an external audit is scheduled, Accounts prepares the requested reports/documents within the auditor's timeline and designates one point of contact.
5. Audit findings are addressed with a documented corrective action plan, tracked to completion, not just acknowledged.

## Responsible Roles
Accountant (record-keeping, audit prep), Director (internal review, corrective actions).`,
  },

  // ── HEALTH & SAFETY (8) ───────────────────────────────────────────────
  {
    slug: 'child-protection-policy-manual',
    category: 'HEALTH_SAFETY',
    title: 'Child Protection Policy Manual',
    summary: 'The school's core commitment and procedure for keeping children safe from harm.',
    content: `## Purpose
Protect every student from abuse, neglect, or harm, and give staff a clear procedure when a concern arises.

## Scope
All staff, all students, all school-related activities (including trips, transport, and online interactions).

## Procedure
1. All staff undergo a background check before hiring (see Recruitment & Hiring Manual) and child-protection awareness training during onboarding.
2. Any staff member who has a concern about a child's safety (at home or at school) reports it immediately to the Principal - never investigates it alone or delays.
3. The Principal assesses the concern and, where warranted, involves the family and/or appropriate authorities per local child-protection law.
4. All concerns and actions taken are documented confidentially and retained securely, accessible only to the Principal/Director.
5. Physical discipline of any kind is strictly prohibited; behavioral issues are handled per the school's student conduct policy, not this manual.
6. One-on-one staff-student interactions (e.g. extra help sessions) happen in visible, open spaces wherever possible.

## Responsible Roles
All staff (reporting duty), Principal (assessment, escalation), Director (policy oversight).`,
  },
  {
    slug: 'emergency-evacuation-manual',
    category: 'HEALTH_SAFETY',
    title: 'Emergency Evacuation Manual',
    summary: 'How the school evacuates safely for fire, earthquake, or other emergencies.',
    content: `## Purpose
Get every student and staff member out safely and accounted for during an emergency.

## Scope
All campus buildings, all students and staff, all emergency types requiring evacuation.

## Procedure
1. Evacuation routes and assembly points are clearly marked and posted in every classroom; every class knows its route.
2. Evacuation drills are held at least once per term, unannounced where possible, and timed.
3. On the alarm/signal, teachers lead their class directly to the assembly point using the posted route - no side-trips, no waiting for belongings.
4. At the assembly point, teachers take attendance against the class list immediately and report any missing student to the drill/emergency coordinator.
5. The Emergency Coordinator (Principal or designate) confirms all classes are accounted for before declaring the area clear.
6. After a real evacuation, a debrief and incident report is filed; after a drill, timing and issues are noted to improve the next one.

## Responsible Roles
Emergency Coordinator (Principal), Class Teachers (lead evacuation, take attendance), all staff (per their assigned duty).`,
  },
  {
    slug: 'first-aid-manual',
    category: 'HEALTH_SAFETY',
    title: 'First Aid Manual',
    summary: 'How injuries and sudden illness are handled on campus.',
    content: `## Purpose
Respond quickly and appropriately to injuries or illness during school hours.

## Scope
All students and staff, during school hours and school activities.

## Procedure
1. A stocked first-aid kit is maintained in the school office/nurse room and checked monthly for expired/missing items.
2. Minor injuries are treated on-site by trained staff/the school nurse; the incident is logged with date, student, and treatment given.
3. For anything beyond minor first aid, the parent is contacted immediately and, where needed, the student is taken to the nearest hospital - a staff member always accompanies the student.
4. Any student with a known medical condition (allergy, asthma, etc.) has this on file, visible to their Class Teacher and the school nurse.
5. Serious incidents are additionally reported to the Principal same-day and filed per the Crisis Management Manual.

## Responsible Roles
School Nurse/trained first-aider (treatment), Class Teacher (immediate response, parent contact), Principal (serious incident follow-up).`,
  },
  {
    slug: 'fire-safety-manual',
    category: 'HEALTH_SAFETY',
    title: 'Fire Safety Manual',
    summary: 'Fire prevention and response procedures for the campus.',
    content: `## Purpose
Prevent fires where possible and respond safely and quickly when one occurs.

## Scope
All campus buildings and grounds.

## Procedure
1. Fire extinguishers/hose reels are installed per code, inspected and serviced at least annually, with inspection tags checked monthly by Admin.
2. Electrical installations and kitchen/canteen equipment are inspected regularly; faults are reported and fixed immediately, not deferred.
3. Flammable materials (chemicals, cleaning supplies) are stored safely away from heat sources and out of student reach.
4. On discovering a fire: raise the alarm immediately, then follow the Emergency Evacuation Manual - never attempt to fight a fire beyond a small, contained one with a nearby extinguisher.
5. Fire drills are combined with the termly evacuation drill schedule.

## Responsible Roles
Admin/Facilities staff (equipment checks, inspections), all staff (immediate response, evacuation), Principal (fire-safety compliance oversight).`,
  },
  {
    slug: 'school-security-manual',
    category: 'HEALTH_SAFETY',
    title: 'School Security Manual',
    summary: 'Perimeter, access control, and daily security procedures.',
    content: `## Purpose
Keep the campus secure from unauthorized access and respond appropriately to security concerns.

## Scope
All campus entry/exit points, during and outside school hours.

## Procedure
1. All entry points are controlled - a single main entrance is used for visitor/vendor access, per the Visitor Management Manual.
2. Security staff/guards are on duty at all entry points during school hours and log anything unusual.
3. Student pick-up/drop-off follows the authorized-persons list; unfamiliar pickup attempts are verified with the parent by phone before release.
4. Security staff patrol the perimeter and grounds per a fixed schedule; any breach (damaged fence, unlocked gate) is reported and fixed same-day.
5. CCTV (where installed) footage is retained per the school's retention policy and reviewed when an incident is reported.
6. Any security incident (intrusion, theft, threat) is reported to the Principal immediately and escalated per the Crisis Management Manual if serious.

## Responsible Roles
Security Guard/Staff (access control, patrols), Principal (incident escalation, policy oversight).`,
  },
  {
    slug: 'health-screening-manual',
    category: 'HEALTH_SAFETY',
    title: 'Health Screening Manual',
    summary: 'Routine health checks and outbreak-response procedures for students.',
    content: `## Purpose
Catch health issues early and prevent illness from spreading through the school.

## Scope
All enrolled students; heightened procedures during any local disease outbreak.

## Procedure
1. Basic health screening (vision, hearing, general check) is conducted at admission and at least annually thereafter, with results filed in the student's record.
2. Students showing signs of a contagious illness (fever, rash, etc.) are isolated from the class and a parent is called for same-day pickup.
3. During a known local outbreak (as advised by health authorities), the school follows official guidance on screening, exclusion periods, and hygiene measures, communicated to parents via Announcements.
4. Immunization records are collected at admission where required by policy/regulation and kept on file.
5. Any concerning pattern (multiple students with similar symptoms) is reported to the Principal, who liaises with local health authorities if warranted.

## Responsible Roles
School Nurse (screening, isolation decisions), Class Teacher (spotting symptoms), Principal (outbreak liaison).`,
  },
  {
    slug: 'crisis-management-manual',
    category: 'HEALTH_SAFETY',
    title: 'Crisis Management Manual',
    summary: 'How the school responds to a major incident affecting student/staff safety.',
    content: `## Purpose
Give the school a clear chain of command and communication plan for any major incident.

## Scope
Any incident beyond routine first aid/security handling: serious injury, natural disaster, security threat, or similar.

## Procedure
1. The first staff member aware of a crisis alerts the Principal (or most senior staff present) immediately.
2. The Principal activates the response: ensure immediate safety (evacuate/lockdown as appropriate), call emergency services if needed, and designate a communication lead.
3. Parents are informed promptly and accurately through a single official channel (Announcements/direct call) - staff do not give out unconfirmed information individually.
4. The Director is briefed as soon as practical; media or official inquiries are handled only by the Director/Principal, not by other staff.
5. After the immediate crisis, a written incident report is prepared, and a debrief is held to capture lessons learned and update procedures if needed.

## Responsible Roles
Principal (incident command), Director (external communication, oversight), all staff (immediate safety actions, reporting up).`,
  },
  {
    slug: 'visitor-safety-protocol-manual',
    category: 'HEALTH_SAFETY',
    title: 'Visitor Safety Protocol Manual',
    summary: 'Safety-specific rules for visitors, on top of standard Visitor Management.',
    content: `## Purpose
Make sure visitors don't create a safety risk to students, beyond the identity/access controls in the Visitor Management Manual.

## Scope
All visitors, contractors, and vendors on campus during school hours.

## Procedure
1. Visitors are briefed on relevant safety rules (no unsupervised contact with students, evacuation routes if on-site during a drill/emergency) at sign-in.
2. Contractors performing work (electrical, construction, etc.) are scheduled outside school hours where the work poses any risk; if unavoidable during hours, the work area is cordoned off from students.
3. Any visitor request to interact directly with a class (guest speaker, vendor demo) requires prior Principal approval and a staff member present throughout.
4. Visitors are never left alone with students at any point.
5. Any safety concern involving a visitor is reported to the Principal immediately and the visitor's access is suspended pending review.

## Responsible Roles
Receptionist/Security (briefing, sign-in), Principal (approvals for class interactions), supervising staff (constant presence).`,
  },

  // ── USER MANUALS — ERP & MOBILE APP (10) ─────────────────────────────
  {
    slug: 'principal-app-manual',
    category: 'USER_MANUAL',
    title: 'Principal App Manual',
    summary: 'What a Principal can see and do in this system.',
    content: `## Purpose
Help a Principal use the system's Dashboard, Academics, Attendance, Finance, Exams, Reports, Meetings & Tasks, and Suggestions Box modules to run the school day to day.

## Getting Started
Log in with your school account. The sidebar shows every module your role can access - a Principal typically sees Dashboard, Academics, Students, Admissions, Teachers, Attendance, Finance, Exams & Results, Announcements, Reports, Meetings & Tasks, Suggestions Box, and Admin Tools.

## Key Workflows
1. **Dashboard**: a daily snapshot - attendance rate, fee collection status, and recent activity.
2. **Attendance**: review class-wise attendance daily; investigate any class with an unusual absence rate.
3. **Exams & Results**: approve question papers submitted by teachers, oversee result publishing, download report cards.
4. **Announcements**: post school-wide notices - these reach every parent/staff member on the portal.
5. **Meetings & Tasks**: schedule management meetings, take minutes, and assign tasks to staff with due dates.
6. **Suggestions Box**: review the "Review" tab regularly - respond to staff/parent suggestions and complaints.
7. **Reports**: pull attendance, fee, exam, and performance reports for any period, exportable to PDF/Excel.

## Tips
Use the Admissions CRM to track every enquiry through to enrollment, and the AI Tools module to help teachers draft question papers and lesson plans faster (always review AI output before use).`,
  },
  {
    slug: 'teacher-app-manual',
    category: 'USER_MANUAL',
    title: 'Teacher App Manual',
    summary: 'What a Teacher can see and do in this system.',
    content: `## Purpose
Help teachers use the system for daily attendance, homework, lesson plans, exams, and communication.

## Getting Started
Log in with your account. Your sidebar includes Dashboard, Academics, Students (your classes), Attendance, Exams & Results, Announcements, Reports, AI Tools, Meetings & Tasks, and Suggestions Box.

## Key Workflows
1. **Attendance**: mark your class's daily attendance at the start of the period.
2. **Homework**: assign homework with a due date; students/parents see it instantly on their portal.
3. **Exams & Results**: enter marks after grading; use AI Tools to draft a question paper as a starting point, then review and adjust before finalizing.
4. **Lesson Plans**: submit weekly lesson plans per the Lesson Planning Manual for Coordinator review.
5. **Meetings & Tasks**: check "My Meetings" and "My Tasks" to see what's scheduled and assigned to you, and update task status as you complete work.
6. **Suggestions Box**: submit feedback to management anytime, anonymously if you prefer.

## Tips
Keep homework and marks entry up to date daily - parents see real-time status on their own portal, so delays are visible.`,
  },
  {
    slug: 'parent-app-manual',
    category: 'USER_MANUAL',
    title: 'Parent App Manual',
    summary: 'What a Parent can see and do in the Parent Portal.',
    content: `## Purpose
Help parents track their child's attendance, homework, results, and fees, and communicate with the school.

## Getting Started
Log in with the account provided by the school at admission. The Parent Portal shows your child(ren)'s Attendance, Homework, Exam Results, Fee Status, Documents, and Announcements.

## Key Workflows
1. **Fee Status & Payment**: view invoices and pay online (JazzCash/EasyPaisa/bank transfer) - upload your payment proof and the school will confirm it.
2. **Attendance & Homework**: check daily attendance and homework assigned, with due dates.
3. **Exam Results**: view and download report cards once published.
4. **Announcements**: read school-wide notices and any messages specific to your child.
5. **Meetings & Tasks**: if invited to a school meeting (e.g. a parent-teacher meeting), it appears under "My Meetings".
6. **Suggestions Box**: submit feedback or a complaint to school management, anonymously if you prefer, and track any response.

## Tips
Keep your contact details updated with the school office so you never miss an important notice.`,
  },
  {
    slug: 'erp-administrator-manual',
    category: 'USER_MANUAL',
    title: 'ERP Administrator Manual',
    summary: 'How a school Admin/Director configures and manages the system.',
    content: `## Purpose
Help an Admin/Director set up and maintain the school's configuration in the system.

## Getting Started
Admin/Director accounts have the widest access: Schools & Branches, Academics, Students, Teachers, Staff & Users, Finance, and Admin Tools (Audit Logs, Settings, Backups).

## Key Workflows
1. **Schools & Branches**: set up branches (e.g. Boys/Girls campus), classes, and sections at the start of each academic year.
2. **Staff & Users**: create accounts for every role (Teacher, Accountant, Principal, etc.) with the correct role assignment - access is role-based throughout the system.
3. **Bulk Import**: use the Excel import tool to onboard students/teachers in bulk rather than one by one.
4. **Settings**: configure school-specific details (JazzCash/EasyPaisa/bank account info for online payments, fee structures, grading scale).
5. **Audit Logs**: review who changed what and when - especially useful for financial or sensitive record changes.
6. **Backups**: the system runs automated nightly backups; verify backup status periodically under Admin Tools.
7. **Manuals Library**: add your school's own custom SOPs alongside the bundled manuals if you have school-specific procedures.

## Tips
Set up the Academic Year and Fee Structures before the term starts - most other modules depend on these being configured first.`,
  },
  {
    slug: 'accounts-user-manual',
    category: 'USER_MANUAL',
    title: 'Accounts User Manual',
    summary: 'How an Accountant uses the Finance module day to day.',
    content: `## Purpose
Help the Accounts team manage fee collection, expenses, payroll, and financial reporting in the system.

## Getting Started
Accountant accounts see the Finance module (Fee Heads, Fee Structures, Invoices, Payments, Income/Expense Records, Online Payments review) plus Reports and Payroll.

## Key Workflows
1. **Fee Collection**: record cash/bank payments against invoices as they come in; every payment produces a receipt automatically.
2. **Online Payments**: review the "Online Payments" queue daily - approve or reject proof-upload submissions from parents, which books the payment once approved.
3. **Expenses**: log approved expenses against the right category, attaching supporting documents.
4. **Payroll**: process monthly payslips after attendance/leave is finalized, get Director sign-off, then mark as paid.
5. **Reports**: generate fee collection, expense, and payroll reports for the Director's review.

## Tips
Reconcile daily cash collection before end of day, and don't approve an online payment without genuinely verifying the uploaded proof.`,
  },
  {
    slug: 'admission-crm-manual',
    category: 'USER_MANUAL',
    title: 'Admission CRM Manual',
    summary: 'How Admissions/Reception staff use the Admissions CRM.',
    content: `## Purpose
Help Admissions/Reception staff manage the enquiry-to-enrollment pipeline.

## Getting Started
The Admissions module shows every enquiry with its stage (New, Contacted, Follow-Up, Admitted, Rejected/Lost), source, and assigned staff member.

## Key Workflows
1. **Logging an enquiry**: log every enquiry the moment it comes in (walk-in, phone, or via the public online enquiry form at your school's /apply link) - never rely on memory.
2. **Follow-ups**: log every conversation as a follow-up note; the system automatically moves a lead into "Follow-Up" status once you do.
3. **Assigning**: assign enquiries to specific staff so nothing falls through the cracks - use "assign to me" when you take ownership of a lead.
4. **Converting**: once a family accepts, use "Convert to Student" directly from the enquiry - this creates the student record and links it back to the original enquiry for source tracking.
5. **Summary dashboard**: check the pipeline summary regularly to see how many leads are at each stage and which sources are producing enrollments.

## Tips
A lead that goes untouched for too long should be followed up proactively - use the summary view to spot stale enquiries.`,
  },
  {
    slug: 'examination-module-manual',
    category: 'USER_MANUAL',
    title: 'Examination Module Manual',
    summary: 'How to run exams and results end-to-end in the Exams module.',
    content: `## Purpose
Help Exam Coordinators and teachers run the full exam cycle in the system.

## Getting Started
The Exams & Results module covers Exam setup, Subject-wise exam configuration, Marks entry, and Result/Report Card generation.

## Key Workflows
1. **Set up an exam**: create the exam (e.g. "Term 1 Exam"), attach the subjects and classes it covers, and set the date/marks per subject.
2. **Question papers**: draft manually or use the AI Question Paper Generator for a first draft - always review, edit, and finalize before printing.
3. **Marks entry**: subject teachers enter marks per student after grading; a second reviewer should spot-check entries before results are finalized.
4. **Result cards**: once all subjects for an exam are entered, generate report cards (PDF) - these use the school's configured grading scale automatically.
5. **Publishing**: results become visible on the Parent/Student portal only once you publish them - review before publishing, since parents see it immediately.

## Tips
Lock down question papers to trusted staff only until the exam date - the module doesn't restrict this automatically, so follow the Assessment & Examination Manual's confidentiality steps.`,
  },
  {
    slug: 'attendance-module-manual',
    category: 'USER_MANUAL',
    title: 'Attendance Module Manual',
    summary: 'How daily attendance is marked and monitored in the system.',
    content: `## Purpose
Help teachers and admins use the Attendance module correctly and consistently.

## Getting Started
The Attendance module covers Student Attendance (per class/section) and Staff Attendance separately.

## Key Workflows
1. **Marking student attendance**: teachers mark attendance for their class each day; the status (Present/Absent/Late/Leave) updates the student's record and Parent Portal instantly.
2. **Staff attendance**: staff mark their own attendance (or it's marked by Admin/biometric integration where set up).
3. **Monitoring**: Principals/Coordinators use the Reports module to check attendance trends by class - a sudden drop is a signal to investigate per the Student Performance Monitoring Manual.
4. **Corrections**: attendance corrections after the fact should be rare and are logged in the Audit Logs automatically - don't casually edit past records.

## Tips
Mark attendance at a consistent time each day (e.g. first period) so the data is comparable across classes.`,
  },
  {
    slug: 'fee-module-manual',
    category: 'USER_MANUAL',
    title: 'Fee Module Manual',
    summary: 'How the Finance module handles fee structures, invoices, and payments.',
    content: `## Purpose
Help Accounts staff and Directors configure and operate the fee system.

## Getting Started
The Finance module's fee side covers Fee Heads (categories like Tuition, Transport, Exam Fee), Fee Structures (amount per class/category), Invoices, Payments, Concessions, and Online Payments.

## Key Workflows
1. **Set up once per year**: define Fee Heads and Fee Structures per class before the academic year starts.
2. **Invoicing**: invoices generate per the configured billing cycle against every active student automatically.
3. **Collecting payment**: record cash/bank payments directly against an invoice; review and approve online proof-upload payments from the Online Payments queue.
4. **Concessions**: apply a documented concession/scholarship against a student's invoice only with the required approval on file.
5. **Reporting**: use Reports to see collection vs. billed, and overdue invoices for the Fee Recovery process.

## Tips
Set up your school's JazzCash/EasyPaisa/bank details in Settings before enabling online payments - parents need this to know where to send money.`,
  },
  {
    slug: 'ai-tools-user-manual',
    category: 'USER_MANUAL',
    title: 'AI Tools User Manual',
    summary: 'How to use the built-in AI Question Paper and Lesson Plan generators.',
    content: `## Purpose
Help teachers use the AI Tools module to speed up (not replace) their own planning and paper-setting work.

## Getting Started
The AI Tools module has two generators: Question Paper and Lesson Plan, found under "AI Tools" in the sidebar.

## Key Workflows
1. **Question Paper Generator**: choose the subject, class, topics/chapters, and total marks; the AI drafts a structured paper (sections, questions, marks, question types). Review every question for accuracy and appropriateness before using it - the AI's output is a draft, not a final paper.
2. **Lesson Plan Generator**: choose the subject, class, and topic; the AI drafts objectives, materials, warm-up, main activities, assessment, and homework. Edit any part inline before saving.
3. **Editing**: every generated document is fully editable in the app before you download the PDF or reuse it - nothing is auto-published.
4. **Downloading**: once you're satisfied with a draft, download it as a PDF for printing or sharing.

## Tips
Treat AI output the same way you'd treat a first draft from a colleague - useful as a starting point, but you're responsible for what actually goes in front of students.`,
  },
];
