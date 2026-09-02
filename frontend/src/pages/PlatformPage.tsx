import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Plus, Ban, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDate } from '@/lib/utils';
import type { PlatformSchool } from '@/types';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 inline-block">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Crown className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

const form0 = {
  schoolName: '',
  schoolCode: '',
  schoolAddress: '',
  schoolPhone: '',
  directorFullName: '',
  directorEmail: '',
  directorPhone: '',
  directorPassword: '',
};

const editForm0 = {
  schoolName: '',
  schoolCode: '',
  schoolAddress: '',
  schoolPhone: '',
};

export default function PlatformPage() {
  const queryClient = useQueryClient();

  const schoolsQuery = useQuery({
    queryKey: ['platform', 'schools'],
    queryFn: () => api.get<PlatformSchool[]>('/platform/schools'),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(form0);
  const [error, setError] = useState<string | null>(null);

  const onboard = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/platform/schools', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'schools'] });
      setOpen(false);
      setForm(form0);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const toggleBlock = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      api.patch(`/platform/schools/${id}/${blocked ? 'block' : 'unblock'}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform', 'schools'] }),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(editForm0);
  const [editError, setEditError] = useState<string | null>(null);

  const updateSchool = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch(`/platform/schools/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'schools'] });
      setEditOpen(false);
      setEditingId(null);
      setEditError(null);
    },
    onError: (err: unknown) => setEditError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const [deleteTarget, setDeleteTarget] = useState<PlatformSchool | null>(null);

  const deleteSchool = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/schools/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'schools'] });
      setDeleteTarget(null);
    },
  });

  function openEdit(s: PlatformSchool) {
    setEditingId(s.id);
    setEditForm({
      schoolName: s.name,
      schoolCode: s.code,
      schoolAddress: s.address ?? '',
      schoolPhone: s.phone ?? '',
    });
    setEditError(null);
    setEditOpen(true);
  }

  function submitEdit(e: FormEvent) {
    e.preventDefault();
    setEditError(null);
    if (!editingId) return;
    if (!editForm.schoolName || !editForm.schoolCode) {
      setEditError('Please fill all required fields.');
      return;
    }
    updateSchool.mutate({
      id: editingId,
      payload: {
        schoolName: editForm.schoolName,
        schoolCode: editForm.schoolCode,
        schoolAddress: editForm.schoolAddress || undefined,
        schoolPhone: editForm.schoolPhone || undefined,
      },
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (
      !form.schoolName ||
      !form.schoolCode ||
      !form.directorFullName ||
      !form.directorEmail ||
      !form.directorPassword
    ) {
      setError('Please fill all required fields.');
      return;
    }
    if (form.directorPassword.length < 8) {
      setError('Director password must be at least 8 characters.');
      return;
    }
    onboard.mutate({
      schoolName: form.schoolName,
      schoolCode: form.schoolCode,
      schoolAddress: form.schoolAddress || undefined,
      schoolPhone: form.schoolPhone || undefined,
      directorFullName: form.directorFullName,
      directorEmail: form.directorEmail,
      directorPhone: form.directorPhone || undefined,
      directorPassword: form.directorPassword,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Platform</h2>
        <p className="mt-1 text-sm text-muted-foreground">Every school on the platform and its Director account.</p>
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {schoolsQuery.data?.length ?? 0} school{schoolsQuery.data?.length === 1 ? '' : 's'} onboarded.
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add School
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {schoolsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !schoolsQuery.data?.length ? (
            <EmptyState label="No schools onboarded yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Director</TableHead>
                  <TableHead>Onboarded</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schoolsQuery.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.code}</TableCell>
                    <TableCell>
                      {s.director ? (
                        <>
                          <p className="text-foreground">{s.director.fullName}</p>
                          <p className="text-xs text-muted-foreground">{s.director.email}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? 'success' : 'destructive'}>{s.isActive ? 'Active' : 'Blocked'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        {s.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            loading={toggleBlock.isPending}
                            onClick={() => toggleBlock.mutate({ id: s.id, blocked: true })}
                          >
                            <Ban className="h-4 w-4" />
                            Block
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-700 hover:bg-green-50"
                            loading={toggleBlock.isPending}
                            onClick={() => toggleBlock.mutate({ id: s.id, blocked: false })}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Unblock
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(s)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add School</DialogTitle>
            <DialogDescription>Creates the school and its first Director account together.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="School name" required>
                <Input value={form.schoolName} onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))} required />
              </Field>
              <Field label="School code" required>
                <Input value={form.schoolCode} onChange={(e) => setForm((f) => ({ ...f, schoolCode: e.target.value }))} required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Address (optional)">
                <Input value={form.schoolAddress} onChange={(e) => setForm((f) => ({ ...f, schoolAddress: e.target.value }))} />
              </Field>
              <Field label="Phone (optional)">
                <Input value={form.schoolPhone} onChange={(e) => setForm((f) => ({ ...f, schoolPhone: e.target.value }))} />
              </Field>
            </div>
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium text-foreground">Director account</p>
              <div className="space-y-4">
                <Field label="Full name" required>
                  <Input
                    value={form.directorFullName}
                    onChange={(e) => setForm((f) => ({ ...f, directorFullName: e.target.value }))}
                    required
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Email" required>
                    <Input
                      type="email"
                      value={form.directorEmail}
                      onChange={(e) => setForm((f) => ({ ...f, directorEmail: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Phone (optional)">
                    <Input value={form.directorPhone} onChange={(e) => setForm((f) => ({ ...f, directorPhone: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Password" required>
                  <PasswordInput
                    minLength={8}
                    value={form.directorPassword}
                    onChange={(e) => setForm((f) => ({ ...f, directorPassword: e.target.value }))}
                    required
                  />
                </Field>
              </div>
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={onboard.isPending}>
                Create School
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit School</DialogTitle>
            <DialogDescription>Update this school's name, code, address, or phone.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="School name" required>
                <Input value={editForm.schoolName} onChange={(e) => setEditForm((f) => ({ ...f, schoolName: e.target.value }))} required />
              </Field>
              <Field label="School code" required>
                <Input value={editForm.schoolCode} onChange={(e) => setEditForm((f) => ({ ...f, schoolCode: e.target.value }))} required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Address (optional)">
                <Input value={editForm.schoolAddress} onChange={(e) => setEditForm((f) => ({ ...f, schoolAddress: e.target.value }))} />
              </Field>
              <Field label="Phone (optional)">
                <Input value={editForm.schoolPhone} onChange={(e) => setEditForm((f) => ({ ...f, schoolPhone: e.target.value }))} />
              </Field>
            </div>
            {editError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{editError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={updateSchool.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this school?"
        description={`"${deleteTarget?.name ?? ''}" will be removed from the platform. Its Director/staff will no longer be able to log in, but existing records are kept.`}
        confirmLabel="Delete"
        destructive
        loading={deleteSchool.isPending}
        onConfirm={() => deleteTarget && deleteSchool.mutate(deleteTarget.id)}
      />
    </div>
  );
}
