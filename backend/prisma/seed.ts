import { PrismaClient, BranchGender, Gender } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ROLES = [
  'CHAIRMAN',
  'DIRECTOR',
  'ADMIN',
  'PRINCIPAL',
  'COORDINATOR',
  'ACCOUNTANT',
  'TEACHER',
  'STUDENT',
  'PARENT',
  'LIBRARIAN',
  'RECEPTIONIST',
];

// Base permission keys - more will be added as modules are built (Milestone 2+)
const PERMISSIONS = [
  'user.manage',
  'school.manage',
  'branch.manage',
  'report.view_all',
  'report.view_own_school',
  // Milestone 2
  'academic_year.manage',
  'class.manage',
  'section.manage',
  'student.manage',
  'teacher.manage',
  // Milestone 3
  'attendance.mark',
  'attendance.view',
  // Milestone 4
  'income.manage',
  'expense.manage',
  'finance.view',
  // Milestone 5
  'subject.manage',
  'exam.manage',
  'result.enter',
  'result.view',
];

async function main() {
  console.log('Seeding: Schools...');
  const schools = await Promise.all(
    [
      { name: 'Dar-e-Arqam Jandanwala Campus', code: 'JND' },
      { name: 'Dar-e-Arqam Rodi Campus', code: 'RODI' },
      { name: 'Dar-e-Arqam Ali Khel Campus', code: 'AKC' },
    ].map((s) =>
      prisma.school.upsert({
        where: { code: s.code },
        update: {},
        create: s,
      }),
    ),
  );

  // These are the original, already-branded Dar-e-Arqam campuses - keep
  // showing their real logo. Any NEW school created later (a future
  // customer) gets no SchoolSetting row / no logoUrl, so the app falls back
  // to the generic "School Management System" branding until that school's
  // own Director uploads a logo via Settings.
  console.log('Seeding: Legacy logo for existing Dar-e-Arqam campuses...');
  for (const school of schools) {
    await prisma.schoolSetting.upsert({
      where: { schoolId: school.id },
      update: {},
      create: { schoolId: school.id, logoUrl: '/logo.png', weekendDays: [7] },
    });
  }

  console.log('Seeding: Branches (Boys/Girls per school)...');
  for (const school of schools) {
    await prisma.branch.upsert({
      where: { schoolId_name: { schoolId: school.id, name: `${school.name} - Boys Campus` } },
      update: {},
      create: {
        schoolId: school.id,
        name: `${school.name} - Boys Campus`,
        genderScope: BranchGender.BOYS,
      },
    });
    await prisma.branch.upsert({
      where: { schoolId_name: { schoolId: school.id, name: `${school.name} - Girls Campus` } },
      update: {},
      create: {
        schoolId: school.id,
        name: `${school.name} - Girls Campus`,
        genderScope: BranchGender.GIRLS,
      },
    });
  }

  console.log('Seeding: Roles...');
  const roleRecords = await Promise.all(
    ROLES.map((name) =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  console.log('Seeding: Permissions...');
  const permissionRecords = await Promise.all(
    PERMISSIONS.map((key) =>
      prisma.permission.upsert({ where: { key }, update: {}, create: { key } }),
    ),
  );

  console.log('Seeding: Director gets all base permissions...');
  const directorRole = roleRecords.find((r) => r.name === 'DIRECTOR')!;
  for (const perm of permissionRecords) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: directorRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: directorRole.id, permissionId: perm.id },
    });
  }

  console.log('Seeding: Default Director account (CHANGE PASSWORD AFTER FIRST LOGIN)...');
  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
  const director = await prisma.user.upsert({
    where: { email: 'director@daralarqam.local' },
    update: {},
    create: {
      fullName: 'System Director',
      email: 'director@daralarqam.local',
      passwordHash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: director.id, roleId: directorRole.id } },
    update: {},
    create: { userId: director.id, roleId: directorRole.id },
  });

  console.log('Seeding: Chairman role for the existing Director account (Dar-e-Arqam grandfathered in as tenant #1)...');
  const chairmanRole = roleRecords.find((r) => r.name === 'CHAIRMAN')!;
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: director.id, roleId: chairmanRole.id } },
    update: {},
    create: { userId: director.id, roleId: chairmanRole.id },
  });
  // Informational ownership link only - see the comment on School.directorId.
  await Promise.all(
    schools.map((school) =>
      prisma.school.update({ where: { id: school.id }, data: { directorId: director.id } }),
    ),
  );

  // Backfill Login ID codes for this grandfathered account as tenant "01" -
  // otherwise the FIRST real new Director onboarded via /platform/directors
  // would also compute to "01" (nextTenantCode() counts existing tenantCodes,
  // and this account predates the Login ID system). Every NEW Director from
  // here on gets "02", "03", ... automatically - see common/utils/login-id.ts.
  console.log('Seeding: Login ID codes (tenant 01) for the grandfathered Director + their 3 schools/6 branches...');
  await prisma.user.update({ where: { id: director.id }, data: { tenantCode: '01' } });
  for (let i = 0; i < schools.length; i++) {
    const schoolSeq = String(i + 1).padStart(2, '0');
    await prisma.school.update({ where: { id: schools[i].id }, data: { tenantCode: '01', schoolSeq } });

    const branches = await prisma.branch.findMany({ where: { schoolId: schools[i].id }, orderBy: { name: 'asc' } });
    for (let b = 0; b < branches.length; b++) {
      await prisma.branch.update({ where: { id: branches[b].id }, data: { branchSeq: String(b + 1).padStart(2, '0') } });
    }
  }

  console.log('Seeding: Demo Admin / Principal / Coordinator accounts...');
  const jandanwalaForDemo = await prisma.school.findUniqueOrThrow({ where: { code: 'JND' } });

  const demoStaffAccounts = [
    { role: 'ADMIN', email: 'admin.demo@daralarqam.local', fullName: 'Demo Admin', password: 'Admin123!' },
    { role: 'PRINCIPAL', email: 'principal.demo@daralarqam.local', fullName: 'Demo Principal', password: 'Principal123!' },
    { role: 'COORDINATOR', email: 'coordinator.demo@daralarqam.local', fullName: 'Demo Coordinator', password: 'Coordinator123!' },
  ];

  for (const acc of demoStaffAccounts) {
    const role = roleRecords.find((r) => r.name === acc.role)!;
    const hash = await bcrypt.hash(acc.password, 10);
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: {},
      create: {
        fullName: acc.fullName,
        email: acc.email,
        passwordHash: hash,
        schoolId: jandanwalaForDemo.id,
        isActive: true,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }

  // ── MILESTONE 2: Academic Year, Classes, Sections, demo Teacher + Student ──
  console.log('Seeding: Academic Year 2026-2027 for each school...');
  const academicYears = await Promise.all(
    schools.map((school) =>
      prisma.academicYear.upsert({
        where: { schoolId_name: { schoolId: school.id, name: '2026-2027' } },
        update: {},
        create: {
          schoolId: school.id,
          name: '2026-2027',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2027-05-31'),
          isActive: true,
        },
      }),
    ),
  );

  // Demo classes/sections are seeded only for Jandanwala Boys Campus, so you have
  // real data to test against without bloating the seed for all 6 branches.
  console.log('Seeding: Demo classes + sections (Jandanwala Boys Campus)...');
  const jandanwala = schools.find((s) => s.code === 'JND')!;
  const jandanwalaYear = academicYears.find((y) => y.schoolId === jandanwala.id)!;
  const jandanwalaBoysBranch = await prisma.branch.findFirstOrThrow({
    where: { schoolId: jandanwala.id, genderScope: BranchGender.BOYS },
  });

  const classNames = ['Nursery', 'KG', 'Class 1', 'Class 2', 'Class 3'];
  for (let i = 0; i < classNames.length; i++) {
    const klass = await prisma.class.upsert({
      where: { branchId_name: { branchId: jandanwalaBoysBranch.id, name: classNames[i] } },
      update: {},
      create: {
        schoolId: jandanwala.id,
        branchId: jandanwalaBoysBranch.id,
        name: classNames[i],
        order: i,
      },
    });

    await prisma.section.upsert({
      where: {
        classId_academicYearId_name: {
          classId: klass.id,
          academicYearId: jandanwalaYear.id,
          name: 'A',
        },
      },
      update: {},
      create: {
        classId: klass.id,
        academicYearId: jandanwalaYear.id,
        name: 'A',
        capacity: 30,
      },
    });
  }

  console.log('Seeding: Demo Teacher account + class teacher assignment...');
  const teacherRole = roleRecords.find((r) => r.name === 'TEACHER')!;
  const teacherPasswordHash = await bcrypt.hash('Teacher123!', 10);
  const demoTeacher = await prisma.user.upsert({
    where: { email: 'teacher.demo@daralarqam.local' },
    update: {},
    create: {
      fullName: 'Ayesha Khan',
      email: 'teacher.demo@daralarqam.local',
      passwordHash: teacherPasswordHash,
      schoolId: jandanwala.id,
      branchId: jandanwalaBoysBranch.id,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoTeacher.id, roleId: teacherRole.id } },
    update: {},
    create: { userId: demoTeacher.id, roleId: teacherRole.id },
  });
  await prisma.teacherProfile.upsert({
    where: { userId: demoTeacher.id },
    update: {},
    create: {
      userId: demoTeacher.id,
      employeeId: 'JND-T-001',
      qualification: 'B.Ed',
      subjectSpecialty: 'General',
    },
  });

  const class1Section = await prisma.section.findFirstOrThrow({
    where: { class: { name: 'Class 1', branchId: jandanwalaBoysBranch.id }, academicYearId: jandanwalaYear.id },
  });
  await prisma.section.update({
    where: { id: class1Section.id },
    data: { classTeacherId: demoTeacher.id },
  });

  console.log('Seeding: Demo Student account, enrolled in Class 1 - A...');
  const studentRole = roleRecords.find((r) => r.name === 'STUDENT')!;
  const studentPasswordHash = await bcrypt.hash('Student123!', 10);
  const demoStudent = await prisma.user.upsert({
    where: { email: 'student.demo@daralarqam.local' },
    update: {},
    create: {
      fullName: 'Ali Hassan',
      email: 'student.demo@daralarqam.local',
      passwordHash: studentPasswordHash,
      schoolId: jandanwala.id,
      branchId: jandanwalaBoysBranch.id,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoStudent.id, roleId: studentRole.id } },
    update: {},
    create: { userId: demoStudent.id, roleId: studentRole.id },
  });
  await prisma.studentProfile.upsert({
    where: { userId: demoStudent.id },
    update: {},
    create: {
      userId: demoStudent.id,
      admissionNo: 'JND-2026-001',
      gender: Gender.MALE,
      sectionId: class1Section.id,
      guardianName: 'Hassan Mahmood',
      guardianPhone: '0300-0000000',
    },
  });

  console.log('Seed complete.');
  console.log('Login with: director@daralarqam.local / ChangeMe123!');
  console.log('Demo Admin: admin.demo@daralarqam.local / Admin123!');
  console.log('Demo Principal: principal.demo@daralarqam.local / Principal123!');
  console.log('Demo Coordinator: coordinator.demo@daralarqam.local / Coordinator123!');
  console.log('Demo Teacher: teacher.demo@daralarqam.local / Teacher123!');
  console.log('Demo Student: student.demo@daralarqam.local / Student123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
