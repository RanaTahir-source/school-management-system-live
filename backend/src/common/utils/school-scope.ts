import { ForbiddenException } from '@nestjs/common';

// Roles that can see/act on every school (platform-wide oversight).
//
// Only CHAIRMAN is truly cross-tenant. DIRECTOR and ADMIN are NOT here even
// though the very first Director account (the grandfathered Dar-e-Arqam
// owner, who legitimately runs 3 campuses as one business) also holds a
// separate CHAIRMAN role for exactly that reason - see prisma/seed.ts. Every
// *new* Director the Chairman onboards for a different customer must be
// locked to their own school like everyone else, or every tenant's data
// would be visible to every other tenant's Director. Do not add DIRECTOR or
// ADMIN back here.
const UNRESTRICTED_ROLES = ['CHAIRMAN'];

// userId is optional here because most callers only need roles/schoolId for
// the school-level checks below; endpoints that also need per-record
// ownership checks (e.g. "is this MY invoice") read it off the same object -
// the JWT strategy always includes it at runtime.
export type ScopedUser = { userId?: string; roles: string[]; schoolId?: string | null };

// Throws if currentUser isn't allowed to read/write data for targetSchoolId.
// Call this at the top of any service method that accepts a schoolId
// (query param or DTO field) before touching the database.
export function assertSchoolAccess(currentUser: ScopedUser, targetSchoolId: string | null | undefined) {
  const isUnrestricted = currentUser.roles.some((r) => UNRESTRICTED_ROLES.includes(r));
  if (isUnrestricted) return;

  if (!currentUser.schoolId) {
    throw new ForbiddenException('Your account is not assigned to a school');
  }
  if (!targetSchoolId || targetSchoolId !== currentUser.schoolId) {
    throw new ForbiddenException("You do not have access to this school's data");
  }
}

// For list/filter endpoints where schoolId is an optional query param:
// - Director/Admin: passed through as-is (undefined = every school).
// - Everyone else: defaults to their own school if omitted, or throws if
//   they explicitly asked for a different one.
export function resolveSchoolScope(
  currentUser: ScopedUser,
  requestedSchoolId: string | null | undefined,
): string | undefined {
  const isUnrestricted = currentUser.roles.some((r) => UNRESTRICTED_ROLES.includes(r));
  if (isUnrestricted) return requestedSchoolId ?? undefined;

  if (!currentUser.schoolId) {
    throw new ForbiddenException('Your account is not assigned to a school');
  }
  if (requestedSchoolId && requestedSchoolId !== currentUser.schoolId) {
    throw new ForbiddenException("You do not have access to this school's data");
  }
  return currentUser.schoolId;
}
