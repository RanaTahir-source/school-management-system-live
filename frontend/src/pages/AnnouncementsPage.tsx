import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn, formatDate } from '@/lib/utils';
import type { Announcement, AnnouncementPriority, ClassRecord, Role, School, SectionRecord } from '@/types';

const AUDIENCE_ROLES: Role[] = ['PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'STUDENT', 'PARENT'];

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

const PRIORITY_VARIANT: Record<AnnouncementPriority, 'secondary' | 'default' | 'destructive'> = {
  NORMAL: 'secondary',
  IMPORTANT: 'default',
  URGENT: 'destructive',
};

const emptyForm = {
  schoolId: '',
  title: '',
  body: '',
  priority: 'NORMAL' as AnnouncementPriority,
  classId: '',
  sectionId: '',
  audienceRoles: [] as Role[],
  publishNow: true,
};

export default function AnnouncementsPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');
  const canDelete = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools') });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassRecord[]>('/classes') });
  const announcementsQuery = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.get<Announcement[]>('/announcements'),
  });

  const schoolName = (id: string) => schoolsQuery.data?.find((s) => s.id === id)?.name ?? '—';
  const className = (id: string | null) => (id ? classesQuery.data?.find((c) => c.id === id)?.name ?? '—' : 'Every class');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/announcements', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setOpen(false);
      setForm(emptyForm);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/announcements/${editingId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const publish = useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/publish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setDeleteTarget(null);
    },
  });

  const classOptions = useMemo(() => {
    const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId;
    return (classesQuery.data ?? []).filter((c) => c.schoolId === effectiveSchoolId);
  }, [classesQuery.data, form.schoolId, isUnrestricted, user?.schoolId]);

  const sectionsQuery = useQuery({
    queryKey: ['sections', 'by-class', form.classId],
    queryFn: () => api.get<SectionRecord[]>('/sections', { classId: form.classId }),
    enabled: !!form.classId,
  });

  function openDialog() {
    setEditingId(null);
    setForm({ ...emptyForm, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setError(null);
    setOpen(true);
  }

  function openEditDialog(a: Announcement) {
    setEditingId(a.id);
    setForm({
      schoolId: a.schoolId,
      title: a.title,
      body: a.body,
      priority: a.priority,
      classId: a.classId ?? '',
      sectionId: a.sectionId ?? '',
      audienceRoles: a.audienceRoles,
      publishNow: false,
    });
    setError(null);
    setOpen(true);
  }

  function toggleRole(role: Role) {
    setForm((f) => ({
      ...f,
      audienceRoles: f.audienceRoles.includes(role)
        ? f.audienceRoles.filter((r) => r !== role)
        : [...f.audienceRoles, role],
    }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !form.title || !form.body) {
      setError('Please fill all required fields.');
      return;
    }
    if (editingId) {
      update.mutate({
        title: form.title,
        body: form.body,
        priority: form.priority,
        audienceRoles: form.audienceRoles,
        classId: form.classId || undefined,
        sectionId: form.sectionId || undefined,
      });
      return;
    }
    create.mutate({
      schoolId: effectiveSchoolId,
      title: form.title,
      body: form.body,
      priority: form.priority,
      audienceRoles: form.audienceRoles,
      classId: form.classId || undefined,
      sectionId: form.sectionId || undefined,
      publishNow: form.publishNow,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Announcements</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Post school-wide or targeted notices — publishing sends an in-app notification to everyone it targets.
          </p>
        </div>
        <Button onClick={openDialog}>
          <Plus className="h-4 w-4" />
          New Announcement
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {announcementsQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !announcementsQuery.data?.length ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Megaphone className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium text-foreground">No announcements yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Targets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcementsQuery.data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-xs font-medium text-foreground">
                      <div className="truncate">{a.title}</div>
                      <div className="truncate text-xs font-normal text-muted-foreground">{a.body}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_VARIANT[a.priority]}>{a.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{schoolName(a.schoolId)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {className(a.classId)}
                      {a.audienceRoles.length ? ` · ${a.audienceRoles.join(', ')}` : ' · All roles'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.isPublished ? 'success' : 'secondary'}>
                        {a.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(a.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!a.isPublished && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => publish.mutate(a.id)}
                            loading={publish.isPending}
                          >
                            <Send className="h-4 w-4" />
                            Publish
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(a)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(a)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
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
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the title, message, priority, or targeting. This will not re-notify recipients.'
                : 'Target everyone at a school, or narrow it down to specific roles and/or a class.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select
                  value={form.schoolId}
                  onValueChange={(v) => setForm((f) => ({ ...f, schoolId: v, classId: '', sectionId: '' }))}
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

            <Field label="Title" required>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. School closed on Monday"
                required
              />
            </Field>

            <Field label="Message" required>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Write the announcement..."
                rows={4}
                required
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Priority">
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as AnnouncementPriority }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="IMPORTANT">Important</SelectItem>
                    <SelectItem value="URGENT">Urgent (also SMS's guardians)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Class (optional)">
                <Select
                  value={form.classId || '__all__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, classId: v === '__all__' ? '' : v, sectionId: '' }))}
                  disabled={!classOptions.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Every class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Every class</SelectItem>
                    {classOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {form.classId && (
              <Field label="Section (optional — leave blank for every section)">
                <Select
                  value={form.sectionId || '__all__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, sectionId: v === '__all__' ? '' : v }))}
                  disabled={!sectionsQuery.data?.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Every section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Every section</SelectItem>
                    {(sectionsQuery.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <div>
              <Label className="mb-1.5 inline-block">Audience roles (leave empty for everyone)</Label>
              <div className="flex flex-wrap gap-1.5">
                {AUDIENCE_ROLES.map((role) => {
                  const active = form.audienceRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        active
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-secondary',
                      )}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>

            {!editingId && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, publishNow: !f.publishNow }))}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors',
                  form.publishNow ? 'border-primary/30 bg-primary/5' : 'border-border',
                )}
              >
                <span className="font-medium text-foreground">Publish immediately</span>
                <span className={cn('text-xs', form.publishNow ? 'text-primary' : 'text-muted-foreground')}>
                  {form.publishNow ? 'On — notifies everyone now' : 'Off — saved as draft'}
                </span>
              </button>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
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
              <Button type="submit" loading={editingId ? update.isPending : create.isPending}>
                {editingId ? 'Save Changes' : form.publishNow ? 'Publish' : 'Save Draft'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete announcement?"
        description={`This will remove "${deleteTarget?.title ?? ''}" permanently.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </div>
  );
}
