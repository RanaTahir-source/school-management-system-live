import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { writeFileSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSettingsDto } from './dto/upsert-settings.dto';
import { assertSchoolAccess, ScopedUser } from '../../common/utils/school-scope';
import { LogoStorageService } from './logo-storage.service';

const ALLOWED_LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB - it's a logo, not a photo album

const DEFAULT_GRADING_SCALE = [
  { grade: 'A+', minPercent: 90, maxPercent: 100 },
  { grade: 'A', minPercent: 80, maxPercent: 89 },
  { grade: 'B', minPercent: 70, maxPercent: 79 },
  { grade: 'C', minPercent: 60, maxPercent: 69 },
  { grade: 'D', minPercent: 50, maxPercent: 59 },
  { grade: 'F', minPercent: 0, maxPercent: 49 },
];
const DEFAULT_WEEKEND_DAYS = [7]; // Sunday only

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logoStorage: LogoStorageService,
  ) {}

  private async assertSchoolExists(schoolId: string) {
    const school = await this.prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } });
    if (!school) throw new NotFoundException('School not found');
  }

  // Returns sane defaults when the school hasn't configured anything yet,
  // so callers never have to null-check every field.
  async get(schoolId: string, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, schoolId);
    await this.assertSchoolExists(schoolId);

    const existing = await this.prisma.schoolSetting.findUnique({ where: { schoolId } });
    if (existing) return existing;

    return {
      id: null,
      schoolId,
      logoUrl: null,
      gradingScale: DEFAULT_GRADING_SCALE,
      weekendDays: DEFAULT_WEEKEND_DAYS,
      lateFeePercent: null,
      attendanceLateAfter: null,
      smsNotificationsEnabled: false,
      emailNotificationsEnabled: false,
      bankName: null,
      bankAccountTitle: null,
      bankAccountNumber: null,
      jazzCashNumber: null,
      easyPaisaNumber: null,
      paymentQrData: null,
      updatedAt: null,
    };
  }

  async upsert(schoolId: string, dto: UpsertSettingsDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, schoolId);
    await this.assertSchoolExists(schoolId);

    const result = await this.prisma.schoolSetting.upsert({
      where: { schoolId },
      create: {
        schoolId,
        // class-validator gives us GradeBandDto instances, not plain objects -
        // Prisma's Json column wants a plain InputJsonValue, hence the cast.
        gradingScale: (dto.gradingScale ?? DEFAULT_GRADING_SCALE) as unknown as Prisma.InputJsonValue,
        weekendDays: dto.weekendDays ?? DEFAULT_WEEKEND_DAYS,
        lateFeePercent: dto.lateFeePercent,
        attendanceLateAfter: dto.attendanceLateAfter,
        smsNotificationsEnabled: dto.smsNotificationsEnabled ?? false,
        emailNotificationsEnabled: dto.emailNotificationsEnabled ?? false,
        bankName: dto.bankName,
        bankAccountTitle: dto.bankAccountTitle,
        bankAccountNumber: dto.bankAccountNumber,
        jazzCashNumber: dto.jazzCashNumber,
        easyPaisaNumber: dto.easyPaisaNumber,
        paymentQrData: dto.paymentQrData,
        updatedById: currentUser.userId,
      },
      update: {
        ...(dto.gradingScale !== undefined ? { gradingScale: dto.gradingScale as unknown as Prisma.InputJsonValue } : {}),
        ...(dto.weekendDays !== undefined ? { weekendDays: dto.weekendDays } : {}),
        ...(dto.lateFeePercent !== undefined ? { lateFeePercent: dto.lateFeePercent } : {}),
        ...(dto.attendanceLateAfter !== undefined ? { attendanceLateAfter: dto.attendanceLateAfter } : {}),
        ...(dto.smsNotificationsEnabled !== undefined ? { smsNotificationsEnabled: dto.smsNotificationsEnabled } : {}),
        ...(dto.emailNotificationsEnabled !== undefined ? { emailNotificationsEnabled: dto.emailNotificationsEnabled } : {}),
        ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
        ...(dto.bankAccountTitle !== undefined ? { bankAccountTitle: dto.bankAccountTitle } : {}),
        ...(dto.bankAccountNumber !== undefined ? { bankAccountNumber: dto.bankAccountNumber } : {}),
        ...(dto.jazzCashNumber !== undefined ? { jazzCashNumber: dto.jazzCashNumber } : {}),
        ...(dto.easyPaisaNumber !== undefined ? { easyPaisaNumber: dto.easyPaisaNumber } : {}),
        ...(dto.paymentQrData !== undefined ? { paymentQrData: dto.paymentQrData } : {}),
        updatedById: currentUser.userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId,
        action: 'SCHOOL_SETTINGS_UPDATED',
        entity: 'SchoolSetting',
        entityId: result.id,
      },
    });

    return result;
  }

  // Lets a school's own Director/Admin/Principal replace the generic default
  // branding with their own logo. New schools have no SchoolSetting row (and
  // therefore no logoUrl) until this runs at least once.
  async uploadLogo(schoolId: string, file: Express.Multer.File, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, schoolId);
    await this.assertSchoolExists(schoolId);

    if (!file) throw new BadRequestException('A logo image file is required');
    if (!ALLOWED_LOGO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported image type. Allowed: PNG, JPG, WEBP, SVG.');
    }
    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException('Logo must be 2MB or smaller.');
    }

    // One file per school, named by schoolId so re-uploading just overwrites
    // the old one instead of accumulating orphaned files on disk.
    const filename = `${schoolId}-${randomUUID()}${extname(file.originalname) || ''}`;
    writeFileSync(this.logoStorage.resolve(filename), file.buffer);
    const logoUrl = this.logoStorage.publicPath(filename);

    const result = await this.prisma.schoolSetting.upsert({
      where: { schoolId },
      create: { schoolId, weekendDays: DEFAULT_WEEKEND_DAYS, logoUrl },
      update: { logoUrl, updatedById: currentUser.userId },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId,
        action: 'SCHOOL_LOGO_UPDATED',
        entity: 'SchoolSetting',
        entityId: result.id,
      },
    });

    return { logoUrl: result.logoUrl };
  }
}
