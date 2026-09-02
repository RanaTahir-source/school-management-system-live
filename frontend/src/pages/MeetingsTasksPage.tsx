import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ClipboardList, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { formatDate } from '@/lib/utils';
import type { Meeting, MeetingStatus, StaffTask, StaffTaskPriority, StaffTaskStatus, StaffUser } from '@/types';

const MANAGE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR'] as const;

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
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

export default function MeetingsTasksPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Meetings & Tasks</h2>
        <p className="mt-1 text-sm text-muted-foreground">Schedule meetings, keep minutes, and assign staff tasks.</p>
      </div>

      <Tabs defaultValue="meetings">
        <TabsList>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>
        <TabsContent value="meetings">
          <MeetingsTab />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const MEETING_STATUS_BADGE: Record<MeetingStatus, 'default' | 'success' | 'destructive'> = {
  SCHEDULED: 'default',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
};

function MeetingsTab() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isManager = hasRole(...MANAGE_ROLES);
  const [viewMine, setViewMine] = useState(!isManager);
  const [formOpen, setFormOpen] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);

  const listQuery = useQuery({
    queryKey: ['meetings', viewMine],
    queryFn: () => api.get<Meeting[]>(viewMine ? '/meetings/mine' : '/meetings'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/meetings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setDeleteTarget(null);
    },
  });

  const detail = useMemo(() => listQuery.data?.find((m) => m.id === detailId) ?? null, [listQuery.data, detailId]);
  const editingMeeting = useMemo(
    () => listQuery.data?.find((m) => m.id === editingMeetingId) ?? null,
    [listQuery.data, editingMeetingId],
  );

  function openScheduleDialog() {
    setEditingMeetingId(null);
    setFormOpen(true);
  }
  function openEditMeetingDialog(meeting: Meeting) {
    setEditingMeetingId(meeting.id);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {isManager ? (
          <div className="flex gap-1 rounded-lg border border-border p-1">
            <Button variant={viewMine ? 'ghost' : 'secondary'} size="sm" onClick={() => setViewMine(false)}>
              All Meetings
            </Button>
            <Button variant={viewMine ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMine(true)}>
              My Meetings
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Meetings you're invited to.</p>
        )}
        {isManager && (
          <Button onClick={openScheduleDialog}>
            <Plus className="h-4 w-4" />
            Schedule Meeting
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !listQuery.data?.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No meetings {viewMine ? 'for you' : 'scheduled'} yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meeting</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attendees</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium text-foreground">{m.title}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(m.scheduledAt).toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{m.location ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={MEETING_STATUS_BADGE[m.status]}>{m.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {m.attendees.length}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(m.id)}>
                          View
                        </Button>
                        {isManager && (
                          <Button variant="ghost" size="sm" onClick={() => openEditMeetingDialog(m)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {isManager && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(m)}
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

      {formOpen && (
        <MeetingFormDialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditingMeetingId(null);
          }}
          editingMeeting={editingMeeting}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['meetings'] })}
        />
      )}

      {detail && (
        <MeetingDetailDialog
          meeting={detail}
          isManager={isManager}
          open={!!detail}
          onOpenChange={(open) => !open && setDetailId(null)}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ['meetings'] })}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Cancel and remove this meeting?"
        description={`This will remove "${deleteTarget?.title}" from the schedule.`}
        confirmLabel="Remove"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

// Converts an ISO timestamp to the "YYYY-MM-DDTHH:mm" shape <input type="datetime-local"> expects.
function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Handles both "Schedule Meeting" (create) and "Edit Meeting" (full-detail
// edit) - branches on whether editingMeeting is set, same as the update
// dialogs on the Departments/Academics pages. The quick status+minutes
// dialog (MeetingDetailDialog) is a separate, unaffected flow.
function MeetingFormDialog({
  open,
  onOpenChange,
  editingMeeting,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingMeeting: Meeting | null;
  onSaved: () => void;
}) {
  const { user, hasRole } = useAuth();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');
  const [title, setTitle] = useState(editingMeeting?.title ?? '');
  const [agenda, setAgenda] = useState(editingMeeting?.agenda ?? '');
  const [scheduledAt, setScheduledAt] = useState(editingMeeting ? toDatetimeLocalValue(editingMeeting.scheduledAt) : '');
  const [location, setLocation] = useState(editingMeeting?.location ?? '');
  const [attendeeIds, setAttendeeIds] = useState<string[]>(editingMeeting?.attendees.map((a) => a.userId) ?? []);
  const [error, setError] = useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => api.get<StaffUser[]>('/users'),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title,
        agenda: agenda || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        location: location || undefined,
        attendeeIds,
      };
      return editingMeeting
        ? api.patch(`/meetings/${editingMeeting.id}`, payload)
        : api.post('/meetings', { ...payload, schoolId: user?.schoolId });
    },
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !scheduledAt) return setError('Please enter a title and date/time.');
    if (!editingMeeting && !user?.schoolId && !isUnrestricted) return setError('Your account is not assigned to a school.');
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{editingMeeting ? 'Edit Meeting' : 'Schedule Meeting'}</DialogTitle>
          <DialogDescription>
            {editingMeeting ? 'Update the meeting details, including who is invited.' : 'Invited attendees get an in-app notification.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date & time" required>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
            </Field>
            <Field label="Location">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Principal's Office" />
            </Field>
          </div>
          <Field label="Agenda">
            <Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={2} />
          </Field>
          <Field label="Attendees">
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {(staffQuery.data ?? []).map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50">
                  <input type="checkbox" checked={attendeeIds.includes(s.id)} onChange={() => toggleAttendee(s.id)} />
                  {s.fullName}
                </label>
              ))}
            </div>
          </Field>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {editingMeeting ? 'Save Changes' : 'Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MeetingDetailDialog({
  meeting,
  isManager,
  open,
  onOpenChange,
  onChanged,
}: {
  meeting: Meeting;
  isManager: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [minutes, setMinutes] = useState(meeting.minutes ?? '');
  const [status, setStatus] = useState<MeetingStatus>(meeting.status);

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/meetings/${meeting.id}`, { minutes: minutes || undefined, status }),
    onSuccess: () => onChanged(),
  });

  const attendanceMutation = useMutation({
    mutationFn: ({ userId, attended }: { userId: string; attended: boolean }) =>
      api.patch(`/meetings/${meeting.id}/attendees/${userId}/attendance`, { attended }),
    onSuccess: () => onChanged(),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{meeting.title}</DialogTitle>
          <DialogDescription>
            {new Date(meeting.scheduledAt).toLocaleString()}
            {meeting.location && (
              <span className="ml-2 inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {meeting.location}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {meeting.agenda && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Agenda</p>
              <p className="text-sm text-foreground">{meeting.agenda}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Attendees</p>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {meeting.attendees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendees invited.</p>
              ) : (
                meeting.attendees.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{a.user.fullName}</span>
                    {isManager ? (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={a.attended ?? false}
                          onChange={(e) => attendanceMutation.mutate({ userId: a.userId, attended: e.target.checked })}
                        />
                        Attended
                      </label>
                    ) : a.attended != null ? (
                      <Badge variant={a.attended ? 'success' : 'secondary'}>{a.attended ? 'Attended' : 'Absent'}</Badge>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          {isManager && (
            <>
              <Field label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as MeetingStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Minutes">
                <Textarea value={minutes} onChange={(e) => setMinutes(e.target.value)} rows={4} placeholder="What was discussed and decided..." />
              </Field>
            </>
          )}
          {!isManager && meeting.minutes && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Minutes</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{meeting.minutes}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {isManager && (
            <Button type="button" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────

const TASK_STATUS_BADGE: Record<StaffTaskStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
};

const TASK_PRIORITY_BADGE: Record<StaffTaskPriority, 'secondary' | 'warning' | 'destructive'> = {
  LOW: 'secondary',
  MEDIUM: 'warning',
  HIGH: 'destructive',
};

function TasksTab() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isManager = hasRole(...MANAGE_ROLES);
  const [viewMine, setViewMine] = useState(!isManager);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffTask | null>(null);

  const listQuery = useQuery({
    queryKey: ['staff-tasks', viewMine],
    queryFn: () => api.get<StaffTask[]>(viewMine ? '/staff-tasks/mine' : '/staff-tasks'),
  });

  const editingTask = useMemo(
    () => listQuery.data?.find((t) => t.id === editingTaskId) ?? null,
    [listQuery.data, editingTaskId],
  );

  function openAssignDialog() {
    setEditingTaskId(null);
    setFormOpen(true);
  }
  function openEditTaskDialog(task: StaffTask) {
    setEditingTaskId(task.id);
    setFormOpen(true);
  }

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StaffTaskStatus }) => api.patch(`/staff-tasks/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/staff-tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {isManager ? (
          <div className="flex gap-1 rounded-lg border border-border p-1">
            <Button variant={viewMine ? 'ghost' : 'secondary'} size="sm" onClick={() => setViewMine(false)}>
              All Tasks
            </Button>
            <Button variant={viewMine ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMine(true)}>
              My Tasks
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Tasks assigned to you.</p>
        )}
        {isManager && (
          <Button onClick={openAssignDialog}>
            <Plus className="h-4 w-4" />
            Assign Task
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !listQuery.data?.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No tasks {viewMine ? 'assigned to you' : 'yet'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{t.title}</span>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.assignedTo?.fullName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={TASK_PRIORITY_BADGE[t.priority]}>{t.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.dueDate ? formatDate(t.dueDate) : '—'}</TableCell>
                    <TableCell>
                      <Select value={t.status} onValueChange={(v) => statusMutation.mutate({ id: t.id, status: v as StaffTaskStatus })}>
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                          <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isManager && (
                          <Button variant="ghost" size="sm" onClick={() => openEditTaskDialog(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {isManager && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(t)}
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

      {formOpen && (
        <TaskFormDialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditingTaskId(null);
          }}
          editingTask={editingTask}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['staff-tasks'] })}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this task?"
        description={`This will remove "${deleteTarget?.title}" permanently.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

// Handles both "Assign Task" (create) and "Edit Task" (full-detail edit,
// via the Pencil icon) - branches on whether editingTask is set. The quick
// status dropdown in the table keeps using PATCH /staff-tasks/:id/status
// directly and is untouched by this dialog.
function TaskFormDialog({
  open,
  onOpenChange,
  editingTask,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTask: StaffTask | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(editingTask?.title ?? '');
  const [description, setDescription] = useState(editingTask?.description ?? '');
  const [priority, setPriority] = useState<StaffTaskPriority>(editingTask?.priority ?? 'MEDIUM');
  const [dueDate, setDueDate] = useState(editingTask?.dueDate ? editingTask.dueDate.slice(0, 10) : '');
  const [assignedToId, setAssignedToId] = useState(editingTask?.assignedTo?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => api.get<StaffUser[]>('/users'),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title,
        description: description || undefined,
        priority,
        dueDate: dueDate || undefined,
        assignedToId,
      };
      return editingTask
        ? api.patch(`/staff-tasks/${editingTask.id}`, payload)
        : api.post('/staff-tasks', { ...payload, schoolId: user?.schoolId });
    },
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Please enter a task title.');
    if (!assignedToId) return setError('Please choose who this is assigned to.');
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{editingTask ? 'Edit Task' : 'Assign Task'}</DialogTitle>
          <DialogDescription>
            {editingTask ? 'Update the task details below.' : 'The assignee gets an in-app notification.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Assign to" required>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {(staffQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={priority} onValueChange={(v) => setPriority(v as StaffTaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {editingTask ? 'Save Changes' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
