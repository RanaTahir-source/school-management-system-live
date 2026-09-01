import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Plus, Printer, Search, Upload, UserX } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BulkImportDialog } from '@/components/BulkImportDialog';
import { IdCardBatchDialog, IdCardButton, PhotoUploadButton } from '@/components/IdCardActions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { initials } from '@/lib/utils';
import type { StudentProfile, School, ClassRecord, SectionRecord } from '@/types';

type FormState = {
  fullName: string;
  email: string;
  password: string;
  admissionNo: string;
  schoolId: string;
  branchId: string;
  classId: string;
  sectionId: string;
  gender: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
};

const EMPTY_FORM: FormState = {
  fullName: '',
  email: '',
  password: '',
  admissionNo: '',
  schoolId: '',
  branchId: '',
  classId: '',
  sectionId: '',
  gender: '',
  dateOfBirth: '',
  guardianName: '',
  guardianPhone: '',
  address: '',
};

export default function StudentsPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const canDeactivate = hasRole('DIRECTOR', 'ADMIN');
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [idCardBatchOpen, setIdCardBatchOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StudentProfile | null>(null);

  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => api.get<StudentProfile[]>('/students'),
  });
  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
    enabled: createOpen,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassRecord[]>('/classes'),
    enabled: createOpen,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections', 'byClass', form.classId],
    queryFn: () => api.get<SectionRecord[]>('/sections', { classId: form.classId }),
    enabled: createOpen && !!form.classId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/students', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/students/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setDeactivateTarget(null);
    },
  });

  const filtered = useMemo(() => {
    const list = studentsQuery.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (s) =>
        s.user.fullName.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.user.email.toLowerCase().includes(q),
    );
  }, [studentsQuery.data, search]);

  const schoolBranches = useMemo(() => {
    const school = schoolsQuery.data?.find((s) => s.id === (isUnrestricted ? form.schoolId : user?.schoolId));
    return school?.branches ?? [];
  }, [schoolsQuery.data, form.schoolId, isUnrestricted, user?.schoolId]);

  const branchClasses = useMemo(() => {
    const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId;
    return (classesQuery.data ?? []).filter(
      (c) => c.schoolId === effectiveSchoolId && (!form.branchId || c.branchId === form.branchId),
    );
  }, [classesQuery.data, form.schoolId, form.branchId, isUnrestricted, user?.schoolId]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setFormError(null);
    setCreateOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId;
    if (!effectiveSchoolId) {
      setFormError('Please select a school.');
      return;
    }
    if (!form.branchId || !form.admissionNo || !form.fullName || !form.email || !form.password) {
      setFormError('Please fill all required fields.');
      return;
    }

    createMutation.mutate({
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      admissionNo: form.admissionNo,
      schoolId: effectiveSchoolId,
      branchId: form.branchId,
      sectionId: form.sectionId || undefined,
      gender: form.gender || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      guardianName: form.guardianName || undefined,
      guardianPhone: form.guardianPhone || undefined,
      address: form.address || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Students</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {studentsQuery.data?.length ?? 0} student{studentsQuery.data?.length === 1 ? '' : 's'} enrolled
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIdCardBatchOpen(true)}>
              <Printer className="h-4 w-4" />
              Print ID Cards
            </Button>
            <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Bulk Import
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Student
            </Button>
          </div>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, admission no, or email..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {studentsQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <GraduationCap className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No students found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search ? 'Try a different search term.' : 'Add your first student to get started.'}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No</TableHead>
                  <TableHead>Class / Section</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials(s.user.fullName)}
                        </div>
                        <span className="font-medium text-foreground">{s.user.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{s.admissionNo}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.section ? `${s.section.class?.name ?? '-'} / ${s.section.name}` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.user.email}</TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? 'success' : 'secondary'}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <IdCardButton kind="students" id={s.id} />
                          <PhotoUploadButton
                            kind="students"
                            id={s.id}
                            onUploaded={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
                          />
                          {canDeactivate && s.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeactivateTarget(s)}
                            >
                              <UserX className="h-4 w-4" />
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>Creates a login account and student profile in one step.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" required>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Admission No." required>
                <Input
                  value={form.admissionNo}
                  onChange={(e) => setForm((f) => ({ ...f, admissionNo: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Email" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Password" required>
                <PasswordInput
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
              </Field>

              {isUnrestricted && (
                <Field label="School" required>
                  <Select
                    value={form.schoolId}
                    onValueChange={(v) => setForm((f) => ({ ...f, schoolId: v, branchId: '', classId: '', sectionId: '' }))}
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
                </Field>
              )}

              <Field label="Branch" required>
                <Select
                  value={form.branchId}
                  onValueChange={(v) => setForm((f) => ({ ...f, branchId: v, classId: '', sectionId: '' }))}
                  disabled={!schoolBranches.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Class">
                <Select
                  value={form.classId}
                  onValueChange={(v) => setForm((f) => ({ ...f, classId: v, sectionId: '' }))}
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
              </Field>

              <Field label="Section">
                <Select
                  value={form.sectionId}
                  onValueChange={(v) => setForm((f) => ({ ...f, sectionId: v }))}
                  disabled={!form.classId || !sectionsQuery.data?.length}
                >
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
              </Field>

              <Field label="Gender">
                <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Date of birth">
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                />
              </Field>
              <Field label="Guardian name">
                <Input
                  value={form.guardianName}
                  onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))}
                />
              </Field>
              <Field label="Guardian phone">
                <Input
                  value={form.guardianPhone}
                  onChange={(e) => setForm((f) => ({ ...f, guardianPhone: e.target.value }))}
                />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </Field>
            </div>

            {formError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Create Student
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate student?"
        description={`This will disable ${deactivateTarget?.user.fullName ?? 'this student'}'s login and mark them inactive. This can be reversed by an administrator later.`}
        confirmLabel="Deactivate"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
      />

      <BulkImportDialog
        kind="students"
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
      />

      <IdCardBatchDialog kind="students" open={idCardBatchOpen} onOpenChange={setIdCardBatchOpen} />
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 inline-block">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
