import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { useAuth } from './auth';

export type MyChild = {
  studentId: string;
  fullName: string;
  admissionNo: string;
  photoUrl: string | null;
  isActive: boolean;
  className: string | null;
};

// GET /parent-portal/children for a logged-in PARENT account - every child
// linked to this parent via ParentStudent, regardless of legacy Family
// grouping (some parents were created without a FoxPro FMLY_CODE).
export function useMyChildren() {
  const { hasRole } = useAuth();
  const isParent = hasRole('PARENT');
  const [children, setChildren] = useState<MyChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isParent) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await api.get<any[]>('/parent-portal/children');
      setChildren(
        data.map((link) => ({
          studentId: link.student.id,
          fullName: link.student.user?.fullName ?? '',
          admissionNo: link.student.admissionNo,
          photoUrl: link.student.photoUrl ?? null,
          isActive: link.student.user?.isActive ?? true,
          className: link.student.section ? `${link.student.section.class.name} - ${link.student.section.name}` : null,
        })),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load your children');
    } finally {
      setLoading(false);
    }
  }, [isParent]);

  useEffect(() => {
    load();
  }, [load]);

  return { children, loading, error, reload: load };
}
