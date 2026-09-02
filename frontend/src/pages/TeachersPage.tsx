import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Printer, Search, Upload, UserX, UsersRound } from 'lucide-react';
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
import type { TeacherProfile, School } from '@/types';

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  employeeId: string;
  schoolId: string;
  branchId: string;
  qualification: string;
  subjectSpecialty: string;
  joiningDate: string;
  cnic: string;
  address: string;
};

const EMPTY_FORM: FormState = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  employeeId: '',
  schoolId: '',
  branchId: '',
  qualification: '',
  subjectSpecialty: '',
  joiningDate: '',
  cnic: '',
  address: '',
};

export default function TeachersPage() {
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
  const [deactivateTarget, setDeactivateTarget] = useState<TeacherProfile | null>(null);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);

  const teachersQuery = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.get<TeacherProfile[]>('/teachers'),
  });
  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
    enabled: createOpen,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/teachers', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/teachers/${editingTeacherId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setCreateOpen(false);
      setEditingTeacherId(null);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/teachers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      setDeactivateTarget(null);
    },
  });

  const filtered = useMemo(() => {
    const list = teachersQuery.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (t) =>
        t.user.fullName.toLowerCase().includes(q) ||
        t.employeeId.toLowerCase().includes(q) ||
        t.user.email.toLowerCase().includes(q),
    );
  }, [teachersQuery.data, search]);

  const schoolBranches = useMemo(() => {
    const school = schoolsQuery.data?.find((s) => s.id === (isUnrestricted ? form.schoolId : user?.schoolId));
    return school?.branches ?? [];
  }, [schoolsQuery.data, form.schoolId, isUnrestricted, user?.schoolId]);

  function openCreate() {
    setEditingTeacherId(null);
    setForm({ ...EMPTY_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setFormError(null);
    setCreateOpen(true);
  }

  function openEdit(t: TeacherProfile) {
    setEditingTeacherId(t.id);
    setForm({
      fullName: t.user.fullName,
      email: t.user.email,
      phone: t.user.phone ?? '',
      password: '',
      employeeId: t.employeeId,
      schoolId: '',
      branchId: '',
      qualification: t.qualification ?? '',
      subjectSpecialty: t.subjectSpecialty ?? '',
      joiningDate: t.joiningDate ? t.joiningDate.slice(0, 10) : '',
      cnic: t.cnic ?? '',
      address: t.address ?? '',
    });
    setFormError(null);
    setCreateOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (editingTeacherId) {
      if (!form.fullName || !form.email) {
        setFormError('Please fill all required fields.');
        return;
      }
      updateMutation.mutate({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        qualification: form.qualification || undefined,
        subjectSpecialty: form.subjectSpecialty || undefined,
        joiningDate: form.joiningDate || undefined,
        cnic: form.cnic || undefined,
        address: form.address || undefined,
      });
      return;
    }

    const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId;
    if (!effectiveSchoolId) {
      setFormError('Please select a school.');
      return;
    }
    if (!form.branchId || !form.employeeId || !form.fullName || !form.email || !form.password) {
      setFormError('Please fill all required fields.');
      return;
    }

    createMutation.mutate({
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      employeeId: form.employeeId,
      schoolId: effectiveSchoolId,
      branchId: form.branchId,
      qualification: form.qualification || undefined,
      subjectSpecialty: form.subjectSpecialty || undefined,
      joiningDate: form.joiningDate || undefined,
      cnic: form.cnic || undefined,
      address: form.address || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Teachers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {teachersQuery.data?.length ?? 0} teacher{teachersQuery.data?.length === 1 ? '' : 's'} on staff
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
              Add Teacher
            </Button>
          </div>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, employee ID, or email..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {teachersQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UsersRound className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No teachers found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search ? 'Try a different search term.' : 'Add your first teacher to get started.'}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Subject Specialty</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials(t.user.fullName)}
                        </div>
                        <span className="font-medium text-foreground">{t.user.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{t.employeeId}</TableCell>
                    <TableCell className="text-muted-foreground">{t.subjectSpecialty || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{t.user.email}</TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? 'success' : 'secondary'}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <IdCardButton kind="teachers" id={t.id} />
                          <PhotoUploadButton
                            kind="teachers"
                            id={t.id}
                            onUploaded={() => queryClient.invalidateQueries({ queryKey: ['teachers'] })}
                          />
                          {canDeactivate && t.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeactivateTarget(t)}
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

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setEditingTeacherId(null);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editingTeacherId ? 'Edit Teacher' : 'Add Teacher'}</DialogTitle>
            <DialogDescription>
              {editingTeacherId
                ? "Update this teacher's contact info, subject, and other details."
                : 'Creates a login account and teacher profile in one step.'}
            </DialogDescription>
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
              <Field label="Employee ID" required>
                <Input
                  value={form.employeeId}
                  onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                  disabled={!!editingTeacherId}
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
              <Field label="Phone">
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </Field>
              {!editingTeacherId && (
                <Field label="Password" required>
                  <PasswordInput
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                  />
                </Field>
              )}

              {!editingTeacherId && isUnrestricted && (
                <Field label="School" required>
                  <Select
                    value={form.schoolId}
                    onValueChange={(v) => setForm((f) => ({ ...f, schoolId: v, branchId: '' }))}
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

              {!editingTeacherId && (
                <Field label="Branch" required>
                  <Select
                    value={form.branchId}
                    onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
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
              )}

              <Field label="Subject specialty">
                <Input
                  value={form.subjectSpecialty}
                  onChange={(e) => setForm((f) => ({ ...f, subjectSpecialty: e.target.value }))}
                  placeholder="e.g. Mathematics"
                />
              </Field>
              <Field label="Qualification">
                <Input
                  value={form.qualification}
                  onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))}
                  placeholder="e.g. M.Sc"
                />
              </Field>
              <Field label="Joining date">
                <Input
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => setForm((f) => ({ ...f, joiningDate: e.target.value }))}
                />
              </Field>
              <Field label="CNIC">
                <Input value={form.cnic} onChange={(e) => setForm((f) => ({ ...f, cnic: e.target.value }))} />
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setEditingTeacherId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingTeacherId ? updateMutation.isPending : createMutation.isPending}>
                {editingTeacherId ? 'Save Changes' : 'Create Teacher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate teacher?"
        description={`This will disable ${deactivateTarget?.user.fullName ?? 'this teacher'}'s login and mark them inactive. This can be reversed by an administrator later.`}
        confirmLabel="Deactivate"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
      />

      <BulkImportDialog
        kind="teachers"
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['teachers'] })}
      />

      <IdCardBatchDialog kind="teachers" open={idCardBatchOpen} onOpenChange={setIdCardBatchOpen} />
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
