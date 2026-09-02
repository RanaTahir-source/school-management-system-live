import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BedDouble, DoorOpen, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDate } from '@/lib/utils';
import type { School, StudentProfile, HostelRoom, HostelAllocation, HostelVisitor, HostelAttendanceRecord, AttendanceStatus } from '@/types';

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

function EmptyState({ icon: Icon, label }: { icon: typeof BedDouble; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

const STATUS_OPTIONS: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];
const STATUS_VARIANT: Record<AttendanceStatus, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  PRESENT: 'success',
  ABSENT: 'destructive',
  LATE: 'warning',
  LEAVE: 'secondary',
};

const roomForm0 = { schoolId: '', roomNo: '', block: '', floor: '', capacity: '1', roomType: '', monthlyFee: '' };

export default function HostelPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  // Rooms/Allocations are also viewable (read-only) by Accountant, since
  // hostel fees are finance-relevant - but Visitors/Attendance stay
  // manage-only, matching the backend's @Roles() on each GET endpoint.
  const canView = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT');
  const canDelete = hasRole('DIRECTOR', 'ADMIN');
  const isStudent = hasRole('STUDENT');

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools') });
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => api.get<StudentProfile[]>('/students'),
    enabled: canManage,
  });

  // ─────────────────────────── Rooms tab ───────────────────────────
  const roomsQuery = useQuery({ queryKey: ['hostel', 'rooms'], queryFn: () => api.get<HostelRoom[]>('/hostel/rooms'), enabled: canView });
  const [roomOpen, setRoomOpen] = useState(false);
  const [roomForm, setRoomForm] = useState(roomForm0);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [deactivateRoom, setDeactivateRoom] = useState<HostelRoom | null>(null);

  const createRoom = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/hostel/rooms', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostel', 'rooms'] });
      setRoomOpen(false);
      setRoomForm(roomForm0);
      setRoomError(null);
    },
    onError: (err: unknown) => setRoomError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateRoom = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/hostel/rooms/${editingRoomId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostel', 'rooms'] });
      setRoomOpen(false);
      setEditingRoomId(null);
      setRoomForm(roomForm0);
      setRoomError(null);
    },
    onError: (err: unknown) => setRoomError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deactivateRoomMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hostel/rooms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostel', 'rooms'] });
      setDeactivateRoom(null);
    },
  });

  function openRoomDialog() {
    setEditingRoomId(null);
    setRoomForm({ ...roomForm0, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setRoomError(null);
    setRoomOpen(true);
  }
  function openEditRoomDialog(r: HostelRoom) {
    setEditingRoomId(r.id);
    setRoomForm({
      schoolId: r.schoolId,
      roomNo: r.roomNo,
      block: r.block ?? '',
      floor: r.floor ?? '',
      capacity: String(r.capacity ?? 1),
      roomType: r.roomType ?? '',
      monthlyFee: r.monthlyFee ? String(r.monthlyFee) : '',
    });
    setRoomError(null);
    setRoomOpen(true);
  }
  function submitRoom(e: FormEvent) {
    e.preventDefault();
    setRoomError(null);
    if (editingRoomId) {
      if (!roomForm.roomNo) {
        setRoomError('Please fill all required fields.');
        return;
      }
      updateRoom.mutate({
        roomNo: roomForm.roomNo,
        block: roomForm.block || undefined,
        floor: roomForm.floor || undefined,
        capacity: roomForm.capacity ? Number(roomForm.capacity) : undefined,
        roomType: roomForm.roomType || undefined,
        monthlyFee: roomForm.monthlyFee ? Number(roomForm.monthlyFee) : undefined,
      });
      return;
    }
    const effectiveSchoolId = isUnrestricted ? roomForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !roomForm.roomNo) {
      setRoomError('Please fill all required fields.');
      return;
    }
    createRoom.mutate({
      schoolId: effectiveSchoolId,
      roomNo: roomForm.roomNo,
      block: roomForm.block || undefined,
      floor: roomForm.floor || undefined,
      capacity: roomForm.capacity ? Number(roomForm.capacity) : undefined,
      roomType: roomForm.roomType || undefined,
      monthlyFee: roomForm.monthlyFee ? Number(roomForm.monthlyFee) : undefined,
    });
  }

  // ─────────────────────────── Allocations tab ───────────────────────────
  const [allocActiveFilter, setAllocActiveFilter] = useState('true');
  const allocationsQuery = useQuery({
    queryKey: ['hostel', 'allocations', allocActiveFilter],
    queryFn: () => api.get<HostelAllocation[]>('/hostel/allocations', { isActive: allocActiveFilter }),
    enabled: canView,
  });
  const myAllocationsQuery = useQuery({
    queryKey: ['hostel', 'allocations', 'mine'],
    queryFn: () => api.get<HostelAllocation[]>('/hostel/allocations/mine'),
    enabled: isStudent,
  });

  const [allocOpen, setAllocOpen] = useState(false);
  const [allocForm, setAllocForm] = useState({ studentId: '', roomId: '' });
  const [allocError, setAllocError] = useState<string | null>(null);
  const [vacateTarget, setVacateTarget] = useState<HostelAllocation | null>(null);

  const allocateRoom = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/hostel/allocations', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostel', 'allocations'] });
      queryClient.invalidateQueries({ queryKey: ['hostel', 'rooms'] });
      setAllocOpen(false);
      setAllocForm({ studentId: '', roomId: '' });
      setAllocError(null);
    },
    onError: (err: unknown) => setAllocError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const vacateRoom = useMutation({
    mutationFn: (id: string) => api.patch(`/hostel/allocations/${id}/vacate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostel', 'allocations'] });
      queryClient.invalidateQueries({ queryKey: ['hostel', 'rooms'] });
      setVacateTarget(null);
    },
  });

  function openAllocDialog() {
    setAllocForm({ studentId: '', roomId: '' });
    setAllocError(null);
    setAllocOpen(true);
  }
  function submitAlloc(e: FormEvent) {
    e.preventDefault();
    setAllocError(null);
    if (!allocForm.studentId || !allocForm.roomId) {
      setAllocError('Please select a student and a room.');
      return;
    }
    allocateRoom.mutate(allocForm);
  }

  // ─────────────────────────── Visitors tab ───────────────────────────
  const visitorsQuery = useQuery({ queryKey: ['hostel', 'visitors'], queryFn: () => api.get<HostelVisitor[]>('/hostel/visitors'), enabled: canManage });
  const [visitorOpen, setVisitorOpen] = useState(false);
  const [visitorForm, setVisitorForm] = useState({ studentId: '', visitorName: '', relation: '', phone: '', purpose: '' });
  const [visitorError, setVisitorError] = useState<string | null>(null);

  const checkInVisitor = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/hostel/visitors', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostel', 'visitors'] });
      setVisitorOpen(false);
      setVisitorForm({ studentId: '', visitorName: '', relation: '', phone: '', purpose: '' });
      setVisitorError(null);
    },
    onError: (err: unknown) => setVisitorError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const checkOutVisitor = useMutation({
    mutationFn: (id: string) => api.patch(`/hostel/visitors/${id}/checkout`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hostel', 'visitors'] }),
  });

  function openVisitorDialog() {
    setVisitorForm({ studentId: '', visitorName: '', relation: '', phone: '', purpose: '' });
    setVisitorError(null);
    setVisitorOpen(true);
  }
  function submitVisitor(e: FormEvent) {
    e.preventDefault();
    setVisitorError(null);
    if (!visitorForm.studentId || !visitorForm.visitorName) {
      setVisitorError('Please select a student and enter the visitor name.');
      return;
    }
    checkInVisitor.mutate({
      studentId: visitorForm.studentId,
      visitorName: visitorForm.visitorName,
      relation: visitorForm.relation || undefined,
      phone: visitorForm.phone || undefined,
      purpose: visitorForm.purpose || undefined,
    });
  }

  // ─────────────────────────── Attendance tab ───────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const [attendanceDate, setAttendanceDate] = useState(today);
  const attendanceQuery = useQuery({
    queryKey: ['hostel', 'attendance', attendanceDate],
    queryFn: () => api.get<HostelAttendanceRecord[]>('/hostel/attendance', { date: attendanceDate }),
    enabled: canManage,
  });
  // Current residents (active allocations) - the roster we mark attendance against.
  const residentsForAttendance = allocationsQuery.data ?? [];
  const [pendingStatus, setPendingStatus] = useState<Record<string, AttendanceStatus>>({});

  const markAttendance = useMutation({
    mutationFn: (entries: { studentId: string; status: AttendanceStatus }[]) =>
      api.post('/hostel/attendance/mark', { date: attendanceDate, entries }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostel', 'attendance'] });
      setPendingStatus({});
    },
  });

  function setStatus(studentId: string, status: AttendanceStatus) {
    setPendingStatus((p) => ({ ...p, [studentId]: status }));
  }
  function submitAttendance() {
    const entries = Object.entries(pendingStatus).map(([studentId, status]) => ({ studentId, status }));
    if (entries.length === 0) return;
    markAttendance.mutate(entries);
  }

  const existingStatusByStudent = new Map(
    (attendanceQuery.data ?? []).map((r) => [r.studentId, r.status]),
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Hostel</h2>
        <p className="mt-1 text-sm text-muted-foreground">Rooms, resident allocation, visitor log, and daily attendance.</p>
      </div>

      <Tabs defaultValue={canView ? 'rooms' : 'mine'}>
        <TabsList>
          {canView && <TabsTrigger value="rooms">Rooms</TabsTrigger>}
          {canView && <TabsTrigger value="allocations">Allocations</TabsTrigger>}
          {canManage && <TabsTrigger value="visitors">Visitors</TabsTrigger>}
          {canManage && <TabsTrigger value="attendance">Attendance</TabsTrigger>}
          {isStudent && <TabsTrigger value="mine">My Room</TabsTrigger>}
        </TabsList>

        {/* ── Rooms ── */}
        {canView && (
          <TabsContent value="rooms">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div />
                {canManage && (
                  <Button onClick={openRoomDialog}>
                    <Plus className="h-4 w-4" />
                    Add Room
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {roomsQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !roomsQuery.data?.length ? (
                  <EmptyState icon={DoorOpen} label="No rooms added yet" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room No.</TableHead>
                        <TableHead>Block / Floor</TableHead>
                        <TableHead>Occupancy</TableHead>
                        <TableHead>Monthly Fee</TableHead>
                        <TableHead>Status</TableHead>
                        {canManage && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roomsQuery.data.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-foreground">{r.roomNo}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {[r.block, r.floor].filter(Boolean).join(' / ') || '—'}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {r.allocations?.length ?? 0} / {r.capacity}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.monthlyFee ? `Rs. ${r.monthlyFee}` : '—'}</TableCell>
                          <TableCell>
                            <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openEditRoomDialog(r)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {canDelete && r.isActive && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeactivateRoom(r)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
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
        )}

        {/* ── Allocations ── */}
        {canView && (
          <TabsContent value="allocations">
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div className="w-full max-w-xs">
                  <Field label="Status">
                    <Select value={allocActiveFilter} onValueChange={setAllocActiveFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Currently residing</SelectItem>
                        <SelectItem value="false">Vacated</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {canManage && (
                  <Button onClick={openAllocDialog}>
                    <UserPlus className="h-4 w-4" />
                    Allocate Room
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {allocationsQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !allocationsQuery.data?.length ? (
                  <EmptyState icon={Users} label="No allocations found" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Check-out</TableHead>
                        {allocActiveFilter === 'true' && canManage && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocationsQuery.data.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium text-foreground">{a.student?.user.fullName}</TableCell>
                          <TableCell className="text-muted-foreground">{a.room?.roomNo}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(a.checkInDate)}</TableCell>
                          <TableCell className="text-muted-foreground">{a.checkOutDate ? formatDate(a.checkOutDate) : '—'}</TableCell>
                          {allocActiveFilter === 'true' && canManage && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => setVacateTarget(a)}>
                                Vacate
                              </Button>
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
        )}

        {/* ── Visitors ── */}
        {canManage && (
          <TabsContent value="visitors">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div />
                <Button onClick={openVisitorDialog}>
                  <Plus className="h-4 w-4" />
                  Log Visitor
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {visitorsQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !visitorsQuery.data?.length ? (
                  <EmptyState icon={Users} label="No visitors logged yet" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Visitor</TableHead>
                        <TableHead>Visiting</TableHead>
                        <TableHead>Relation</TableHead>
                        <TableHead>Checked in</TableHead>
                        <TableHead>Checked out</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visitorsQuery.data.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium text-foreground">{v.visitorName}</TableCell>
                          <TableCell className="text-muted-foreground">{v.student?.user.fullName}</TableCell>
                          <TableCell className="text-muted-foreground">{v.relation ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(v.checkInAt).toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {v.checkOutAt ? new Date(v.checkOutAt).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {!v.checkOutAt && (
                              <Button variant="ghost" size="sm" onClick={() => checkOutVisitor.mutate(v.id)} disabled={checkOutVisitor.isPending}>
                                Check Out
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
          </TabsContent>
        )}

        {/* ── Attendance ── */}
        {canManage && (
          <TabsContent value="attendance">
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div className="w-full max-w-xs">
                  <Field label="Date">
                    <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
                  </Field>
                </div>
                <Button onClick={submitAttendance} loading={markAttendance.isPending} disabled={Object.keys(pendingStatus).length === 0}>
                  Save Attendance
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {!residentsForAttendance.length ? (
                  <EmptyState icon={BedDouble} label="No current residents to mark" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {residentsForAttendance.map((a) => {
                        const current = pendingStatus[a.studentId] ?? existingStatusByStudent.get(a.studentId) ?? 'PRESENT';
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium text-foreground">{a.student?.user.fullName}</TableCell>
                            <TableCell className="text-muted-foreground">{a.room?.roomNo}</TableCell>
                            <TableCell>
                              <div className="flex gap-1.5">
                                {STATUS_OPTIONS.map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setStatus(a.studentId, opt)}
                                    className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                                      current === opt
                                        ? `${STATUS_VARIANT[opt] === 'success' ? 'border-success bg-success/10 text-success' : ''}${
                                            STATUS_VARIANT[opt] === 'destructive' ? 'border-destructive bg-destructive/10 text-destructive' : ''
                                          }${STATUS_VARIANT[opt] === 'warning' ? 'border-warning bg-warning/15 text-amber-700' : ''}${
                                            STATUS_VARIANT[opt] === 'secondary' ? 'border-border bg-secondary text-secondary-foreground' : ''
                                          }`
                                        : 'border-border text-muted-foreground hover:bg-secondary'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
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
        )}

        {/* ── My Room ── */}
        {isStudent && (
          <TabsContent value="mine">
            <Card>
              <CardContent className="pt-6">
                {myAllocationsQuery.isLoading ? (
                  <Skeleton className="h-11 w-full" />
                ) : !myAllocationsQuery.data?.length ? (
                  <EmptyState icon={BedDouble} label="You are not currently allocated a hostel room" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Check-out</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myAllocationsQuery.data.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium text-foreground">{a.room?.roomNo}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(a.checkInDate)}</TableCell>
                          <TableCell className="text-muted-foreground">{a.checkOutDate ? formatDate(a.checkOutDate) : '—'}</TableCell>
                          <TableCell>
                            <Badge variant={a.isActive ? 'success' : 'secondary'}>{a.isActive ? 'Current' : 'Past'}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Add/Edit room dialog */}
      <Dialog
        open={roomOpen}
        onOpenChange={(open) => {
          setRoomOpen(open);
          if (!open) setEditingRoomId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoomId ? 'Edit Room' : 'Add Room'}</DialogTitle>
            <DialogDescription>
              {editingRoomId ? 'Update this room\'s details.' : 'Add a hostel room to the roster.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRoom} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select
                  value={roomForm.schoolId}
                  onValueChange={(v) => setRoomForm((f) => ({ ...f, schoolId: v }))}
                  disabled={!!editingRoomId}
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
            <Field label="Room No." required>
              <Input value={roomForm.roomNo} onChange={(e) => setRoomForm((f) => ({ ...f, roomNo: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Block">
                <Input value={roomForm.block} onChange={(e) => setRoomForm((f) => ({ ...f, block: e.target.value }))} />
              </Field>
              <Field label="Floor">
                <Input value={roomForm.floor} onChange={(e) => setRoomForm((f) => ({ ...f, floor: e.target.value }))} />
              </Field>
              <Field label="Capacity">
                <Input type="number" min={1} value={roomForm.capacity} onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))} />
              </Field>
              <Field label="Room type">
                <Input placeholder="Single, Shared..." value={roomForm.roomType} onChange={(e) => setRoomForm((f) => ({ ...f, roomType: e.target.value }))} />
              </Field>
            </div>
            <Field label="Monthly fee (Rs.)">
              <Input type="number" min={0} value={roomForm.monthlyFee} onChange={(e) => setRoomForm((f) => ({ ...f, monthlyFee: e.target.value }))} />
            </Field>
            {roomError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{roomError}</div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRoomOpen(false);
                  setEditingRoomId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingRoomId ? updateRoom.isPending : createRoom.isPending}>
                {editingRoomId ? 'Save Changes' : 'Add Room'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Allocate room dialog */}
      <Dialog open={allocOpen} onOpenChange={setAllocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate Room</DialogTitle>
            <DialogDescription>Assign a student to a hostel room.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAlloc} className="space-y-4">
            <Field label="Student" required>
              <Select value={allocForm.studentId} onValueChange={(v) => setAllocForm((f) => ({ ...f, studentId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {(studentsQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.user.fullName} — {s.admissionNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Room" required>
              <Select value={allocForm.roomId} onValueChange={(v) => setAllocForm((f) => ({ ...f, roomId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {(roomsQuery.data ?? [])
                    .filter((r) => r.isActive && (r.allocations?.length ?? 0) < r.capacity)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.roomNo} ({r.allocations?.length ?? 0}/{r.capacity})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            {allocError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{allocError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAllocOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={allocateRoom.isPending}>
                Allocate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Log visitor dialog */}
      <Dialog open={visitorOpen} onOpenChange={setVisitorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Visitor</DialogTitle>
            <DialogDescription>Record a visitor checking in to see a resident.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitVisitor} className="space-y-4">
            <Field label="Student being visited" required>
              <Select value={visitorForm.studentId} onValueChange={(v) => setVisitorForm((f) => ({ ...f, studentId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {(studentsQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.user.fullName} — {s.admissionNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Visitor name" required>
              <Input value={visitorForm.visitorName} onChange={(e) => setVisitorForm((f) => ({ ...f, visitorName: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Relation">
                <Input placeholder="Father, Uncle..." value={visitorForm.relation} onChange={(e) => setVisitorForm((f) => ({ ...f, relation: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <Input value={visitorForm.phone} onChange={(e) => setVisitorForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
            </div>
            <Field label="Purpose">
              <Input value={visitorForm.purpose} onChange={(e) => setVisitorForm((f) => ({ ...f, purpose: e.target.value }))} />
            </Field>
            {visitorError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{visitorError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVisitorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={checkInVisitor.isPending}>
                Log Visitor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateRoom}
        onOpenChange={(open) => !open && setDeactivateRoom(null)}
        title="Deactivate room?"
        description={`This will mark room "${deactivateRoom?.roomNo ?? ''}" as inactive.`}
        confirmLabel="Deactivate"
        loading={deactivateRoomMutation.isPending}
        onConfirm={() => deactivateRoom && deactivateRoomMutation.mutate(deactivateRoom.id)}
      />
      <ConfirmDialog
        open={!!vacateTarget}
        onOpenChange={(open) => !open && setVacateTarget(null)}
        title="Vacate room?"
        description={`This will check "${vacateTarget?.student?.user.fullName ?? ''}" out of room "${vacateTarget?.room?.roomNo ?? ''}".`}
        confirmLabel="Vacate"
        loading={vacateRoom.isPending}
        onConfirm={() => vacateTarget && vacateRoom.mutate(vacateTarget.id)}
      />
    </div>
  );
}
