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
