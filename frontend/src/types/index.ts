export type Role =
  | 'CHAIRMAN'
  | 'DIRECTOR'
  | 'ADMIN'
  | 'PRINCIPAL'
  | 'COORDINATOR'
  | 'ACCOUNTANT'
  | 'TEACHER'
  | 'STUDENT'
  | 'PARENT'
  | 'LIBRARIAN'
  | 'RECEPTIONIST';

export type Branch = {
  id: string;
  schoolId: string;
  name: string;
  genderScope: 'BOYS' | 'GIRLS' | 'MIXED';
  isActive: boolean;
};

export type School = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  branches: Branch[];
};

// Chairman-only view of a tenant - same underlying School row, plus its
// linked Director's contact info from /platform/schools.
export type PlatformSchool = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  director: { id: string; fullName: string; email: string; phone: string | null; isActive: boolean } | null;
};

export type StudentProfile = {
  id: string;
  admissionNo: string;
  isActive: boolean;
  photoUrl?: string | null;
  user: { id: string; fullName: string; email: string; isActive: boolean };
  section?: { id: string; name: string; class?: { id: string; name: string } } | null;
};

export type TeacherProfile = {
  id: string;
  employeeId: string;
  qualification?: string | null;
  subjectSpecialty?: string | null;
  joiningDate?: string | null;
  cnic?: string | null;
  address?: string | null;
  isActive: boolean;
  photoUrl?: string | null;
  user: { id: string; fullName: string; email: string; isActive: boolean };
};

export type ClassRecord = {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  schoolId: string;
  branchId: string;
  school?: { id: string; name: string };
  branch?: { id: string; name: string };
};

export type IncomeRecord = {
  id: string;
  schoolId: string;
  branchId: string | null;
  studentId: string | null;
  category: string;
  amount: string;
  date: string;
  description: string | null;
};

export type ExpenseRecord = {
  id: string;
  schoolId: string;
  branchId: string | null;
  category: string;
  amount: string;
  date: string;
  description: string | null;
};

export type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  schoolId: string;
  school?: { id: string; name: string; code: string };
};

export type Department = {
  id: string;
  schoolId: string;
  name: string;
  description: string | null;
  headOfDepartmentId: string | null;
  headOfDepartment?: { id: string; fullName: string } | null;
  isActive: boolean;
  designations?: Designation[];
  _count?: { designations: number; staff: number };
};

export type Designation = {
  id: string;
  schoolId: string;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  name: string;
  isActive: boolean;
  _count?: { staff: number };
};

export type QuizQuestionType = 'MCQ' | 'TRUE_FALSE';

export type QuizQuestion = {
  id: string;
  order: number;
  type: QuizQuestionType;
  text: string;
  options: string[] | null;
  correctAnswer: string;
  marks: number;
};

export type Quiz = {
  id: string;
  schoolId: string;
  subjectId: string | null;
  classId: string | null;
  sectionId: string | null;
  title: string;
  description: string | null;
  timeLimitMinutes: number | null;
  isPublished: boolean;
  createdById: string;
  subject?: { id: string; name: string } | null;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
  createdBy?: { id: string; fullName: string };
  questions?: QuizQuestion[];
  _count?: { questions: number; attempts: number };
};

export type QuizAttemptRosterEntry = {
  id: string;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  totalMarks: number | null;
  student: { id: string; admissionNo: string; user: { fullName: string } };
};

export type AvailableQuiz = {
  id: string;
  title: string;
  description: string | null;
  subject?: { id: string; name: string } | null;
  timeLimitMinutes: number | null;
  questionCount: number;
  myAttempt: { status: 'IN_PROGRESS' | 'SUBMITTED'; score: number | null; totalMarks: number | null } | null;
};

export type QuizTakeQuestion = {
  id: string;
  order: number;
  type: QuizQuestionType;
  text: string;
  options: string[] | null;
  marks: number;
};

export type QuizAttemptStart = {
  attemptId: string;
  startedAt: string;
  quiz: {
    id: string;
    title: string;
    description: string | null;
    timeLimitMinutes: number | null;
    questions: QuizTakeQuestion[];
  };
};

export type QuizResultQuestion = {
  id: string;
  text: string;
  options: string[] | null;
  marks: number;
  yourAnswer: string | null;
  isCorrect?: boolean;
  correctAnswer?: string;
};

export type QuizResult = {
  status: 'IN_PROGRESS' | 'SUBMITTED';
  score: number | null;
  totalMarks: number | null;
  submittedAt: string | null;
  quizTitle: string;
  questions: QuizResultQuestion[];
};

export type SectionRecord = {
  id: string;
  name: string;
  capacity: number | null;
  isActive: boolean;
  classId: string;
  class?: { id: string; name: string; schoolId: string };
  academicYear?: { id: string; name: string };
  classTeacher?: { id: string; fullName: string; email: string } | null;
  students?: { id: string; admissionNo: string; user: { fullName: string } }[];
};

export type Subject = {
  id: string;
  schoolId: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

export type ExamSubject = {
  id: string;
  examId: string;
  classId: string;
  subjectId: string;
  maxMarks: number;
  passingMarks: number;
  examDate: string | null;
  subject?: { id: string; name: string; code: string | null };
  class?: { id: string; name: string };
};

export type Exam = {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  examSubjects?: ExamSubject[];
};

export type ExamResultEntry = {
  studentId: string;
  admissionNo: string;
  fullName: string;
  marksObtained: number | null;
  isAbsent: boolean;
  remarks: string | null;
  passed: boolean | null;
};

export type MarkSheet = {
  subject: string;
  className: string;
  maxMarks: number;
  passingMarks: number;
  students: ExamResultEntry[];
};

export type ClassSummaryRow = {
  studentId: string;
  admissionNo: string;
  fullName: string;
  totalObtained: number;
  totalMax: number;
  percentage: number | null;
  grade: string | null;
  overallResult: 'PASS' | 'FAIL';
};

export type StaffUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  schoolId: string | null;
  branchId: string | null;
  school?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  userRoles: { role: { id: string; name: Role } }[];
};

export type ClassSummary = {
  examId: string;
  examName: string;
  classId: string;
  totalMax: number;
  papers: number;
  students: ClassSummaryRow[];
};

// ── Fee structure & dues ──────────────────────────────────────────────
export type FeeHead = {
  id: string;
  schoolId: string;
  name: string;
  isMonthly: boolean;
  isActive: boolean;
};

export type FeeStructureItem = {
  id: string;
  feeHeadId: string;
  amount: string;
  feeHead: FeeHead;
};

export type FeeStructure = {
  id: string;
  classId: string;
  academicYearId: string;
  items: FeeStructureItem[];
};

export type FeeInvoiceItem = {
  id: string;
  feeHeadId: string;
  amount: string;
  concessionAmount: string;
  netAmount: string;
  feeHead: FeeHead;
};

export type FeeInvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export type FeeInvoice = {
  id: string;
  studentId: string;
  schoolId: string;
  branchId: string | null;
  period: string;
  dueDate: string;
  totalAmount: string;
  paidAmount: string;
  status: FeeInvoiceStatus;
  items: FeeInvoiceItem[];
  payments?: FeePayment[];
  student?: {
    id: string;
    admissionNo: string;
    user: { fullName: string };
    section: { id: string; name: string; class: { id: string; name: string } } | null;
  };
};

export type FeePayment = {
  id: string;
  invoiceId: string;
  receiptNo: string;
  amount: string;
  paidDate: string;
  method: string | null;
  createdAt: string;
};

// ── Reports ────────────────────────────────────────────────────────────
export type AdmissionRow = {
  studentId: string;
  admissionNo: string;
  fullName: string;
  email: string;
  admissionDate: string;
  className: string;
  sectionName: string;
  guardianName: string | null;
  guardianPhone: string | null;
};

export type AdmissionsReport = {
  period: { from: string; to: string };
  totalAdmissions: number;
  byClass: { className: string; count: number }[];
  students: AdmissionRow[];
};

export type StudentDirectoryRow = {
  admissionNo: string;
  fullName: string;
  email: string;
  phone: string | null;
  className: string;
  sectionName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  admissionDate: string;
  status: 'Active' | 'Inactive';
};

export type StaffDirectoryRow = {
  fullName: string;
  email: string;
  phone: string | null;
  category: string;
  designation: string;
  joiningDate: string | null;
  basicPay: string | null;
  status: 'Active' | 'Inactive';
};

export type PerformanceTrendPoint = {
  examId: string;
  examName: string;
  startDate: string;
  percentage: number | null;
  papersEvaluated: number;
};

export type PerformanceTrend = {
  classId: string;
  className: string;
  academicYearId: string;
  trend: PerformanceTrendPoint[];
};

// ── Library ────────────────────────────────────────────────────────────
export type Book = {
  id: string;
  schoolId: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  publisher: string | null;
  shelfLocation: string | null;
  totalCopies: number;
  availableCopies: number;
  isActive: boolean;
};

export type BookIssueStatus = 'ISSUED' | 'RETURNED' | 'LOST';

export type BookIssue = {
  id: string;
  bookId: string;
  borrowerId: string;
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  status: BookIssueStatus;
  fineAmount: string;
  fineWaived: boolean;
  finePaid: boolean;
  book?: { id: string; title: string; author: string | null };
  borrower?: { id: string; fullName: string; email: string };
};

export type MaterialType = 'DOCUMENT' | 'VIDEO' | 'LINK';

export type StudyMaterial = {
  id: string;
  schoolId: string;
  classId: string | null;
  subjectId: string | null;
  title: string;
  description: string | null;
  fileUrl: string;
  type: MaterialType;
  class?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  uploadedBy?: { id: string; fullName: string };
  createdAt: string;
};

// ── Transport ──────────────────────────────────────────────────────────
export type Driver = {
  id: string;
  schoolId: string;
  fullName: string;
  phone: string | null;
  cnic: string | null;
  licenseNo: string | null;
  address: string | null;
  isActive: boolean;
};

export type Vehicle = {
  id: string;
  schoolId: string;
  branchId: string | null;
  registrationNo: string;
  vehicleType: string | null;
  make: string | null;
  capacity: number | null;
  driverId: string | null;
  isActive: boolean;
  driver?: { id: string; fullName: string; phone: string | null } | null;
  branch?: { id: string; name: string } | null;
};

export type RouteStop = {
  id: string;
  routeId: string;
  name: string;
  order: number;
  pickupTime: string | null;
  students?: { id: string; admissionNo: string; user: { fullName: string } }[];
};

export type TransportRoute = {
  id: string;
  schoolId: string;
  branchId: string | null;
  name: string;
  monthlyFare: string | null;
  vehicleId: string | null;
  isActive: boolean;
  vehicle?: { id: string; registrationNo: string; vehicleType: string | null; capacity: number | null } | null;
  branch?: { id: string; name: string } | null;
  stops: RouteStop[];
};

export type StudentTransportAssignment = {
  id: string;
  name: string;
  pickupTime: string | null;
  route: {
    id: string;
    name: string;
    monthlyFare: string | null;
    vehicle?: { id: string; registrationNo: string; vehicleType: string | null } | null;
  };
} | null;

// ── Parent Portal ──────────────────────────────────────────────────────
export type ParentChildLink = {
  id: string;
  relation: string | null;
  student: { id: string; admissionNo: string; user: { fullName: string } };
};

export type ParentUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  children: ParentChildLink[];
};

export type MyChild = {
  id: string;
  relation: string | null;
  student: {
    id: string;
    admissionNo: string;
    photoUrl: string | null;
    user: { fullName: string; isActive: boolean };
    section: { id: string; name: string; class: { id: string; name: string } } | null;
  };
};

export type ChildAttendanceRecord = {
  id: string;
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
};

export type ChildExamSubjectResult = {
  subject: string;
  maxMarks: number;
  passingMarks: number;
  marksObtained: number | null;
  isAbsent: boolean;
};

export type ChildExamSummary = {
  examId: string;
  examName: string;
  startDate: string;
  totalObtained: number;
  totalMax: number;
  percentage: number | null;
  subjects: ChildExamSubjectResult[];
};

// ── Payroll ────────────────────────────────────────────────────────────
export type PayrollStaffProfile = {
  id: string;
  userId: string;
  schoolId: string;
  branchId: string | null;
  employeeId: string | null;
  category: string | null;
  designation: string | null;
  education: string | null;
  cnic: string | null;
  address: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  joiningDate: string | null;
  basicPay: string | null;
  isActive: boolean;
  user: { id: string; fullName: string; email: string; phone: string | null; isActive: boolean };
};

export type EligibleStaffUser = { id: string; fullName: string; email: string };

export type SalaryStructure = {
  id: string;
  staffId: string;
  basicPay: string;
  allowances: string;
  deductions: string;
  staff: { id: string; employeeId: string | null; designation: string | null; user: { id: string; fullName: string } };
};

export type PayslipStatus = 'PENDING' | 'PAID';

export type Payslip = {
  id: string;
  staffId: string;
  period: string;
  basicPay: string;
  allowances: string;
  deductions: string;
  netPay: string;
  status: PayslipStatus;
  paidDate: string | null;
  method: string | null;
  staff?: { id: string; employeeId: string; designation: string | null; user: { id: string; fullName: string } };
};

// ── Hostel ─────────────────────────────────────────────────────────────
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';

export type HostelRoom = {
  id: string;
  schoolId: string;
  branchId: string | null;
  roomNo: string;
  block: string | null;
  floor: string | null;
  capacity: number;
  roomType: string | null;
  monthlyFee: string | null;
  isActive: boolean;
  branch?: { id: string; name: string } | null;
  allocations?: {
    id: string;
    checkInDate: string;
    student: { id: string; admissionNo: string; user: { fullName: string } };
  }[];
};

export type HostelAllocation = {
  id: string;
  roomId: string;
  studentId: string;
  checkInDate: string;
  checkOutDate: string | null;
  isActive: boolean;
  remarks: string | null;
  room?: { id: string; roomNo: string; block: string | null; monthlyFee: string | null };
  student?: { id: string; admissionNo: string; user: { fullName: string } };
};

export type HostelVisitor = {
  id: string;
  studentId: string;
  visitorName: string;
  relation: string | null;
  phone: string | null;
  purpose: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  student?: { id: string; admissionNo: string; user: { fullName: string } };
  recordedBy?: { id: string; fullName: string };
};

export type HostelAttendanceRecord = {
  id: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
  student?: { id: string; admissionNo: string; user: { fullName: string } };
};

// ── Communication & Announcements ─────────────────────────────────────
export type AnnouncementPriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';

export type Announcement = {
  id: string;
  schoolId: string;
  branchId: string | null;
  classId: string | null;
  sectionId: string | null;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  audienceRoles: Role[];
  isPublished: boolean;
  publishAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdById: string;
  createdAt: string;
};

export type NotificationType = 'ANNOUNCEMENT' | 'MESSAGE' | 'SYSTEM';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  announcementId: string | null;
};

export type MessageSummary = {
  id: string;
  subject: string | null;
  body: string;
  createdAt: string;
  sender?: { id: string; fullName: string };
  recipients: { readAt: string | null; recipient?: { id: string; fullName: string } }[];
};

// ── Documents & Certificates ──────────────────────────────────────────
export type DocumentOwnerType = 'STUDENT' | 'TEACHER' | 'STAFF';

export type DocumentCategory =
  | 'B_FORM'
  | 'CNIC'
  | 'DOMICILE'
  | 'BIRTH_CERTIFICATE'
  | 'CHARACTER_CERTIFICATE'
  | 'TRANSCRIPT'
  | 'DEGREE'
  | 'CONTRACT'
  | 'MEDICAL'
  | 'PHOTO'
  | 'OTHER';

export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type DocumentRecord = {
  id: string;
  schoolId: string;
  ownerType: DocumentOwnerType;
  studentId: string | null;
  teacherId: string | null;
  staffId: string | null;
  category: DocumentCategory;
  title: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  isConfidential: boolean;
  status: DocumentStatus;
  rejectionReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  student?: { id: string; admissionNo: string; user: { fullName: string } } | null;
  teacher?: { id: string; employeeId: string; user: { fullName: string } } | null;
  staff?: { id: string; designation: string | null; user: { fullName: string } } | null;
  uploadedBy?: { id: string; fullName: string };
  verifiedBy?: { id: string; fullName: string } | null;
};

export type CertificateType = 'CHARACTER' | 'TRANSFER' | 'LEAVING' | 'BONAFIDE' | 'EXPERIENCE' | 'ACHIEVEMENT' | 'MIGRATION' | 'CUSTOM';

export type CertificateRecord = {
  id: string;
  schoolId: string;
  studentId: string | null;
  staffId: string | null;
  type: CertificateType;
  certificateNo: string;
  title: string;
  bodyText: string | null;
  remarks: string | null;
  issuedDate: string;
  isRevoked: boolean;
  revokedAt: string | null;
  qrVerifyToken: string;
  student?: { id: string; admissionNo: string; user: { fullName: string }; section?: { class?: { name: string } } | null } | null;
  staff?: { id: string; designation: string | null; user: { fullName: string } } | null;
  issuedBy?: { id: string; fullName: string };
  // MIGRATION-only, auto-computed at issue time
  admissionDate?: string | null;
  marksObtained?: number | null;
  marksOutOf?: number | null;
  attendanceDays?: number | null;
  totalWorkingDays?: number | null;
  transferDate?: string | null;
  duesAmount?: string | null;
  duesPaidTill?: string | null;
  shiftedToSchool?: string | null;
};

export type CertificateVerifyResult = {
  valid: boolean;
  certificateNo: string;
  type: CertificateType;
  title: string;
  issuedDate: string;
  schoolName: string;
  holderName: string | null;
  isRevoked: boolean;
};

export type FeeConcession = {
  id: string;
  studentId: string;
  feeHeadId: string | null;
  type: 'PERCENTAGE' | 'FLAT';
  value: string;
  reason: string | null;
  isActive: boolean;
  feeHead?: FeeHead | null;
};

// ─────────────────────────── Timetable / Homework / Leave ───────────────────────────

export type TimetableSlot = {
  id: string;
  sectionId: string;
  subjectId: string;
  teacherId: string | null;
  dayOfWeek: number; // 1=Monday .. 7=Sunday
  periodNo: number;
  startTime: string;
  endTime: string;
  room: string | null;
  subject?: { name: string };
  teacher?: { fullName: string } | null;
  section?: { name: string; class?: { name: string } };
};

export type Homework = {
  id: string;
  schoolId: string;
  sectionId: string;
  subjectId: string;
  assignedById: string;
  title: string;
  description: string | null;
  assignedDate: string;
  dueDate: string;
  subject?: { name: string };
  assignedBy?: { fullName: string };
  section?: { name: string; class?: { name: string } };
};

export type OnlineClass = {
  id: string;
  schoolId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string | null;
  meetingLink: string;
  scheduledAt: string;
  durationMinutes: number;
  isCancelled: boolean;
  subject?: { name: string };
  teacher?: { fullName: string };
  section?: { name: string; class?: { name: string } };
};

export type LeaveApplicantType = 'STUDENT' | 'TEACHER' | 'STAFF';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type GradeBand = { grade: string; minPercent: number; maxPercent: number };

export type SchoolSettings = {
  id: string | null;
  schoolId: string;
  gradingScale: GradeBand[];
  weekendDays: number[];
  lateFeePercent: string | null;
  attendanceLateAfter: string | null;
  smsNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  bankName: string | null;
  bankAccountTitle: string | null;
  bankAccountNumber: string | null;
  jazzCashNumber: string | null;
  easyPaisaNumber: string | null;
  paymentQrData: string | null;
  updatedAt: string | null;
};

export type BackupStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type BackupLog = {
  id: string;
  triggeredById: string;
  fileKey: string | null;
  fileSizeBytes: number | null;
  tableCount: number | null;
  recordCount: number | null;
  status: BackupStatus;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  triggeredBy?: { fullName: string };
};

export type AuditLogEntry = {
  id: string;
  userId: string | null;
  schoolId: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
  user?: { fullName: string; email: string } | null;
  school?: { name: string } | null;
};

export type AuditLogPage = {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type LeaveRequest = {
  id: string;
  schoolId: string;
  applicantType: LeaveApplicantType;
  studentId: string | null;
  staffUserId: string | null;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  submittedById: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewRemarks: string | null;
  createdAt: string;
  student?: { admissionNo: string; user: { fullName: string } } | null;
  staffUser?: { fullName: string } | null;
  submittedBy?: { fullName: string } | null;
  reviewedBy?: { fullName: string } | null;
};

// Bulk Excel Import (Students & Teachers) - matches backend
// common/utils/excel-import.ts BulkImportSummary/BulkImportRowResult shape.
export type BulkImportRowResult = {
  row: number;
  status: 'created' | 'error';
  identifier?: string;
  message?: string;
};

export type BulkImportSummary = {
  total: number;
  created: number;
  failed: number;
  results: BulkImportRowResult[];
};

// ── Admissions CRM (enquiries/leads) ───────────────────────────────────
export type AdmissionSource = 'WALK_IN' | 'PHONE' | 'REFERRAL' | 'SOCIAL_MEDIA' | 'WEBSITE' | 'ADVERTISEMENT' | 'OTHER';
export type AdmissionStatus = 'NEW' | 'CONTACTED' | 'FOLLOW_UP' | 'TRIAL_SCHEDULED' | 'ADMITTED' | 'REJECTED' | 'LOST';

export type AdmissionFollowUp = {
  id: string;
  note: string;
  nextFollowUpDate: string | null;
  createdAt: string;
  createdBy?: { id: string; fullName: string } | null;
};

export type AdmissionEnquiry = {
  id: string;
  schoolId: string;
  branchId: string | null;
  childName: string;
  desiredClassName: string | null;
  parentName: string;
  phone: string;
  email: string | null;
  address: string | null;
  source: AdmissionSource;
  status: AdmissionStatus;
  notes: string | null;
  nextFollowUpDate: string | null;
  submittedOnline: boolean;
  convertedStudentId: string | null;
  convertedAt: string | null;
  createdAt: string;
  branch?: { id: string; name: string } | null;
  assignedTo?: { id: string; fullName: string } | null;
  createdBy?: { id: string; fullName: string } | null;
  convertedStudent?: { id: string; admissionNo: string } | null;
  followUps: AdmissionFollowUp[];
};

export type AdmissionSummary = {
  total: number;
  byStatus: { status: AdmissionStatus; count: number }[];
  bySource: { source: AdmissionSource; count: number }[];
};

// ── Online Fee Payment ─────────────────────────────────────────────────
export type OnlinePaymentMethod = 'JAZZCASH' | 'EASYPAISA' | 'BANK_TRANSFER' | 'CARD';
export type OnlinePaymentStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'FAILED';

export type OnlinePaymentAttempt = {
  id: string;
  invoiceId: string;
  amount: string;
  method: OnlinePaymentMethod;
  status: OnlinePaymentStatus;
  proofFileKey: string | null;
  proofNote: string | null;
  reviewNote: string | null;
  createdAt: string;
  invoice?: { id: string; period: string };
  initiatedBy?: { id: string; fullName: string };
  feePayment?: { receiptNo: string } | null;
};

export type PayToDetails = {
  bankName: string | null;
  bankAccountTitle: string | null;
  bankAccountNumber: string | null;
  jazzCashNumber: string | null;
  easyPaisaNumber: string | null;
};

export type InitiateOnlinePaymentResponse = {
  attempt: OnlinePaymentAttempt;
  payTo: PayToDetails;
};

// ── AI Tools (Question Paper + Lesson Plan generators) ─────────────────
export type QuestionType = 'MCQ' | 'SHORT' | 'LONG' | 'TRUE_FALSE' | 'FILL_BLANK';

export type AiQuestion = {
  text: string;
  marks: number;
  type: QuestionType;
  options?: string[];
};

export type AiQuestionPaperSection = {
  title: string;
  marks: number;
  questions: AiQuestion[];
};

export type AiQuestionPaperContent = {
  sections: AiQuestionPaperSection[];
};

export type AiQuestionPaper = {
  id: string;
  title: string;
  examType: string | null;
  totalMarks: number;
  durationMinutes: number | null;
  instructions: string | null;
  content: AiQuestionPaperContent;
  createdAt: string;
  subject?: { id: string; name: string } | null;
  class?: { id: string; name: string } | null;
  createdBy?: { id: string; fullName: string } | null;
};

export type AiLessonPlanContent = {
  objectives: string[];
  materials: string[];
  warmUp: string;
  mainActivities: string[];
  assessment: string;
  homework: string;
};

// ── Inventory & POS ─────────────────────────────────────────────────────
export type InventoryItem = {
  id: string;
  schoolId: string;
  branchId: string | null;
  name: string;
  category: string | null;
  sku: string | null;
  unit: string;
  costPrice: string;
  sellPrice: string;
  quantityOnHand: number;
  reorderLevel: number | null;
  isActive: boolean;
};

export type InventoryTransactionType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT';

export type InventoryTransaction = {
  id: string;
  itemId: string;
  type: InventoryTransactionType;
  quantity: number;
  unitPrice: string;
  totalAmount: string;
  note: string | null;
  createdAt: string;
  item?: { id: string; name: string; unit: string };
  student?: { id: string; admissionNo: string; user: { fullName: string } } | null;
  createdBy?: { id: string; fullName: string };
};

export type InventoryProfitLossReport = {
  from: string | null;
  to: string | null;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  items: { itemId: string; itemName: string; quantitySold: number; revenue: number; cost: number; profit: number }[];
};

// ── Assets Management ───────────────────────────────────────────────────
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';

export type AssetMaintenanceLog = {
  id: string;
  date: string;
  description: string;
  cost: string | null;
  createdAt: string;
  createdBy?: { id: string; fullName: string };
};

export type Asset = {
  id: string;
  schoolId: string;
  branchId: string | null;
  name: string;
  category: string | null;
  assetTag: string | null;
  purchaseDate: string | null;
  purchaseCost: string | null;
  condition: AssetCondition;
  location: string | null;
  warrantyExpiryDate: string | null;
  notes: string | null;
  isDisposed: boolean;
  branch?: { id: string; name: string } | null;
  assignedTo?: { id: string; fullName: string } | null;
  maintenanceLogs: AssetMaintenanceLog[];
};

export type AiLessonPlan = {
  id: string;
  topic: string;
  durationMinutes: number | null;
  content: AiLessonPlanContent;
  createdAt: string;
  subject?: { id: string; name: string } | null;
  class?: { id: string; name: string } | null;
  createdBy?: { id: string; fullName: string } | null;
};

// ── Meetings, Staff Tasks, Suggestions Box ──────────────────────────────
export type MeetingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export type MeetingAttendee = {
  id: string;
  userId: string;
  notifiedAt: string | null;
  attended: boolean | null;
  user: { id: string; fullName: string };
};

export type Meeting = {
  id: string;
  schoolId: string;
  branchId: string | null;
  title: string;
  agenda: string | null;
  scheduledAt: string;
  location: string | null;
  status: MeetingStatus;
  minutes: string | null;
  branch?: { id: string; name: string } | null;
  createdBy?: { id: string; fullName: string };
  attendees: MeetingAttendee[];
};

export type StaffTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type StaffTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type StaffTask = {
  id: string;
  schoolId: string;
  branchId: string | null;
  title: string;
  description: string | null;
  priority: StaffTaskPriority;
  status: StaffTaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  branch?: { id: string; name: string } | null;
  assignedTo?: { id: string; fullName: string };
  assignedBy?: { id: string; fullName: string };
};

export type SuggestionStatus = 'NEW' | 'REVIEWED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';

export type Suggestion = {
  id: string;
  schoolId: string;
  branchId: string | null;
  category: string | null;
  message: string;
  isAnonymous: boolean;
  status: SuggestionStatus;
  adminResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
  branch?: { id: string; name: string } | null;
  submittedBy?: { id: string; fullName: string } | null;
  respondedBy?: { id: string; fullName: string } | null;
};

// ── Manuals / SOPs Library ───────────────────────────────────────────────
export type ManualCategory = 'ACADEMIC' | 'ADMINISTRATION' | 'HUMAN_RESOURCE' | 'FINANCE' | 'HEALTH_SAFETY' | 'USER_MANUAL' | 'CUSTOM';

export type ManualDocument = {
  id: string;
  schoolId: string | null;
  category: ManualCategory;
  title: string;
  slug: string | null;
  summary: string | null;
  content: string;
  version: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; fullName: string } | null;
  updatedBy?: { id: string; fullName: string } | null;
};

// ── Chat ──────────────────────────────────────────────────────────────────
export type ChatThreadType = 'DIRECT' | 'CLASS_GROUP' | 'BROADCAST' | 'STAFF_GROUP';
export type ChatMemberRole = 'MEMBER' | 'MODERATOR';

export type ChatThreadMember = {
  id: string;
  userId: string;
  role: ChatMemberRole;
  lastReadAt: string | null;
  joinedAt: string;
  user: { id: string; fullName: string };
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  createdAt: string;
  sender: { id: string; fullName: string };
};

export type ChatCallStatus = {
  id: string;
  threadId: string;
  roomName: string;
  status: 'ACTIVE' | 'ENDED';
  startedAt: string;
  startedBy: { id: string; fullName: string };
  notetakerJoined: boolean;
} | null;

export type JoinCallResponse = {
  token: string;
  url: string;
  roomName: string;
  callId: string;
  canPublish: boolean;
};

export type ChatThread = {
  id: string;
  schoolId: string;
  branchId: string | null;
  type: ChatThreadType;
  title: string | null;
  sectionId: string | null;
  postingRestricted: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: { id: string; name: string } | null;
  section?: { id: string; name: string; class: { id: string; name: string } } | null;
  createdBy?: { id: string; fullName: string };
  members: ChatThreadMember[];
  myRole?: ChatMemberRole;
  lastMessage?: ChatMessage | null;
  unreadCount?: number;
};

// ─────────────────────────────────────────────
// PREDICTIVE AI ANALYTICS  (Milestone 14)
// ─────────────────────────────────────────────
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type FeeDefaultRiskStudent = {
  studentId: string;
  fullName: string;
  admissionNo: string;
  className: string | null;
  sectionName: string | null;
  overdueInvoices: number;
  overdueAmount: number;
  consecutiveUnpaidMonths: number;
  riskScore: number;
  riskLevel: RiskLevel;
};

export type FeeDefaultRiskReport = {
  generatedAt: string;
  windowMonths: number;
  studentsFlagged: number;
  highRiskCount: number;
  mediumRiskCount: number;
  students: FeeDefaultRiskStudent[];
};

export type AttendanceAnomaly = {
  studentId: string;
  fullName: string;
  admissionNo: string;
  className: string | null;
  sectionName: string | null;
  recentAbsentRatePct: number;
  baselineAbsentRatePct: number;
  consecutiveAbsentDays: number;
  severity: RiskLevel;
  reason: string;
};

export type AttendanceAnomalyReport = {
  generatedAt: string;
  windowDays: { recent: number; baseline: number };
  alertsCount: number;
  alerts: AttendanceAnomaly[];
};

export type ExamRiskStudent = {
  studentId: string;
  fullName: string;
  admissionNo: string;
  className: string | null;
  sectionName: string | null;
  latestScorePct: number;
  previousScorePct: number | null;
  failedSubjects: number;
  absentPapers: number;
  riskScore: number;
  riskLevel: RiskLevel;
};

export type ExamRiskReport = {
  generatedAt: string;
  latestExam: { id: string; name: string } | null;
  previousExam: { id: string; name: string } | null;
  studentsFlagged: number;
  students: ExamRiskStudent[];
};

export type TeacherEfficiencyEntry = {
  teacherId: string;
  fullName: string;
  employeeId: string | null;
  subjectsTaught: number;
  sectionsTaught: number;
  avgScorePct: number | null;
  passRatePct: number | null;
  classTeacherOf: string | null;
  attendanceMarkingRatePct: number | null;
  efficiencyScore: number | null;
};

export type TeacherEfficiencyReport = {
  generatedAt: string;
  latestExam: string | null;
  note: string;
  teachers: TeacherEfficiencyEntry[];
};

export type LearningReport = {
  generatedAt: string;
  student: { id: string; fullName: string; admissionNo: string; className: string | null; sectionName: string | null };
  attendance: {
    windowDays: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    leaveCount: number;
    attendanceRatePct: number | null;
  };
  examTrend: { examName: string; scorePct: number | null; failedSubjects: number; subjects: { name: string; pct: number }[] }[];
  feeStatus: { totalDueRecentPeriods: number; overdueInvoices: number };
  summary: string;
};

// ─────────────────────────────────────────────
// HOUSES  (Milestone 15)
// ─────────────────────────────────────────────
export type House = {
  id: string;
  schoolId: string;
  name: string;
  colorHex: string | null;
  isActive: boolean;
  inChargeId: string | null;
  inCharge?: { id: string; fullName: string } | null;
  totalPoints: number;
  _count?: { students: number };
};

export type HousePointEntry = {
  id: string;
  houseId: string;
  points: number;
  reason: string;
  category: string | null;
  date: string;
  awardedBy?: { fullName: string };
};

export type HouseDetail = House & {
  students: { id: string; admissionNo: string; user: { fullName: string }; section?: { name: string; class?: { name: string } | null } | null }[];
  pointEntries: HousePointEntry[];
};

// ─────────────────────────────────────────────
// CHART OF ACCOUNTS  (Milestone 15)
// ─────────────────────────────────────────────
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export type AccountHead = {
  id: string;
  schoolId: string;
  name: string;
  code: string | null;
  type: AccountType;
  parentId: string | null;
  parent?: { id: string; name: string } | null;
  isActive: boolean;
  _count?: { children: number; incomeRecords: number; expenseRecords: number };
};

export type LedgerSummaryHead = {
  id: string;
  name: string;
  code: string | null;
  type: AccountType;
  parentId: string | null;
  incomeTotal: number;
  expenseTotal: number;
};

export type LedgerSummaryReport = {
  generatedAt: string;
  range: { from: string | null; to: string | null };
  totalIncome: number;
  totalExpense: number;
  net: number;
  unassignedIncome: number;
  unassignedExpense: number;
  accountHeads: LedgerSummaryHead[];
};
