import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, CreditCard, Printer } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { School, ClassRecord, SectionRecord } from '@/types';

type Kind = 'students' | 'teachers';

// Opens a single person's ID card as a print-ready PDF - one per row.
export function IdCardButton({ kind, id }: { kind: Kind; id: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      title="Download ID card"
      onClick={() => api.openBlob(`/id-cards/${kind}/${id}`)}
    >
      <CreditCard className="h-4 w-4" />
    </Button>
  );
}

// Uploads/replaces the photo used on this person's ID card (and, for
// students, their fee receipts and result cards too - same photoUrl field).
export function PhotoUploadButton({
  kind,
  id,
  onUploaded,
}: {
  kind: Kind;
  id: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.upload(`/${kind}/${id}/photo`, formData);
    },
    onSuccess: onUploaded,
  });

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) mutation.mutate(file);
          e.target.value = '';
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        title="Upload photo"
        loading={mutation.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="h-4 w-4" />
      </Button>
    </>
  );
}

// "Print ID Cards" toolbar dialog - a whole section (students) or a whole
// branch (teachers) laid out on A4 sheets, ready to print and cut apart.
export function IdCardBatchDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: Kind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, hasRole } = useAuth();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');
  const label = kind === 'students' ? 'Students' : 'Teachers';

  const [schoolId, setSchoolId] = useState(isUnrestricted ? '' : user?.schoolId ?? '');
  const [branchId, setBranchId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
    enabled: open,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassRecord[]>('/classes'),
    enabled: open && kind === 'students',
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections', 'byClass', classId],
    queryFn: () => api.get<SectionRecord[]>('/sections', { classId }),
    enabled: open && kind === 'students' && !!classId,
  });

  const branches = useMemo(() => {
    const effectiveSchoolId = isUnrestricted ? schoolId : user?.schoolId;
    return schoolsQuery.data?.find((s) => s.id === effectiveSchoolId)?.branches ?? [];
  }, [schoolsQuery.data, schoolId, isUnrestricted, user?.schoolId]);

  const branchClasses = useMemo(() => {
    const effectiveSchoolId = isUnrestricted ? schoolId : user?.schoolId;
    return (classesQuery.data ?? []).filter(
      (c) => c.schoolId === effectiveSchoolId && (!branchId || c.branchId === branchId),
    );
  }, [classesQuery.data, schoolId, branchId, isUnrestricted, user?.schoolId]);

  function reset() {
    setSchoolId(isUnrestricted ? '' : user?.schoolId ?? '');
    setBranchId('');
    setClassId('');
    setSectionId('');
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handlePrint() {
    setError(null);
    if (kind === 'students') {
      if (!sectionId) return setError('Please select a class and section.');
      api.openBlob(`/id-cards/students/batch/section/${sectionId}`);
    } else {
      if (!branchId) return setError('Please select a branch.');
      api.openBlob(`/id-cards/teachers/batch/branch/${branchId}`);
    }
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Print {label} ID Cards</DialogTitle>
          <DialogDescription>
            Generates an A4 print sheet with every {kind === 'students' ? 'student in the section' : 'teacher in the branch'} -
            cut the cards apart after printing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isUnrestricted && (
            <div>
              <Label className="mb-1.5 inline-block">
                School <span className="text-destructive">*</span>
              </Label>
              <Select
                value={schoolId}
                onValueChange={(v) => {
                  setSchoolId(v);
                  setBranchId('');
                  setClassId('');
                  setSectionId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select school" />
                </SelectTrigger>
                <SelectContent>
                  {(schoolsQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="mb-1.5 inline-block">
              Branch <span className="text-destructive">*</span>
            </Label>
            <Select
              value={branchId}
              onValueChange={(v) => {
                setBranchId(v);
                setClassId('');
                setSectionId('');
              }}
              disabled={!branches.length}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === 'students' && (
            <>
              <div>
                <Label className="mb-1.5 inline-block">
                  Class <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={classId}
                  onValueChange={(v) => {
                    setClassId(v);
                    setSectionId('');
                  }}
                  disabled={!branchClasses.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 inline-block">
                  Section <span className="text-destructive">*</span>
                </Label>
                <Select value={sectionId} onValueChange={setSectionId} disabled={!classId || !sectionsQuery.data?.length}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sectionsQuery.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
