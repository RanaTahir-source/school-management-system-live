import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { useAuth } from './auth';

export type MyStudent = {
  id: string;
  admissionNo: string;
  fullName: string;
  photoUrl: string | null;
  section: { name: string; class: { name: string } } | null;
};

// Resolves "my own studentProfileId" for a logged-in STUDENT account (which
// is also what parents currently use to log in - see mobile/README.md).
// Everything else in the app (fee, attendance, results) needs this id.
export function useMyStudent() {
  const { hasRole } = useAuth();
  const [student, setStudent] = useState<MyStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRole('STUDENT')) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<any>('/students/me');
        if (cancelled) return;
        setStudent({
          id: data.id,
          admissionNo: data.admissionNo,
          fullName: data.user?.fullName ?? '',
          photoUrl: data.photoUrl ?? null,
          section: data.section
            ? { name: data.section.name, class: { name: data.section.class?.name ?? '' } }
            : null,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load your student profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasRole]);

  return { student, loading, error };
}
