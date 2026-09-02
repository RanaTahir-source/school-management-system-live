import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, ShieldCheck, UserX, KeyRound, Pencil } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
import type { StaffUser, School, Role } from '@/types';

const STAFF_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTANT', 'LIBRARIAN', 'RECEPTIONIST'] as const;
const ALL_ROLES: Role[] = [
  'CHAIRMAN', 'DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'PARENT', 'LIBRARIAN', 'RECEPTIONIST',
];

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

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  roleName: string;
  schoolId: string;
  branchId: string;
};

const EMPTY_FORM: FormState = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  roleName: '',
  schoolId: '',
  branchId: '',
};

type EditFormState = {
  fullName: string;
  email: string;
  phone: string;
  schoolId: string;
  branchId: string;
};

const EMPTY_EDIT_FORM: EditFormState = {
  fullName: '',
  email: '',
  phone: '',
  schoolId: '',
  branchId: '',
};

export default function StaffUsersPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('DIRECTOR', 'ADMIN');
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StaffUser | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT_FORM);
  const [editError, setEditError] = useState<string | null>(null);

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => api.get<StaffUser[]>('/users') });
  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
    enabled: createOpen || !!editingUserId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/auth/signup', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => api.patch(`/users/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUserId(null);
      setEditForm(EMPTY_EDIT_FORM);
      setEditError(null);
    },
    onError: (err: unknown) => {
      setEditError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeactivateTarget(null);
    },
    onError: (err: unknown) => {
      setDeactivateTarget(null);
      // eslint-disable-next-line no-console
      console.error(err instanceof ApiError ? err.body?.message ?? err.message : err);
    },
  });

  const isDirector = hasRole('DIRECTOR');
  const isChairman = hasRole('CHAIRMAN');
  const [rolesTarget, setRolesTarget] = useState<StaffUser | null>(null);
  const [rolesSelection, setRolesSelection] = useState<Role[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const updateRolesMutation = useMutation({
    mutationFn: ({ id, roleNames }: { id: string; roleNames: Role[] }) => api.patch(`/users/${id}/roles`, { roleNames }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setRolesTarget(null);
      setRolesError(null);
    },
    onError: (err: unknown) => setRolesError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function openRolesDialog(u: StaffUser) {
    setRolesTarget(u);
    setRolesSelection(u.userRoles.map((ur) => ur.role.name));
    setRolesError(null);
  }

  function toggleRole(role: Role) {
    setRolesSelection((sel) => (sel.includes(role) ? sel.filter((r) => r !== role) : [...sel, role]));
  }

  function saveRoles() {
    if (!rolesTarget) return;
    setRolesError(null);
    if (!rolesSelection.length) {
      setRolesError('Select at least one role.');
      return;
    }
    updateRolesMutation.mutate({ id: rolesTarget.id, roleNames: rolesSelection });
  }

  const filtered = useMemo(() => {
    const list = usersQuery.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [usersQuery.data, search]);

  const formSchoolBranches = useMemo(() => {
    const school = schoolsQuery.data?.find((s) => s.id === form.schoolId);
    return school?.branches ?? [];
  }, [schoolsQuery.data, form.schoolId]);

  const editFormSchoolBranches = useMemo(() => {
    const school = schoolsQuery.data?.find((s) => s.id === editForm.schoolId);
    return school?.branches ?? [];
  }, [schoolsQuery.data, editForm.schoolId]);

  function openEditDialog(u: StaffUser) {
    setEditingUserId(u.id);
    setEditForm({
      fullName: u.fullName,
      email: u.email,
      phone: u.phone ?? '',
      schoolId: u.schoolId ?? '',
      branchId: u.branchId ?? '',
    });
    setEditError(null);
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    setEditError(null);
    if (!editingUserId) return;
    if (!editForm.fullName || !editForm.email) {
      setEditError('Please fill all required fields.');
      return;
    }
    updateProfileMutation.mutate({
      id: editingUserId,
      payload: {
        fullName: editForm.fullName,
        email: editForm.email,
        phone: editForm.phone || undefined,
        schoolId: isUnrestricted ? editForm.schoolId || undefined : undefined,
        branchId: editForm.branchId || undefined,
      },
    });
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setFormError(null);
    setCreateOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.fullName || !form.email || !form.password || !form.roleName) {
      setFormError('Please fill all required fields.');
      return;
    }
    createMutation.mutate({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone || undefined,
      password: form.password,
      roleName: form.roleName,
      schoolId: form.schoolId || undefined,
      branchId: form.branchId || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Staff &amp; Users</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {usersQuery.data?.length ?? 0} account{usersQuery.data?.length === 1 ? '' : 's'} with system access
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Staff Account
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {usersQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No accounts found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search ? 'Try a different search term.' : 'Add a staff account to get started.'}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials(u.fullName)}
                        </div>
                        <span className="font-medium text-foreground">{u.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.userRoles.map((ur) => (
                          <Badge key={ur.role.id} variant="outline">
                            {ur.role.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.school?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? 'success' : 'secondary'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(u)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          {u.id !== user?.userId && (
                            <Button variant="ghost" size="sm" onClick={() => openRolesDialog(u)}>
                              <KeyRound className="h-4 w-4" />
                              Roles
                            </Button>
                          )}
                          {u.isActive && u.id !== user?.userId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeactivateTarget(u)}
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
            <DialogTitle>Add Staff Account</DialogTitle>
            <DialogDescription>
              Creates a login account for staff roles. Students and teachers have their own dedicated pages.
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
              <Field label="Role" required>
                <Select value={form.roleName} onValueChange={(v) => setForm((f) => ({ ...f, roleName: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>

              {isUnrestricted && (
                <Field label="School">
                  <Select
                    value={form.schoolId}
                    onValueChange={(v) => setForm((f) => ({ ...f, schoolId: v, branchId: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select school (optional)" />
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

              <Field label="Branch">
                <Select
                  value={form.branchId}
                  onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
                  disabled={!formSchoolBranches.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {formSchoolBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingUserId}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUserId(null);
            setEditForm(EMPTY_EDIT_FORM);
            setEditError(null);
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Edit Staff Account</DialogTitle>
            <DialogDescription>Update this staff member's profile details.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" required>
                <Input
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Email" required>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Phone">
                <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>

              {isUnrestricted && (
                <Field label="School">
                  <Select
                    value={editForm.schoolId}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, schoolId: v, branchId: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select school (optional)" />
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

              <Field label="Branch">
                <Select
                  value={editForm.branchId}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, branchId: v }))}
                  disabled={!editFormSchoolBranches.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {editFormSchoolBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {editError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {editError}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingUserId(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={updateProfileMutation.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate account?"
        description={`This will disable ${deactivateTarget?.fullName ?? 'this account'}'s login and revoke active sessions.`}
        confirmLabel="Deactivate"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
      />

      <Dialog open={!!rolesTarget} onOpenChange={(open) => !open && setRolesTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription>{rolesTarget?.fullName} can hold more than one role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {ALL_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rolesSelection.includes(role)}
                    disabled={(role === 'DIRECTOR' && !isDirector) || (role === 'CHAIRMAN' && !isChairman)}
                    onChange={() => toggleRole(role)}
                  />
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </label>
              ))}
            </div>
            {!isDirector && (
              <p className="text-xs text-muted-foreground">Only a Director can grant or revoke the Director role.</p>
            )}
            {!isChairman && (
              <p className="text-xs text-muted-foreground">Only a Chairman can grant or revoke the Chairman role.</p>
            )}
            {rolesError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{rolesError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRolesTarget(null)}>
                Cancel
              </Button>
              <Button type="button" loading={updateRolesMutation.isPending} onClick={saveRoles}>
                Save Roles
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
