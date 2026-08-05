import { PrismaService } from '../../modules/prisma/prisma.service';

// Numeric Login ID system (NADRA/CNIC-style), used instead of real email
// addresses for accounts a Director creates (Teacher/Student/Parent/Staff) -
// most of those people won't have a real, deliverable email, so baking a
// fake one into the `email` column just to satisfy a login form was worse
// than a purpose-built numeric ID.
//
// Shape (12 digits, no separators - see chat decision): TT SS BB RR NNNN
//   TT   = tenant code   (2 digits) - the owning Director's own number
//   SS   = school seq    (2 digits) - this school's number within that tenant
//   BB   = branch seq    (2 digits) - this branch's number within that school
//   RR   = role code     (2 digits) - see ROLE_CODES below
//   NNNN = person seq    (4 digits) - sequence within that exact TT-SS-BB-RR combo
//
// Example: 020101060001 = tenant 02, school 01, branch 01, Teacher (06), 1st person.
//
// A Director's own account (before they've created a school/branch) uses
// "00" for school and branch: e.g. 020000010001.

export const ROLE_CODES: Record<string, string> = {
  CHAIRMAN: '00',
  DIRECTOR: '01',
  ADMIN: '02',
  PRINCIPAL: '03',
  COORDINATOR: '04',
  ACCOUNTANT: '05',
  TEACHER: '06',
  STUDENT: '07',
  PARENT: '08',
  LIBRARIAN: '09',
  RECEPTIONIST: '10',
};

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

// Next free 2-digit tenant code, assigned once per Director when the
// Chairman onboards them. Counts existing tenant codes rather than using a
// dedicated sequence table - fine at the volume a Chairman onboards
// directors at (not a high-concurrency path).
export async function nextTenantCode(prisma: PrismaService): Promise<string> {
  const count = await prisma.user.count({ where: { tenantCode: { not: null } } });
  return pad(count + 1, 2);
}

// Next free 2-digit school sequence within one tenant (Director).
export async function nextSchoolSeq(prisma: PrismaService, tenantCode: string): Promise<string> {
  const count = await prisma.school.count({ where: { tenantCode } });
  return pad(count + 1, 2);
}

// Next free 2-digit branch sequence within one school.
export async function nextBranchSeq(prisma: PrismaService, schoolId: string): Promise<string> {
  const count = await prisma.branch.count({ where: { schoolId } });
  return pad(count + 1, 2);
}

// Builds the full 12-digit Login ID and picks the next free person-sequence
// for that exact tenant+school+branch+role combination.
export async function buildLoginId(
  prisma: PrismaService,
  params: { tenantCode: string; schoolSeq: string; branchSeq: string; roleName: string },
): Promise<string> {
  const roleCode = ROLE_CODES[params.roleName.toUpperCase()];
  if (!roleCode) {
    throw new Error(`No Login ID role code configured for role "${params.roleName}"`);
  }
  const prefix = `${params.tenantCode}${params.schoolSeq}${params.branchSeq}${roleCode}`;

  const count = await prisma.user.count({ where: { loginId: { startsWith: prefix } } });
  return `${prefix}${pad(count + 1, 4)}`;
}

// One domain the platform owner controls (nexoradsa.org) - never a
// per-customer domain (buying/managing a real domain per school doesn't
// scale for a SaaS reseller). This builds a human-readable *alias* login
// email on top of the same numeric scoping, purely for memorability - the
// loginId above is still the guaranteed-unique credential; this is stored in
// the same `email` column and works as an alternate login (see auth.service.ts).
const ALIAS_DOMAIN = 'nexoradsa.org';

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20) || 'user';
}

// label examples: "farzana teacher" -> "farzana.teacher.mur@nexoradsa.org"
//                 "director" (no personal name yet)  -> "director.mur@nexoradsa.org"
export async function buildAliasEmail(
  prisma: PrismaService,
  params: { label: string; schoolCode: string },
): Promise<string> {
  const nameSlug = slugify(params.label);
  const schoolSlug = slugify(params.schoolCode);
  let candidate = `${nameSlug}.${schoolSlug}@${ALIAS_DOMAIN}`;
  let attempt = 1;
  // Extremely unlikely to collide (same name + same school), but stay safe.
  while (await prisma.user.findUnique({ where: { email: candidate } })) {
    attempt += 1;
    candidate = `${nameSlug}${attempt}.${schoolSlug}@${ALIAS_DOMAIN}`;
  }
  return candidate;
}
