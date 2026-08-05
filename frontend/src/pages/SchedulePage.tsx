import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, BookMarked, ClipboardList, Plus, Trash2, Pencil, Check, X, Video, Ban, ExternalLink } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { formatDate } from '@/lib/utils';
import type {
  SectionRecord,
  Subject,
  TeacherProfile,
  TimetableSlot,
  Homework,
  OnlineClass,
  LeaveRequest,
  LeaveStatus,
  MyChild,
} from '@/types';

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

function EmptyState({ icon: Icon, label }: { icon: typeof CalendarClock; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

const LEAVE_STATUS_VARIANT: Record<LeaveStatus, 'warning' | 'success' | 'destructive' | 'secondary'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
};

const slotForm0 = {
  subjectId: '',
  teacherId: '__none__',
  dayOfWeek: '1',
  periodNo: '1',
  startTime: '08:00',
  endTime: '08:40',
  room: '',
};

const homeworkForm0 = { subjectId: '', title: '', description: '', dueDate: '' };
const onlineForm0 = { subjectId: '', title: '', description: '', meetingLink: '', scheduledAt: '', durationMinutes: '40' };

export default function SchedulePage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();

  const canManage = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const isTeacher = hasRole('TEACHER');
  const isStudent = hasRole('STUDENT');
  const isParent = hasRole('PARENT');
  const canScheduleManage = canManage;
  const canAssignHomework = canManage || isTeacher;

  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get<SectionRecord[]>('/sections'),
    enabled: canScheduleManage || canAssignHomework,
  });
  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get<Subject[]>('/subjects'),
    enabled: canScheduleManage || canAssignHomework,
  });
  const teachersQuery = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.get<TeacherProfile[]>('/teachers'),
    enabled: canScheduleManage,
  });

  // ─────────────────────────── Timetable tab ───────────────────────────
  const [ttSectionId, setTtSectionId] = useState('');

  const timetableSectionQuery = useQuery({
    queryKey: ['timetable', 'section', ttSectionId],
    queryFn: () => api.get<TimetableSlot[]>(`/timetable/section/${ttSectionId}`),
    enabled: !!ttSectionId && canScheduleManage,
  });
  const timetableMineQuery = useQuery({
    queryKey: ['timetable', 'mine'],
    queryFn: () => api.get<TimetableSlot[]>('/timetable/mine'),
    enabled: !canScheduleManage && (isTeacher || isStudent),
  });

  const [slotOpen, setSlotOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [slotForm, setSlotForm] = useState(slotForm0);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [deleteSlot, setDeleteSlot] = useState<TimetableSlot | null>(null);

  const saveSlot = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editingSlot ? api.patch(`/timetable/${editingSlot.id}`, payload) : api.post('/timetable', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      setSlotOpen(false);
      setEditingSlot(null);
      setSlotForm(slotForm0);
      setSlotError(null);
    },
    onError: (err: unknown) => setSlotError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/timetable/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      setDeleteSlot(null);
    },
  });

  function openAddSlot() {
    setEditingSlot(null);
    setSlotForm(slotForm0);
    setSlotError(null);
    setSlotOpen(true);
  }
  function openEditSlot(slot: TimetableSlot) {
    setEditingSlot(slot);
    setSlotForm({
      subjectId: slot.subjectId,
      teacherId: slot.teacherId ?? '__none__',
      dayOfWeek: String(slot.dayOfWeek),
      periodNo: String(slot.periodNo),
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room ?? '',
    });
    setSlotError(null);
    setSlotOpen(true);
  }
  function submitSlot(e: FormEvent) {
    e.preventDefault();
    setSlotError(null);
    if (!ttSectionId || !slotForm.subjectId || !slotForm.startTime || !slotForm.endTime) {
      setSlotError('Please fill all required fields.');
      return;
    }
    saveSlot.mutate({
      sectionId: ttSectionId,
      subjectId: slotForm.subjectId,
      teacherId: slotForm.teacherId === '__none__' ? undefined : slotForm.teacherId,
      dayOfWeek: Number(slotForm.dayOfWeek),
      periodNo: Number(slotForm.periodNo),
      startTime: slotForm.startTime,
      endTime: slotForm.endTime,
      room: slotForm.room || undefined,
    });
  }

  const timetableSlots = canScheduleManage ? timetableSectionQuery.data : timetableMineQuery.data;
  const timetableLoading = canScheduleManage ? timetableSectionQuery.isLoading : timetableMineQuery.isLoading;

  // ─────────────────────────── Homework tab ───────────────────────────
  const [hwSectionId, setHwSectionId] = useState('');

  const homeworkSectionQuery = useQuery({
    queryKey: ['homework', 'section', hwSectionId],
    queryFn: () => api.get<Homework[]>(`/homework/section/${hwSectionId}`),
    enabled: !!hwSectionId && canAssignHomework,
  });
  const homeworkMineQuery = useQuery({
    queryKey: ['homework', 'mine'],
    queryFn: () => api.get<Homework[]>('/homework/mine'),
    enabled: isStudent,
  });

  const [hwOpen, setHwOpen] = useState(false);
  const [editingHw, setEditingHw] = useState<Homework | null>(null);
  const [hwForm, setHwForm] = useState(homeworkForm0);
  const [hwError, setHwError] = useState<string | null>(null);
  const [deleteHw, setDeleteHw] = useState<Homework | null>(null);

  const saveHw = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editingHw ? api.patch(`/homework/${editingHw.id}`, payload) : api.post('/homework', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      setHwOpen(false);
      setEditingHw(null);
      setHwForm(homeworkForm0);
      setHwError(null);
    },
    onError: (err: unknown) => setHwError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const deleteHwMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/homework/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      setDeleteHw(null);
    },
  });

  function openAddHw() {
    setEditingHw(null);
    setHwForm(homeworkForm0);
    setHwError(null);
    setHwOpen(true);
  }
  function openEditHw(hw: Homework) {
    setEditingHw(hw);
    setHwForm({
      subjectId: hw.subjectId,
      title: hw.title,
      description: hw.description ?? '',
      dueDate: hw.dueDate.slice(0, 10),
    });
    setHwError(null);
    setHwOpen(true);
  }
  function submitHw(e: FormEvent) {
    e.preventDefault();
    setHwError(null);
    if (!hwSectionId || !hwForm.subjectId || !hwForm.title || !hwForm.dueDate) {
      setHwError('Please fill all required fields.');
      return;
    }
    saveHw.mutate({
      sectionId: hwSectionId,
      subjectId: hwForm.subjectId,
      title: hwForm.title,
      description: hwForm.description || undefined,
      dueDate: hwForm.dueDate,
    });
  }

  const homeworkList = canAssignHomework ? homeworkSectionQuery.data : homeworkMineQuery.data;
  const homeworkLoading = canAssignHomework ? homeworkSectionQuery.isLoading : homeworkMineQuery.isLoading;

  // ─────────────────────────── Online Classes tab ───────────────────────────
  const canScheduleOnline = canManage || isTeacher;
  const [ocSectionId, setOcSectionId] = useState('');

  const onlineSectionQuery = useQuery({
    queryKey: ['online-classes', 'section', ocSectionId],
    queryFn: () => api.get<OnlineClass[]>(`/online-classes/section/${ocSectionId}`),
    enabled: !!ocSectionId && canScheduleOnline,
  });
  const onlineMineQuery = useQuery({
    queryKey: ['online-classes', 'mine'],
    queryFn: () => api.get<OnlineClass[]>('/online-classes/mine'),
    enabled: isStudent,
  });

  const [ocOpen, setOcOpen] = useState(false);
  const [editingOc, setEditingOc] = useState<OnlineClass | null>(null);
  const [ocForm, setOcForm] = useState(onlineForm0);
  const [ocError, setOcError] = useState<string | null>(null);
  const [deleteOc, setDeleteOc] = useState<OnlineClass | null>(null);

  const saveOc = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editingOc ? api.patch(`/online-classes/${editingOc.id}`, payload) : api.post('/online-classes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-classes'] });
      setOcOpen(false);
      setEditingOc(null);
      setOcForm(onlineForm0);
      setOcError(null);
    },
    onError: (err: unknown) => setOcError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const cancelOcMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/online-classes/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['online-classes'] }),
  });

  const deleteOcMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/online-classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-classes'] });
      setDeleteOc(null);
    },
  });

  function openAddOc() {
    setEditingOc(null);
    setOcForm(onlineForm0);
    setOcError(null);
    setOcOpen(true);
  }
  function openEditOc(oc: OnlineClass) {
    setEditingOc(oc);
    setOcForm({
      subjectId: oc.subjectId,
      title: oc.title,
      description: oc.description ?? '',
      meetingLink: oc.meetingLink,
      scheduledAt: oc.scheduledAt.slice(0, 16),
      durationMinutes: String(oc.durationMinutes),
    });
    setOcError(null);
    setOcOpen(true);
  }
  function submitOc(e: FormEvent) {
    e.preventDefault();
    setOcError(null);
    if (!ocSectionId || !ocForm.subjectId || !ocForm.title || !ocForm.meetingLink || !ocForm.scheduledAt) {
      setOcError('Please fill all required fields.');
      return;
    }
    saveOc.mutate({
      sectionId: ocSectionId,
      subjectId: ocForm.subjectId,
      title: ocForm.title,
      description: ocForm.description || undefined,
      meetingLink: ocForm.meetingLink,
      scheduledAt: ocForm.scheduledAt,
      durationMinutes: Number(ocForm.durationMinutes) || undefined,
    });
  }

  const onlineClassList = canScheduleOnline ? onlineSectionQuery.data : onlineMineQuery.data;
  const onlineClassLoading = canScheduleOnline ? onlineSectionQuery.isLoading : onlineMineQuery.isLoading;

  // ─────────────────────────── Leave Requests tab ───────────────────────────
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('');
  const myLeaveQuery = useQuery({ queryKey: ['leave-requests', 'mine'], queryFn: () => api.get<LeaveRequest[]>('/leave-requests/mine') });
  const allLeaveQuery = useQuery({
    queryKey: ['leave-requests', 'all', leaveStatusFilter],
    queryFn: () => api.get<LeaveRequest[]>('/leave-requests', { status: leaveStatusFilter || undefined }),
    enabled: canManage,
  });
  const myChildrenQuery = useQuery({
    queryKey: ['parent-portal', 'children'],
    queryFn: () => api.get<MyChild[]>('/parent-portal/children'),
    enabled: isParent,
  });

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ studentId: '', fromDate: '', toDate: '', reason: '' });
  const [applyError, setApplyError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const applyLeave = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/leave-requests', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setApplyOpen(false);
      setApplyForm({ studentId: '', fromDate: '', toDate: '', reason: '' });
      setApplyError(null);
    },
    onError: (err: unknown) => setApplyError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const cancelLeave = useMutation({
    mutationFn: (id: string) => api.patch(`/leave-requests/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave-requests'] }),
  });

  const reviewLeave = useMutation({
    mutationFn: ({ id, status, reviewRemarks }: { id: string; status: 'APPROVED' | 'REJECTED'; reviewRemarks?: string }) =>
      api.patch(`/leave-requests/${id}/review`, { status, reviewRemarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setRejectTarget(null);
      setRejectRemarks('');
    },
  });

  function submitApply(e: FormEvent) {
    e.preventDefault();
    setApplyError(null);
    if (!applyForm.fromDate || !applyForm.toDate || !applyForm.reason) {
      setApplyError('Please fill all required fields.');
      return;
    }
    if (isParent && !applyForm.studentId) {
      setApplyError('Please choose which child this leave is for.');
      return;
    }
    applyLeave.mutate({
      fromDate: applyForm.fromDate,
      toDate: applyForm.toDate,
      reason: applyForm.reason,
      studentId: isParent ? applyForm.studentId : undefined,
    });
  }

  const teacherOptions = useMemo(
    () => (teachersQuery.data ?? []).map((t) => ({ id: t.user.id, label: t.user.fullName })),
    [teachersQuery.data],
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Schedule</h2>
        <p className="mt-1 text-sm text-muted-foreground">Timetable, homework, online classes and leave requests in one place.</p>
      </div>

      <Tabs defaultValue="timetable">
        <TabsList>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="homework">Homework</TabsTrigger>
          <TabsTrigger value="online">Online Classes</TabsTrigger>
          <TabsTrigger value="leave">Leave Requests</TabsTrigger>
        </TabsList>

        {/* ── Timetable ── */}
        <TabsContent value="timetable">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              {canScheduleManage ? (
                <div className="w-full sm:max-w-xs">
                  <Field label="Section">
                    <Select value={ttSectionId} onValueChange={setTtSectionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a section" />
                      </SelectTrigger>
                      <SelectContent>
                        {(sectionsQuery.data ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.class?.name} - {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isStudent ? "Your section's weekly schedule." : 'Your weekly teaching schedule.'}
                </p>
              )}
              {canScheduleManage && ttSectionId && (
                <Button onClick={openAddSlot}>
                  <Plus className="h-4 w-4" />
                  Add Period
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {canScheduleManage && !ttSectionId ? (
                <EmptyState icon={CalendarClock} label="Choose a section to view its timetable" />
              ) : timetableLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !timetableSlots?.length ? (
                <EmptyState icon={CalendarClock} label="No periods scheduled yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Teacher</TableHead>
                      {!canScheduleManage && <TableHead>Section</TableHead>}
                      <TableHead>Room</TableHead>
                      {canScheduleManage && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timetableSlots.map((slot) => (
                      <TableRow key={slot.id}>
                        <TableCell className="font-medium text-foreground">{DAY_NAMES[slot.dayOfWeek]}</TableCell>
                        <TableCell className="text-muted-foreground">{slot.periodNo}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {slot.startTime} - {slot.endTime}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{slot.subject?.name}</TableCell>
                        <TableCell className="text-muted-foreground">{slot.teacher?.fullName ?? '—'}</TableCell>
                        {!canScheduleManage && (
                          <TableCell className="text-muted-foreground">
                            {slot.section?.class?.name} {slot.section?.name}
                          </TableCell>
                        )}
                        <TableCell className="text-muted-foreground">{slot.room ?? '—'}</TableCell>
                        {canScheduleManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditSlot(slot)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setDeleteSlot(slot)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
        </TabsContent>

        {/* ── Homework ── */}
        <TabsContent value="homework">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              {canAssignHomework ? (
                <div className="w-full sm:max-w-xs">
                  <Field label="Section">
                    <Select value={hwSectionId} onValueChange={setHwSectionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a section" />
                      </SelectTrigger>
                      <SelectContent>
                        {(sectionsQuery.data ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.class?.name} - {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Homework assigned to your class.</p>
              )}
              {canAssignHomework && hwSectionId && (
                <Button onClick={openAddHw}>
                  <Plus className="h-4 w-4" />
                  Assign Homework
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {canAssignHomework && !hwSectionId ? (
                <EmptyState icon={BookMarked} label="Choose a section to view its homework" />
              ) : homeworkLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !homeworkList?.length ? (
                <EmptyState icon={BookMarked} label="No homework assigned yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {homeworkList.map((hw) => {
                      const canEditThis = canManage || hw.assignedById === user?.userId;
                      const overdue = new Date(hw.dueDate) < new Date(new Date().toDateString());
                      return (
                        <TableRow key={hw.id}>
                          <TableCell className="text-muted-foreground">{hw.subject?.name}</TableCell>
                          <TableCell>
                            <p className="font-medium text-foreground">{hw.title}</p>
                            {hw.description && <p className="text-xs text-muted-foreground">{hw.description}</p>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(hw.assignedDate)}</TableCell>
                          <TableCell>
                            <Badge variant={overdue ? 'destructive' : 'secondary'}>{formatDate(hw.dueDate)}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{hw.assignedBy?.fullName ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            {canEditThis && (
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditHw(hw)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeleteHw(hw)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Online Classes ── */}
        <TabsContent value="online">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              {canScheduleOnline ? (
                <div className="w-full sm:max-w-xs">
                  <Field label="Section">
                    <Select value={ocSectionId} onValueChange={setOcSectionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a section" />
                      </SelectTrigger>
                      <SelectContent>
                        {(sectionsQuery.data ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.class?.name} - {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Online classes scheduled for your section.</p>
              )}
              {canScheduleOnline && ocSectionId && (
                <Button onClick={openAddOc}>
                  <Plus className="h-4 w-4" />
                  Schedule Class
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {canScheduleOnline && !ocSectionId ? (
                <EmptyState icon={Video} label="Choose a section to view its online classes" />
              ) : onlineClassLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !onlineClassList?.length ? (
                <EmptyState icon={Video} label="No online classes scheduled yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {onlineClassList.map((oc) => {
                      const canEditThis = canManage || oc.teacherId === user?.userId;
                      return (
                        <TableRow key={oc.id}>
                          <TableCell className="text-muted-foreground">{oc.subject?.name}</TableCell>
                          <TableCell>
                            <p className="font-medium text-foreground">{oc.title}</p>
                            {oc.description && <p className="text-xs text-muted-foreground">{oc.description}</p>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(oc.scheduledAt, { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{oc.durationMinutes} min</TableCell>
                          <TableCell className="text-muted-foreground">{oc.teacher?.fullName ?? '—'}</TableCell>
                          <TableCell>
                            {oc.isCancelled ? (
                              <Badge variant="destructive">Cancelled</Badge>
                            ) : (
                              <a href={oc.meetingLink} target="_blank" rel="noreferrer">
                                <Button variant="outline" size="sm">
                                  <ExternalLink className="h-4 w-4" />
                                  Join
                                </Button>
                              </a>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {canEditThis && !oc.isCancelled && (
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditOc(oc)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-amber-700 hover:bg-amber-50"
                                  onClick={() => cancelOcMutation.mutate(oc.id)}
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeleteOc(oc)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Leave Requests ── */}
        <TabsContent value="leave">
          <div className="space-y-5">
            <Card>
              <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
                <p className="text-sm text-muted-foreground">Your leave requests.</p>
                <Button onClick={() => setApplyOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Apply for Leave
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {myLeaveQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !myLeaveQuery.data?.length ? (
                  <EmptyState icon={ClipboardList} label="No leave requests yet" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {isParent && <TableHead>For</TableHead>}
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myLeaveQuery.data.map((lr) => (
                        <TableRow key={lr.id}>
                          {isParent && <TableCell className="text-foreground">{lr.student?.user.fullName ?? '—'}</TableCell>}
                          <TableCell className="text-muted-foreground">{formatDate(lr.fromDate)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(lr.toDate)}</TableCell>
                          <TableCell>
                            <p className="text-foreground">{lr.reason}</p>
                            {lr.reviewRemarks && <p className="text-xs text-muted-foreground">Remarks: {lr.reviewRemarks}</p>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={LEAVE_STATUS_VARIANT[lr.status]}>{lr.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {lr.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => cancelLeave.mutate(lr.id)}
                              >
                                Cancel
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {canManage && (
              <Card>
                <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
                  <div className="w-40">
                    <Field label="Status">
                      <Select value={leaveStatusFilter || '__all__'} onValueChange={(v) => setLeaveStatusFilter(v === '__all__' ? '' : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Every status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Every status</SelectItem>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="APPROVED">Approved</SelectItem>
                          <SelectItem value="REJECTED">Rejected</SelectItem>
                          <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <p className="text-sm text-muted-foreground">Approval queue for the whole school.</p>
                </CardHeader>
                <CardContent className="pt-0">
                  {allLeaveQuery.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-11 w-full" />
                      ))}
                    </div>
                  ) : !allLeaveQuery.data?.length ? (
                    <EmptyState icon={ClipboardList} label="No leave requests found" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Applicant</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allLeaveQuery.data.map((lr) => (
                          <TableRow key={lr.id}>
                            <TableCell className="font-medium text-foreground">
                              {lr.student ? `${lr.student.user.fullName} (${lr.student.admissionNo})` : lr.staffUser?.fullName ?? '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{lr.applicantType}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(lr.fromDate)}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(lr.toDate)}</TableCell>
                            <TableCell className="text-foreground">{lr.reason}</TableCell>
                            <TableCell>
                              <Badge variant={LEAVE_STATUS_VARIANT[lr.status]}>{lr.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {lr.status === 'PENDING' && (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-700 hover:bg-green-50"
                                    onClick={() => reviewLeave.mutate({ id: lr.id, status: 'APPROVED' })}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => setRejectTarget(lr)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/edit timetable slot dialog */}
      <Dialog open={slotOpen} onOpenChange={setSlotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSlot ? 'Edit Period' : 'Add Period'}</DialogTitle>
            <DialogDescription>One subject/teacher for one day and period of this section.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitSlot} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Day" required>
                <Select value={slotForm.dayOfWeek} onValueChange={(v) => setSlotForm((f) => ({ ...f, dayOfWeek: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {DAY_NAMES[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Period No" required>
                <Input
                  type="number"
                  min={1}
                  value={slotForm.periodNo}
                  onChange={(e) => setSlotForm((f) => ({ ...f, periodNo: e.target.value }))}
                  required
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start time" required>
                <Input type="time" value={slotForm.startTime} onChange={(e) => setSlotForm((f) => ({ ...f, startTime: e.target.value }))} required />
              </Field>
              <Field label="End time" required>
                <Input type="time" value={slotForm.endTime} onChange={(e) => setSlotForm((f) => ({ ...f, endTime: e.target.value }))} required />
              </Field>
            </div>
            <Field label="Subject" required>
              <Select value={slotForm.subjectId} onValueChange={(v) => setSlotForm((f) => ({ ...f, subjectId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {(subjectsQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Teacher (optional)">
              <Select value={slotForm.teacherId} onValueChange={(v) => setSlotForm((f) => ({ ...f, teacherId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {teacherOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Room (optional)">
              <Input value={slotForm.room} onChange={(e) => setSlotForm((f) => ({ ...f, room: e.target.value }))} />
            </Field>
            {slotError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{slotError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSlotOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saveSlot.isPending}>
                {editingSlot ? 'Save Changes' : 'Add Period'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/edit homework dialog */}
      <Dialog open={hwOpen} onOpenChange={setHwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHw ? 'Edit Homework' : 'Assign Homework'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitHw} className="space-y-4">
            <Field label="Subject" required>
              <Select value={hwForm.subjectId} onValueChange={(v) => setHwForm((f) => ({ ...f, subjectId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {(subjectsQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Title" required>
              <Input value={hwForm.title} onChange={(e) => setHwForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            <Field label="Description (optional)">
              <textarea
                className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                value={hwForm.description}
                onChange={(e) => setHwForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            <Field label="Due date" required>
              <Input type="date" value={hwForm.dueDate} onChange={(e) => setHwForm((f) => ({ ...f, dueDate: e.target.value }))} required />
            </Field>
            {hwError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{hwError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHwOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saveHw.isPending}>
                {editingHw ? 'Save Changes' : 'Assign Homework'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/edit online class dialog */}
      <Dialog open={ocOpen} onOpenChange={setOcOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOc ? 'Edit Online Class' : 'Schedule Online Class'}</DialogTitle>
            <DialogDescription>Add your Zoom/Google Meet/Teams link - students see a Join button once scheduled.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitOc} className="space-y-4">
            <Field label="Subject" required>
              <Select value={ocForm.subjectId} onValueChange={(v) => setOcForm((f) => ({ ...f, subjectId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {(subjectsQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Title" required>
              <Input value={ocForm.title} onChange={(e) => setOcForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            <Field label="Meeting link" required>
              <Input
                type="url"
                placeholder="https://meet.google.com/..."
                value={ocForm.meetingLink}
                onChange={(e) => setOcForm((f) => ({ ...f, meetingLink: e.target.value }))}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date & time" required>
                <Input
                  type="datetime-local"
                  value={ocForm.scheduledAt}
                  onChange={(e) => setOcForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Duration (minutes)">
                <Input
                  type="number"
                  min={5}
                  max={240}
                  value={ocForm.durationMinutes}
                  onChange={(e) => setOcForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Description (optional)">
              <textarea
                className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                value={ocForm.description}
                onChange={(e) => setOcForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            {ocError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{ocError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOcOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saveOc.isPending}>
                {editingOc ? 'Save Changes' : 'Schedule Class'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Apply for leave dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitApply} className="space-y-4">
            {isParent && (
              <Field label="Child" required>
                <Select value={applyForm.studentId} onValueChange={(v) => setApplyForm((f) => ({ ...f, studentId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select which child" />
                  </SelectTrigger>
                  <SelectContent>
                    {myChildrenQuery.data?.map((c) => (
                      <SelectItem key={c.student.id} value={c.student.id}>
                        {c.student.user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="From" required>
                <Input type="date" value={applyForm.fromDate} onChange={(e) => setApplyForm((f) => ({ ...f, fromDate: e.target.value }))} required />
              </Field>
              <Field label="To" required>
                <Input type="date" value={applyForm.toDate} onChange={(e) => setApplyForm((f) => ({ ...f, toDate: e.target.value }))} required />
              </Field>
            </div>
            <Field label="Reason" required>
              <textarea
                className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                value={applyForm.reason}
                onChange={(e) => setApplyForm((f) => ({ ...f, reason: e.target.value }))}
                required
              />
            </Field>
            {applyError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{applyError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApplyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={applyLeave.isPending}>
                Submit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject leave dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Remarks (optional)">
              <textarea
                className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={reviewLeave.isPending}
                onClick={() => rejectTarget && reviewLeave.mutate({ id: rejectTarget.id, status: 'REJECTED', reviewRemarks: rejectRemarks || undefined })}
              >
                Reject
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteSlot}
        onOpenChange={(open) => !open && setDeleteSlot(null)}
        title="Remove this period?"
        description="This slot will be removed from the timetable."
        confirmLabel="Remove"
        destructive
        loading={deleteSlotMutation.isPending}
        onConfirm={() => deleteSlot && deleteSlotMutation.mutate(deleteSlot.id)}
      />

      <ConfirmDialog
        open={!!deleteHw}
        onOpenChange={(open) => !open && setDeleteHw(null)}
        title="Delete this homework?"
        description={`"${deleteHw?.title ?? ''}" will be removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteHwMutation.isPending}
        onConfirm={() => deleteHw && deleteHwMutation.mutate(deleteHw.id)}
      />

      <ConfirmDialog
        open={!!deleteOc}
        onOpenChange={(open) => !open && setDeleteOc(null)}
        title="Delete this online class?"
        description={`"${deleteOc?.title ?? ''}" will be removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteOcMutation.isPending}
        onConfirm={() => deleteOc && deleteOcMutation.mutate(deleteOc.id)}
      />
    </div>
  );
}
