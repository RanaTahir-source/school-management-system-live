import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

// Models to skip when dumping - BackupLog itself would grow the file with
// every run, and RefreshToken/PasswordResetOtp are short-lived session
// artifacts with no restore value (they'd all be expired/invalid anyway).
const SKIP_MODELS = new Set(['BackupLog', 'RefreshToken', 'PasswordResetOtp']);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  readonly root = process.env.BACKUPS_DIR ? join(process.env.BACKUPS_DIR) : join(process.cwd(), 'backups');

  constructor(private readonly prisma: PrismaService) {
    if (!existsSync(this.root)) mkdirSync(this.root, { recursive: true });
  }

  // Full-database JSON export. Kept intentionally simple (no restore path -
  // see the schema comment on BackupLog for why). Runs synchronously within
  // the request; fine for a handful of school-sized tables, but if data
  // volume grows a lot this should move to a background job.
  async create(currentUser: { userId: string }) {
    const log = await this.prisma.backupLog.create({
      data: { triggeredById: currentUser.userId, status: 'IN_PROGRESS' },
    });

    try {
      const modelNames = Prisma.dmmf.datamodel.models
        .map((m) => m.name)
        .filter((name) => !SKIP_MODELS.has(name));

      const tables: Record<string, unknown[]> = {};
      let recordCount = 0;

      for (const name of modelNames) {
        const camelName = name.charAt(0).toLowerCase() + name.slice(1);
        const rows = await this.prisma.modelClient(camelName).findMany();
        tables[name] = rows;
        recordCount += rows.length;
      }

      const payload = JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          note: 'Full export for offline safekeeping only. For disaster recovery, use your database host\'s point-in-time restore instead of replaying this file.',
          tables,
        },
        null,
        0,
      );

      const fileKey = `backup-${log.id}.json`;
      const filePath = join(this.root, fileKey);
      writeFileSync(filePath, payload, 'utf-8');
      const { size } = statSync(filePath);

      return await this.prisma.backupLog.update({
        where: { id: log.id },
        data: {
          fileKey,
          fileSizeBytes: size,
          tableCount: modelNames.length,
          recordCount,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error('Backup failed', err as Error);
      return this.prisma.backupLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
    }
  }

  findAll() {
    return this.prisma.backupLog.findMany({
      include: { triggeredBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Automated daily backup - no human user triggers this, so it's attributed
  // to the oldest CHAIRMAN account (the platform owner) rather than adding a
  // nullable-user migration just for this. Shows up in the Backups tab like
  // any other run, just with "Triggered By" = the Chairman's name - the time
  // stamp and the fact it fired at 2 AM makes it obvious it was automatic.
  // Runs at 02:00 server time (Railway containers run UTC) every day.
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'daily-backup' })
  async runScheduledBackup() {
    const chairman = await this.prisma.user.findFirst({
      where: { userRoles: { some: { role: { name: 'CHAIRMAN' } } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!chairman) {
      this.logger.warn('Scheduled daily backup skipped - no CHAIRMAN user exists yet to attribute it to');
      return;
    }
    this.logger.log('Running scheduled daily backup...');
    await this.create({ userId: chairman.id });
  }

  async getFileTarget(id: string) {
    const log = await this.prisma.backupLog.findFirst({ where: { id } });
    if (!log || log.status !== 'COMPLETED' || !log.fileKey) {
      throw new NotFoundException('Backup not found or did not complete successfully');
    }
    const filePath = join(this.root, log.fileKey);
    if (!existsSync(filePath)) throw new NotFoundException('Backup file is missing on disk');
    return { filePath, fileName: log.fileKey };
  }
}
