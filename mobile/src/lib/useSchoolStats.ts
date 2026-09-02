import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { useAuth } from './auth';

export type SchoolStats = {
  studentCount: number;
  teacherCount: number;
  pendingLeave: number;
  attendancePct: number | null;
};

function todayIso() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Quick "at a glance" numbers for the Director/Admin/Principal home screen -
// mirrors the web portal's dashboard cards, kept intentionally small since
// this is a phone screen, not the full Predictive Analytics page.
export function useSchoolStats() {
  const { user, hasRole } = useAuth();
  const [stats, setStats] = useState<SchoolStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL')) return;
    let cancelled = false;
    (async () => {
      if (!user?.schoolId) {
        if (!cancelled) setError('No school is linked to your account yet.');
        return;
      }
      try {
        const [students, teachers, pendingLeave, attendance] = await Promise.all([
          api.get<unknown[]>('/students'),
          api.get<unknown[]>('/teachers'),
          api.get<unknown[]>('/leave-requests', { status: 'PENDING' }),
          api
            .get<{ attendancePct: number | null }>('/attendance/school-report', { schoolId: user.schoolId, date: todayIso() })
            .catch(() => null),
        ]);
        if (cancelled) return;
        setStats({
          studentCount: students.length,
          teacherCount: teachers.length,
          pendingLeave: pendingLeave.length,
          attendancePct: attendance?.attendancePct ?? null,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load school stats.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasRole, user?.schoolId]);

  return { stats, error };
}
