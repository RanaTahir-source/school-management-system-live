import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { AcademicYearsModule } from './modules/academic-years/academic-years.module';
import { ClassesModule } from './modules/classes/classes.module';
import { SectionsModule } from './modules/sections/sections.module';
import { StudentsModule } from './modules/students/students.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ExamsModule } from './modules/exams/exams.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { VoiceIntegrationModule } from './modules/voice-integration/voice-integration.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { ReportsModule } from './modules/reports/reports.module';
import { LibraryModule } from './modules/library/library.module';
import { TransportModule } from './modules/transport/transport.module';
import { HostelModule } from './modules/hostel/hostel.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { ParentsModule } from './modules/parents/parents.module';
import { ParentPortalModule } from './modules/parent-portal/parent-portal.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { HomeworkModule } from './modules/homework/homework.module';
import { OnlineClassesModule } from './modules/online-classes/online-classes.module';
import { LeaveModule } from './modules/leave/leave.module';
import { PlatformModule } from './modules/platform/platform.module';
import { BackupModule } from './modules/backup/backup.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    HealthModule,
    SchoolsModule,
    AcademicYearsModule,
    ClassesModule,
    SectionsModule,
    StudentsModule,
    TeachersModule,
    AttendanceModule,
    FinanceModule,
    ExamsModule,
    VoiceIntegrationModule,
    CommunicationModule,
    ReportsModule,
    LibraryModule,
    TransportModule,
    HostelModule,
    PayrollModule,
    ParentsModule,
    ParentPortalModule,
    DocumentsModule,
    TimetableModule,
    HomeworkModule,
    OnlineClassesModule,
    LeaveModule,
    BackupModule,
    AuditLogsModule,
    SettingsModule,
    PlatformModule,
  ],
})
export class AppModule {}
