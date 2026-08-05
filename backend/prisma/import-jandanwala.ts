/**
 * import-jandanwala.ts
 *
 * Migrates Dar-e-Arqam Jandanwala's legacy Visual FoxPro data (already exported
 * as clean TAB-delimited text files) into the production Postgres database.
 *
 * Source files expected at:
 *   G:\session 2026-27\Dar Arqam School Software 2025-26\Student System\clean_export\
 *     BRANCH.txt, SESSION.txt, CLASS.txt, FAMILY.txt, STUDENT.txt, STAFF.txt
 *
 * Run from the backend folder:
 *   npx ts-node prisma/import-jandanwala.ts
 *
 * Safe to re-run: every insert first checks whether a record for that legacy
 * ID already exists, so running it twice will not create duplicates.
 */

import { PrismaClient, Gender } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';

const prisma = new PrismaClient();

const BASE = 'G:\\session 2026-27\\Dar Arqam School Software 2025-26\\Student System\\clean_export\\';

// ── Helpers ──────────────────────────────────────────────────────────────

function readRows(fileName: string): string[][] {
  const raw = fs.readFileSync(BASE + fileName, 'latin1');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) =>
    line.split('\t').map((f) => {
      let v = f.trim();
      if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
        v = v.slice(1, -1);
      }
      return v.trim();
    }),
  );
}

function s(v: string | undefined): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  return t.length ? t : null;
}

function n(v: string | undefined): number | null {
  if (v === undefined) return null;
  const t = v.trim();
  if (!t.length) return null;
  const num = Number(t);
  return Number.isFinite(num) ? num : null;
}

function parseFoxDate(v: string | undefined): Date | null {
  if (!v) return null;
  const t = v.trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function titleCase(v: string | null): string | null {
  if (!v) return v;
  return v
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .trim();
}

async function main() {
  console.log('Starting Jandanwala data import...\n');

  const school = await prisma.school.findUniqueOrThrow({ where: { code: 'JND' } });
  const branch = await prisma.branch.findFirstOrThrow({
    where: { schoolId: school.id, name: { contains: 'Boys Campus' } },
  });
  const academicYear = await prisma.academicYear.findFirstOrThrow({
    where: { schoolId: school.id, name: '2026-2027' },
  });

  // ── 1. FAMILIES ──────────────────────────────────────────────────────
  console.log('Importing families...');
  const familyRows = readRows('FAMILY.txt');
  const familyMap = new Map<number, string>(); // legacy FM_CODE -> new Family id

  for (const row of familyRows) {
    const fmCode = n(row[0]);
    const fmName = s(row[1]);
    if (fmCode === null || !fmName) continue;

    let family = await prisma.family.findFirst({
      where: { schoolId: school.id, legacyFmCode: fmCode },
    });
    if (!family) {
      family = await prisma.family.create({
        data: { schoolId: school.id, name: fmName, legacyFmCode: fmCode },
      });
    }
    familyMap.set(fmCode, family.id);
  }
  console.log(`  ${familyMap.size} families ready.\n`);

  // ── 2. CLASSES + SECTIONS ────────────────────────────────────────────
  console.log('Importing classes & sections...');
  const classRows = readRows('CLASS.txt');
  const classCodeMap = new Map<number, string>(); // legacy C_CODE -> new Section id

  for (const row of classRows) {
    const cCode = n(row[2]);
    const className = titleCase(s(row[3]));
    const sectionName = titleCase(s(row[4])) || 'A';
    const capacity = n(row[10]);
    if (cCode === null || !className) continue;

    let klass = await prisma.class.findFirst({
      where: { branchId: branch.id, name: className },
    });
    if (!klass) {
      klass = await prisma.class.create({
        data: { schoolId: school.id, branchId: branch.id, name: className },
      });
    }

    let section = await prisma.section.findFirst({
      where: { classId: klass.id, academicYearId: academicYear.id, name: sectionName },
    });
    if (!section) {
      section = await prisma.section.create({
        data: {
          classId: klass.id,
          academicYearId: academicYear.id,
          name: sectionName,
          capacity: capacity ?? undefined,
        },
      });
    }
    classCodeMap.set(cCode, section.id);
  }
  console.log(`  ${classCodeMap.size} class/section combinations ready.\n`);

  // ── 3. STUDENTS ──────────────────────────────────────────────────────
  console.log('Importing students...');
  const studentRows = readRows('STUDENT.txt');
  const studentDefaultPasswordHash = await bcrypt.hash('Student@123', 10);

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const row of studentRows) {
    const srNo = n(row[0]);
    if (srNo === null) {
      skipped++;
      continue;
    }

    const name = s(row[5]) || `Student ${srNo}`;
    const sex = s(row[6]);
    const gender: Gender | null = sex === 'M' ? Gender.MALE : sex === 'F' ? Gender.FEMALE : null;
    const fmlyCode = n(row[14]);
    const curClCode = n(row[37]);

    const admissionNo = `JND-${srNo}`;
    const email = `jnd.s${srNo}@students.daralarqam.local`;

    const existing = await prisma.studentProfile.findFirst({ where: { legacySrNo: srNo } });
    if (existing) {
      skipped++;
      continue;
    }

    // Also guard against admissionNo collision (in case of partial prior run)
    const existingByAdmission = await prisma.studentProfile.findUnique({ where: { admissionNo } });
    if (existingByAdmission) {
      skipped++;
      continue;
    }

    const sectionId = curClCode !== null ? classCodeMap.get(curClCode) ?? null : null;
    const familyId = fmlyCode !== null ? familyMap.get(fmlyCode) ?? null : null;

    const user = await prisma.user.create({
      data: {
        fullName: name,
        email,
        passwordHash: studentDefaultPasswordHash,
        schoolId: school.id,
        branchId: branch.id,
        isActive: true,
      },
    });

    const studentRole = await prisma.role.findUniqueOrThrow({ where: { name: 'STUDENT' } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: studentRole.id } });

    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        admissionNo,
        dateOfBirth: parseFoxDate(row[7]) ?? undefined,
        gender: gender ?? undefined,
        admissionDate: parseFoxDate(row[1]) ?? new Date(),
        guardianName: s(row[16]) ?? undefined,
        guardianPhone: s(row[31]) ?? s(row[30]) ?? undefined,
        guardianCnic: s(row[17]) ?? undefined,
        address: s(row[29]) ?? undefined,
        motherName: s(row[21]) ?? undefined,
        religion: s(row[26]) ?? undefined,
        caste: s(row[27]) ?? undefined,
        nationality: s(row[28]) ?? undefined,
        bloodGroup: s(row[9]) ?? undefined,
        reference: s(row[3]) ?? undefined,
        legacySrNo: srNo,
        familyId: familyId ?? undefined,
        sectionId: sectionId ?? undefined,
        isActive: true,
      },
    });

    created++;
    if (created % 50 === 0) console.log(`  ...${created} students imported so far`);
  }
  console.log(`  Students: ${created} created, ${skipped} skipped (already existed), ${updated} updated.\n`);

  // ── 4. STAFF ─────────────────────────────────────────────────────────
  console.log('Importing staff...');
  const staffRows = readRows('STAFF.txt');
  const staffDefaultPasswordHash = await bcrypt.hash('Staff@123', 10);

  let staffCreated = 0;
  let staffSkipped = 0;

  for (const row of staffRows) {
    const srNo = n(row[0]);
    if (srNo === null) continue;

    const existing = await prisma.staffProfile.findFirst({ where: { legacySrNo: srNo } });
    if (existing) {
      staffSkipped++;
      continue;
    }

    const name = s(row[6]) || `Staff ${srNo}`;
    const category = s(row[13]);
    const designation = s(row[15]);
    const basicPay = n(row[16]);
    const email = `jnd.st${srNo}@staff.daralarqam.local`;

    const user = await prisma.user.create({
      data: {
        fullName: name,
        email,
        passwordHash: staffDefaultPasswordHash,
        schoolId: school.id,
        branchId: branch.id,
        isActive: true,
      },
    });

    const upperCat = (category || '').toUpperCase();
    let roleName: string | null = null;
    if (upperCat.includes('TEACH') || upperCat.includes('QARI')) roleName = 'TEACHER';
    else if (upperCat.includes('ADMIN')) roleName = 'ADMIN';

    if (roleName) {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (role) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }
    }

    await prisma.staffProfile.create({
      data: {
        userId: user.id,
        schoolId: school.id,
        branchId: branch.id,
        category: category ?? undefined,
        designation: designation ?? undefined,
        education: s(row[10]) ?? undefined,
        cnic: s(row[9]) ?? undefined,
        address: s(row[11]) ?? undefined,
        phone: s(row[12]) ?? undefined,
        dateOfBirth: parseFoxDate(row[8]) ?? undefined,
        joiningDate: parseFoxDate(row[1]) ?? undefined,
        basicPay: basicPay ?? undefined,
        legacySrNo: srNo,
        isActive: true,
      },
    });

    staffCreated++;
  }
  console.log(`  Staff: ${staffCreated} created, ${staffSkipped} skipped (already existed).\n`);

  console.log('Import complete.');
  console.log('Default student login password: Student@123');
  console.log('Default staff login password:   Staff@123');
  console.log('(emails follow the pattern jnd.s<SR_NO>@students.daralarqam.local / jnd.st<SR_NO>@staff.daralarqam.local)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
