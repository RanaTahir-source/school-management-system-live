import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
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
import type { School, StaffUser, Department, Designation } from '@/types';

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

function EmptyState({ icon: Icon, label }: { icon: typeof Building2; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

export default function DepartmentsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Departments & Designations</h2>
        <p className="mt-1 text-sm text-muted-foreground">Structured HR lookup — group staff by department and job title</p>
      </div>

      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="designations">Designations</TabsTrigger>
        </TabsList>
        <TabsContent value="departments">
          <DepartmentsTab />
        </TabsContent>
        <TabsContent value="designations">
          <DesignationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DEPARTMENTS
// ─────────────────────────────────────────────────────────────────────────

type DeptForm = { schoolId: string; name: string; description: string; headOfDepartmentId: string };
const EMPTY_DEPT_FORM: DeptForm = { schoolId: '', name: '', description: '', headOfDepartmentId: '' };

function DepartmentsTab() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DeptForm>(EMPTY_DEPT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const deptsQuery = useQuery({ queryKey: ['departments'], queryFn: () => api.get<Department[]>('/departments') });
  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools'), enabled: open && isUnrestricted });
  const staffQuery = useQuery({ queryKey: ['staff-users'], queryFn: () => api.get<StaffUser[]>('/users'), enabled: open });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/departments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setOpen(false);
      setForm(EMPTY_DEPT_FORM);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/departments/${editingId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY_DEPT_FORM);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDeleteTarget(null);
    },
  });

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_DEPT_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setError(null);
    setOpen(true);
  }
  function openEdit(dept: Department) {
    setEditingId(dept.id);
    setForm({
      schoolId: dept.schoolId,
      name: dept.name,
      description: dept.description ?? '',
      headOfDepartmentId: dept.headOfDepartmentId ?? '',
    });
    setError(null);
    setOpen(true);
  }
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !form.name.trim()) {
      setError('Please fill all required fields.');
      return;
    }
    const payload = {
      name: form.name,
      description: form.description || undefined,
      headOfDepartmentId: form.headOfDepartmentId || undefined,
    };
    if (editingId) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate({ ...payload, schoolId: effectiveSchoolId });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Department
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {deptsQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !deptsQuery.data?.length ? (
            <EmptyState icon={Building2} label="No departments yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Head of Department</TableHead>
                  <TableHead>Designations</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {deptsQuery.data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{d.name}</span>
                      {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.headOfDepartment?.fullName ?? '—'}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{d._count?.designations ?? 0}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{d._count?.staff ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={d.isActive ? 'success' : 'secondary'}>{d.isActive ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          {isUnrestricted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteTarget(d)}
                            >
                              <Trash2 className="h-4 w-4" />
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
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Department' : 'Add Department'}</DialogTitle>
            <DialogDescription>A department groups staff for reporting and org-chart purposes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select
                  value={form.schoolId}
                  onValueChange={(v) => setForm((f) => ({ ...f, schoolId: v }))}
                  disabled={!!editingId}
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
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Primary Section" required />
            </Field>
            <Field label="Description">
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            <Field label="Head of Department">
              <Select
                value={form.headOfDepartmentId || '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, headOfDepartmentId: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not assigned</SelectItem>
                  {(staffQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {error && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingId ? updateMutation.isPending : createMutation.isPending}>
                {editingId ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete department?"
        description={`This will remove "${deleteTarget?.name}". Designations/staff linked to it keep their records but lose this department link.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DESIGNATIONS
// ─────────────────────────────────────────────────────────────────────────

type DesigForm = { schoolId: string; name: string; departmentId: string };
const EMPTY_DESIG_FORM: DesigForm = { schoolId: '', name: '', departmentId: '' };

function DesignationsTab() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DesigForm>(EMPTY_DESIG_FORM);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Designation | null>(null);

  const desigsQuery = useQuery({ queryKey: ['designations'], queryFn: () => api.get<Designation[]>('/designations') });
  const deptsQuery = useQuery({ queryKey: ['departments'], queryFn: () => api.get<Department[]>('/departments') });
  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools'), enabled: open && isUnrestricted });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/designations', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      setOpen(false);
      setForm(EMPTY_DESIG_FORM);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/designations/${editingId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY_DESIG_FORM);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/designations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      setDeleteTarget(null);
    },
  });

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_DESIG_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setError(null);
    setOpen(true);
  }
  function openEdit(d: Designation) {
    setEditingId(d.id);
    setForm({ schoolId: d.schoolId, name: d.name, departmentId: d.departmentId ?? '' });
    setError(null);
    setOpen(true);
  }
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !form.name.trim()) {
      setError('Please fill all required fields.');
      return;
    }
    const payload = { name: form.name, departmentId: form.departmentId || undefined };
    if (editingId) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate({ ...payload, schoolId: effectiveSchoolId });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Designation
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {desigsQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !desigsQuery.data?.length ? (
            <EmptyState icon={Tag} label="No designations yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {desigsQuery.data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-foreground">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.department?.name ?? '—'}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{d._count?.staff ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={d.isActive ? 'success' : 'secondary'}>{d.isActive ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          {isUnrestricted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteTarget(d)}
                            >
                              <Trash2 className="h-4 w-4" />
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
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Designation' : 'Add Designation'}</DialogTitle>
            <DialogDescription>A job title staff can be assigned, optionally under a department.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select
                  value={form.schoolId}
                  onValueChange={(v) => setForm((f) => ({ ...f, schoolId: v, departmentId: '' }))}
                  disabled={!!editingId}
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
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Senior Teacher" required />
            </Field>
            <Field label="Department">
              <Select
                value={form.departmentId || '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not grouped under a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not grouped under a department</SelectItem>
                  {(deptsQuery.data ?? [])
                    .filter((d) => !form.schoolId || d.schoolId === form.schoolId)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            {error && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingId ? updateMutation.isPending : createMutation.isPending}>
                {editingId ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete designation?"
        description={`This will remove "${deleteTarget?.name}". Staff linked to it keep their records but lose this designation link.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
