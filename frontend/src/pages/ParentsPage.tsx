import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Baby, Link2, Plus, ReceiptText, Trash2, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import type {
  School,
  StudentProfile,
  ParentUser,
  MyChild,
  ChildAttendanceRecord,
  ChildExamSummary,
  FeeInvoice,
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

function EmptyState({ icon: Icon, label }: { icon: typeof Baby; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

const RELATION_OPTIONS = ['Father', 'Mother', 'Guardian'];
const parentForm0 = { schoolId: '', fullName: '', email: '', password: '', phone: '' };

export default function ParentsPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const isParent = hasRole('PARENT');

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools') });
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => api.get<StudentProfile[]>('/students'),
    enabled: canManage,
  });

  // ─────────────────────────── Manage Parents tab ───────────────────────────
  const parentsQuery = useQuery({
    queryKey: ['parents'],
    queryFn: () => api.get<ParentUser[]>('/parents'),
    enabled: canManage,
  });

  const [parentOpen, setParentOpen] = useState(false);
  const [parentForm, setParentForm] = useState(parentForm0);
  const [parentError, setParentError] = useState<string | null>(null);

  const createParent = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/parents', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      setParentOpen(false);
      setParentForm(parentForm0);
      setParentError(null);
    },
    onError: (err: unknown) => setParentError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function openParentDialog() {
    setParentForm({ ...parentForm0, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setParentError(null);
    setParentOpen(true);
  }
  function submitParent(e: FormEvent) {
    e.preventDefault();
    setParentError(null);
    const effectiveSchoolId = isUnrestricted ? parentForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !parentForm.fullName || !parentForm.email || !parentForm.password) {
      setParentError('Please fill all required fields.');
      return;
    }
    createParent.mutate({
      schoolId: effectiveSchoolId,
      fullName: parentForm.fullName,
      email: parentForm.email,
      password: parentForm.password,
      phone: parentForm.phone || undefined,
    });
  }

  // Link / unlink child
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ parentId: '', studentId: '', relation: '' });
  const [linkError, setLinkError] = useState<string | null>(null);

  const linkChild = useMutation({
    mutationFn: ({ parentId, ...payload }: { parentId: string; studentId: string; relation?: string }) =>
      api.post(`/parents/${parentId}/children`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      setLinkOpen(false);
      setLinkForm({ parentId: '', studentId: '', relation: '' });
      setLinkError(null);
    },
    onError: (err: unknown) => setLinkError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const unlinkChild = useMutation({
    mutationFn: ({ parentId, studentId }: { parentId: string; studentId: string }) =>
      api.delete(`/parents/${parentId}/children/${studentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parents'] }),
  });

  function openLinkDialog(parentId: string) {
    setLinkForm({ parentId, studentId: '', relation: '' });
    setLinkError(null);
    setLinkOpen(true);
  }
  function submitLink(e: FormEvent) {
    e.preventDefault();
    setLinkError(null);
    if (!linkForm.studentId) {
      setLinkError('Please select a child.');
      return;
    }
    linkChild.mutate({ parentId: linkForm.parentId, studentId: linkForm.studentId, relation: linkForm.relation || undefined });
  }

  // ─────────────────────────── My Children tab ───────────────────────────
  const myChildrenQuery = useQuery({
    queryKey: ['parent-portal', 'children'],
    queryFn: () => api.get<MyChild[]>('/parent-portal/children'),
    enabled: isParent,
  });
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const attendanceQuery = useQuery({
    queryKey: ['parent-portal', 'attendance', selectedChildId],
    queryFn: () => api.get<ChildAttendanceRecord[]>(`/parent-portal/children/${selectedChildId}/attendance`),
    enabled: !!selectedChildId,
  });
  const resultsQuery = useQuery({
    queryKey: ['parent-portal', 'results', selectedChildId],
    queryFn: () => api.get<ChildExamSummary[]>(`/parent-portal/children/${selectedChildId}/results`),
    enabled: !!selectedChildId,
  });
  const feesQuery = useQuery({
    queryKey: ['parent-portal', 'fees', selectedChildId],
    queryFn: () => api.get<FeeInvoice[]>(`/parent-portal/children/${selectedChildId}/fees`),
    enabled: !!selectedChildId,
  });

  const ATTENDANCE_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
    PRESENT: 'success',
    ABSENT: 'destructive',
    LATE: 'warning',
    LEAVE: 'secondary',
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Parent Portal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {canManage ? 'Create parent accounts and link them to their children.' : "Your children's attendance, results, and fees."}
        </p>
      </div>

      <Tabs defaultValue={canManage ? 'manage' : 'mine'}>
        <TabsList>
          {canManage && <TabsTrigger value="manage">Manage Parents</TabsTrigger>}
          {isParent && <TabsTrigger value="mine">My Children</TabsTrigger>}
        </TabsList>

        {/* ── Manage Parents ── */}
        {canManage && (
          <TabsContent value="manage">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div />
                <Button onClick={openParentDialog}>
                  <Plus className="h-4 w-4" />
                  Add Parent
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {parentsQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !parentsQuery.data?.length ? (
                  <EmptyState icon={Users} label="No parent accounts created yet" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Children</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parentsQuery.data.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium text-foreground">{p.fullName}</TableCell>
                          <TableCell className="text-muted-foreground">{p.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {p.children.length === 0 ? (
                                <span className="text-muted-foreground">No children linked</span>
                              ) : (
                                p.children.map((c) => (
                                  <Badge key={c.id} variant="secondary" className="gap-1">
                                    {c.student.user.fullName}
                                    {c.relation ? ` (${c.relation})` : ''}
                                    <button
                                      type="button"
                                      className="ml-1 text-muted-foreground hover:text-destructive"
                                      onClick={() => unlinkChild.mutate({ parentId: p.id, studentId: c.student.id })}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.isActive ? 'success' : 'secondary'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openLinkDialog(p.id)}>
                              <Link2 className="h-4 w-4" />
                              Link Child
                            </Button>
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

        {/* ── My Children ── */}
        {isParent && (
          <TabsContent value="mine">
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {myChildrenQuery.isLoading ? (
                    <Skeleton className="h-11 w-full" />
                  ) : !myChildrenQuery.data?.length ? (
                    <EmptyState icon={Baby} label="No children linked to your account yet" />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {myChildrenQuery.data.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedChildId(c.student.id)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            selectedChildId === c.student.id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-foreground hover:bg-secondary'
                          }`}
                        >
                          {c.student.user.fullName}
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {c.student.section ? `${c.student.section.class.name} - ${c.student.section.name}` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedChildId && (
                <div className="grid gap-4 lg:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <p className="font-medium text-foreground">Attendance</p>
                    </CardHeader>
                    <CardContent className="max-h-80 space-y-2 overflow-y-auto pt-0">
                      {attendanceQuery.isLoading ? (
                        <Skeleton className="h-9 w-full" />
                      ) : !attendanceQuery.data?.length ? (
                        <p className="text-sm text-muted-foreground">No attendance records yet.</p>
                      ) : (
                        attendanceQuery.data.map((r) => (
                          <div key={r.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{formatDate(r.date)}</span>
                            <Badge variant={ATTENDANCE_VARIANT[r.status]}>{r.status}</Badge>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <p className="font-medium text-foreground">Exam Results</p>
                    </CardHeader>
                    <CardContent className="max-h-80 space-y-3 overflow-y-auto pt-0">
                      {resultsQuery.isLoading ? (
                        <Skeleton className="h-9 w-full" />
                      ) : !resultsQuery.data?.length ? (
                        <p className="text-sm text-muted-foreground">No exam results yet.</p>
                      ) : (
                        resultsQuery.data.map((e) => (
                          <div key={e.examId} className="rounded-lg border border-border p-2.5 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground">{e.examName}</span>
                              <span className="text-muted-foreground">{e.percentage != null ? `${e.percentage}%` : '—'}</span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {e.totalObtained} / {e.totalMax} marks
                            </p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <p className="font-medium text-foreground">Fees</p>
                    </CardHeader>
                    <CardContent className="max-h-80 space-y-2 overflow-y-auto pt-0">
                      {feesQuery.isLoading ? (
                        <Skeleton className="h-9 w-full" />
                      ) : !feesQuery.data?.length ? (
                        <EmptyState icon={ReceiptText} label="No fee invoices yet" />
                      ) : (
                        feesQuery.data.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{inv.period}</span>
                            <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIAL' ? 'warning' : 'destructive'}>
                              {inv.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Add parent dialog */}
      <Dialog open={parentOpen} onOpenChange={setParentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Parent Account</DialogTitle>
            <DialogDescription>Creates a login the parent can use to view their children's records.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitParent} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select value={parentForm.schoolId} onValueChange={(v) => setParentForm((f) => ({ ...f, schoolId: v }))}>
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
            <Field label="Full name" required>
              <Input value={parentForm.fullName} onChange={(e) => setParentForm((f) => ({ ...f, fullName: e.target.value }))} required />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={parentForm.email} onChange={(e) => setParentForm((f) => ({ ...f, email: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Password" required>
                <PasswordInput value={parentForm.password} onChange={(e) => setParentForm((f) => ({ ...f, password: e.target.value }))} required />
              </Field>
              <Field label="Phone">
                <Input value={parentForm.phone} onChange={(e) => setParentForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
            </div>
            {parentError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{parentError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setParentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createParent.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Link child dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Child</DialogTitle>
            <DialogDescription>Give this parent portal access to a student's records.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitLink} className="space-y-4">
            <Field label="Child" required>
              <Select value={linkForm.studentId} onValueChange={(v) => setLinkForm((f) => ({ ...f, studentId: v }))}>
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
            <Field label="Relation">
              <Select value={linkForm.relation || '__none__'} onValueChange={(v) => setLinkForm((f) => ({ ...f, relation: v === '__none__' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not specified</SelectItem>
                  {RELATION_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {linkError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{linkError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={linkChild.isPending}>
                Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
