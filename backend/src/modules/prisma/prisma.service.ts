import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  // Proxy all Prisma models and methods
  get $connect() {
    return this.prisma.$connect.bind(this.prisma);
  }

  get $disconnect() {
    return this.prisma.$disconnect.bind(this.prisma);
  }

  get $transaction() {
    return this.prisma.$transaction.bind(this.prisma);
  }

  get $queryRaw() {
    return this.prisma.$queryRaw.bind(this.prisma);
  }

  get user() {
    return this.prisma.user;
  }

  get role() {
    return this.prisma.role;
  }

  get permission() {
    return this.prisma.permission;
  }

  get userRole() {
    return this.prisma.userRole;
  }

  get rolePermission() {
    return this.prisma.rolePermission;
  }

  get school() {
    return this.prisma.school;
  }

  get branch() {
    return this.prisma.branch;
  }

  get refreshToken() {
    return this.prisma.refreshToken;
  }

  get passwordResetOtp() {
    return this.prisma.passwordResetOtp;
  }

  get auditLog() {
    return this.prisma.auditLog;
  }

  get teacherProfile() {
    return this.prisma.teacherProfile;
  }

  get studentProfile() {
    return this.prisma.studentProfile;
  }

  get academicYear() {
    return this.prisma.academicYear;
  }

  get class() {
    return this.prisma.class;
  }

  get section() {
    return this.prisma.section;
  }

  get attendanceRecord() {
    return this.prisma.attendanceRecord;
  }

  get incomeRecord() {
    return this.prisma.incomeRecord;
  }

  get expenseRecord() {
    return this.prisma.expenseRecord;
  }

  get subject() {
    return this.prisma.subject;
  }

  get exam() {
    return this.prisma.exam;
  }

  get examSubject() {
    return this.prisma.examSubject;
  }

  get examResult() {
    return this.prisma.examResult;
  }

  get feeHead() {
    return this.prisma.feeHead;
  }

  get feeStructure() {
    return this.prisma.feeStructure;
  }

  get feeStructureItem() {
    return this.prisma.feeStructureItem;
  }

  get feeConcession() {
    return this.prisma.feeConcession;
  }

  get feeInvoice() {
    return this.prisma.feeInvoice;
  }

  get feeInvoiceItem() {
    return this.prisma.feeInvoiceItem;
  }

  get feePayment() {
    return this.prisma.feePayment;
  }

  get announcement() {
    return this.prisma.announcement;
  }

  get message() {
    return this.prisma.message;
  }

  get messageRecipient() {
    return this.prisma.messageRecipient;
  }

  get notification() {
    return this.prisma.notification;
  }

  get communicationLog() {
    return this.prisma.communicationLog;
  }

  get staffProfile() {
    return this.prisma.staffProfile;
  }

  get staffAttendanceRecord() {
    return this.prisma.staffAttendanceRecord;
  }

  get family() {
    return this.prisma.family;
  }

  get book() {
    return this.prisma.book;
  }

  get bookIssue() {
    return this.prisma.bookIssue;
  }

  get studyMaterial() {
    return this.prisma.studyMaterial;
  }

  get driver() {
    return this.prisma.driver;
  }

  get vehicle() {
    return this.prisma.vehicle;
  }

  get route() {
    return this.prisma.route;
  }

  get routeStop() {
    return this.prisma.routeStop;
  }

  get hostelRoom() {
    return this.prisma.hostelRoom;
  }

  get hostelAllocation() {
    return this.prisma.hostelAllocation;
  }

  get hostelVisitor() {
    return this.prisma.hostelVisitor;
  }

  get hostelAttendanceRecord() {
    return this.prisma.hostelAttendanceRecord;
  }

  get salaryStructure() {
    return this.prisma.salaryStructure;
  }

  get payslip() {
    return this.prisma.payslip;
  }

  get parentStudent() {
    return this.prisma.parentStudent;
  }

  get document() {
    return this.prisma.document;
  }

  get certificate() {
    return this.prisma.certificate;
  }

  get timetableSlot() {
    return this.prisma.timetableSlot;
  }

  get homework() {
    return this.prisma.homework;
  }

  get onlineClass() {
    return this.prisma.onlineClass;
  }

  get leaveRequest() {
    return this.prisma.leaveRequest;
  }

  get backupLog() {
    return this.prisma.backupLog;
  }

  get schoolSetting() {
    return this.prisma.schoolSetting;
  }

  get admissionEnquiry() {
    return this.prisma.admissionEnquiry;
  }

  get admissionFollowUp() {
    return this.prisma.admissionFollowUp;
  }

  get aiLessonPlan() {
    return this.prisma.aiLessonPlan;
  }

  get aiQuestionPaper() {
    return this.prisma.aiQuestionPaper;
  }

  get asset() {
    return this.prisma.asset;
  }

  get assetMaintenanceLog() {
    return this.prisma.assetMaintenanceLog;
  }

  get chatThread() {
    return this.prisma.chatThread;
  }

  get chatThreadMember() {
    return this.prisma.chatThreadMember;
  }

  get chatMessage() {
    return this.prisma.chatMessage;
  }

  get chatCall() {
    return this.prisma.chatCall;
  }

  get inventoryItem() {
    return this.prisma.inventoryItem;
  }

  get inventoryTransaction() {
    return this.prisma.inventoryTransaction;
  }

  get manualDocument() {
    return this.prisma.manualDocument;
  }

  get meeting() {
    return this.prisma.meeting;
  }

  get meetingAttendee() {
    return this.prisma.meetingAttendee;
  }

  get onlinePaymentAttempt() {
    return this.prisma.onlinePaymentAttempt;
  }

  get staffTask() {
    return this.prisma.staffTask;
  }

  get suggestion() {
    return this.prisma.suggestion;
  }

  get department() {
    return this.prisma.department;
  }

  get designation() {
    return this.prisma.designation;
  }

  get quiz() {
    return this.prisma.quiz;
  }

  get quizQuestion() {
    return this.prisma.quizQuestion;
  }

  get quizAttempt() {
    return this.prisma.quizAttempt;
  }

  get quizAnswer() {
    return this.prisma.quizAnswer;
  }

  get house() {
    return this.prisma.house;
  }

  get housePointEntry() {
    return this.prisma.housePointEntry;
  }

  get accountHead() {
    return this.prisma.accountHead;
  }

  // Used only by BackupService to dynamically iterate every model for a
  // full-database export - normal services should always use the named
  // getters above instead of this.
  modelClient(camelCaseName: string) {
    return (this.prisma as any)[camelCaseName];
  }
}
