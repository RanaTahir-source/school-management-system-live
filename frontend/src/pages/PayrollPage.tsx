import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, IdCard, Plus, ReceiptText, Wallet } from 'lucide-react';
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
import type {
  School,
  PayrollStaffProfile,
  EligibleStaffUser,
  SalaryStructure,
  Payslip,
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

function EmptyState({ icon: Icon, label }: { icon: typeof Banknote; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

const currentPeriod = new Date().toISOString().slice(0, 7);

const staffForm0 = { userId: '', employeeId: '', category: '', designation: '', phone: '', joiningDate: '' };
const salaryForm0 = { staffId: '', basicPay: '', allowances: '0', deductions: '0' };

export default function PayrollPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  // Staff Profiles: create/update/delete gated by canManageStaff; the tab
  // itself (read) is visible to canViewStaff - matches
  // StaffProfilesController's @Roles() exactly (no ACCOUNTANT on writes).
  const canManageStaff = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const canViewStaff = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT');
  const canDeleteStaff = hasRole('DIRECTOR', 'ADMIN');

  // Salary Structures / Payslips: writes gated by canManagePayroll (matches
  // SalaryStructureController.upsert / PayslipsController.generate|pay,
  // which allow ACCOUNTANT but not PRINCIPAL); the tabs are visible to
  // canViewPayroll (matches the broader findAll() @Roles on both).
  const canManagePayroll = hasRole('DIRECTOR', 'ADMIN', 'ACCOUNTANT');
  const canViewPayroll = hasRole('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL');

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools') });

  // ─────────────────────────── Staff Profiles tab ───────────────────────────
  const staffQuery = useQuery({
    queryKey: ['payroll', 'staff-profiles'],
    queryFn: () => api.get<PayrollStaffProfile[]>('/payroll/staff-profiles'),
    enabled: canViewStaff,
  });
  const eligibleUsersQuery = useQuery({
    queryKey: ['payroll', 'eligible-users'],
    queryFn: () => api.get<EligibleStaffUser[]>('/payroll/staff-profiles/eligible-users'),
    enabled: canManageStaff,
  });

  const [staffOpen, setStaffOpen] = useState(false);
  const [staffForm, setStaffForm] = useState(staffForm0);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [deactivateStaff, setDeactivateStaff] = useState<PayrollStaffProfile | null>(null);

  const createStaffProfile = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/payroll/staff-profiles', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'staff-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'eligible-users'] });
      setStaffOpen(false);
      setStaffForm(staffForm0);
      setStaffError(null);
    },
    onError: (err: unknown) => setStaffError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const removeStaffProfile = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/staff-profiles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'staff-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'eligible-users'] });
      setDeactivateStaff(null);
    },
  });

  function openStaffDialog() {
    setStaffForm(staffForm0);
    setStaffError(null);
    setStaffOpen(true);
  }
  function submitStaff(e: FormEvent) {
    e.preventDefault();
    setStaffError(null);
    if (!staffForm.userId || !staffForm.employeeId) {
      setStaffError('Please select a user and enter an employee ID.');
      return;
    }
    createStaffProfile.mutate({
      userId: staffForm.userId,
      employeeId: staffForm.employeeId,
      category: staffForm.category || undefined,
      designation: staffForm.designation || undefined,
      phone: staffForm.phone || undefined,
      joiningDate: staffForm.joiningDate || undefined,
    });
  }

  // ─────────────────────────── Salary Structures tab ───────────────────────────
  const salaryQuery = useQuery({
    queryKey: ['payroll', 'salary-structures'],
    queryFn: () => api.get<SalaryStructure[]>('/payroll/salary-structures'),
    enabled: canViewPayroll,
  });

  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState(salaryForm0);
  const [salaryError, setSalaryError] = useState<string | null>(null);

  const upsertSalary = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/payroll/salary-structures', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'salary-structures'] });
      setSalaryOpen(false);
      setSalaryForm(salaryForm0);
      setSalaryError(null);
    },
    onError: (err: unknown) => setSalaryError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function openSalaryDialog(existing?: SalaryStructure) {
    setSalaryForm(
      existing
        ? { staffId: existing.staffId, basicPay: existing.basicPay, allowances: existing.allowances, deductions: existing.deductions }
        : salaryForm0,
    );
    setSalaryError(null);
    setSalaryOpen(true);
  }
  function submitSalary(e: FormEvent) {
    e.preventDefault();
    setSalaryError(null);
    if (!salaryForm.staffId || !salaryForm.basicPay) {
      setSalaryError('Please select a staff member and enter a basic pay amount.');
      return;
    }
    upsertSalary.mutate({
      staffId: salaryForm.staffId,
      basicPay: Number(salaryForm.basicPay),
      allowances: salaryForm.allowances ? Number(salaryForm.allowances) : 0,
      deductions: salaryForm.deductions ? Number(salaryForm.deductions) : 0,
    });
  }

  // ─────────────────────────── Payslips tab ───────────────────────────
  const [periodFilter, setPeriodFilter] = useState(currentPeriod);
  const payslipsQuery = useQuery({
    queryKey: ['payroll', 'payslips', periodFilter],
    queryFn: () => api.get<Payslip[]>('/payroll/payslips', { period: periodFilter || undefined }),
    enabled: canViewPayroll,
  });

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({ schoolId: '', period: currentPeriod });
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<{ created: number; skipped: number } | null>(null);
  const [payTarget, setPayTarget] = useState<Payslip | null>(null);

  const generatePayroll = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<{ created: number; skipped: number }>('/payroll/payslips/generate', payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payslips'] });
      setGenerateResult({ created: data.created, skipped: data.skipped });
      setGenerateError(null);
    },
    onError: (err: unknown) => setGenerateError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const payPayslip = useMutation({
    mutationFn: (id: string) => api.patch(`/payroll/payslips/${id}/pay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payslips'] });
      setPayTarget(null);
    },
  });

  function openGenerateDialog() {
    setGenerateForm({ schoolId: isUnrestricted ? '' : user?.schoolId ?? '', period: periodFilter || currentPeriod });
    setGenerateError(null);
    setGenerateResult(null);
    setGenerateOpen(true);
  }
  function submitGenerate(e: FormEvent) {
    e.preventDefault();
    setGenerateError(null);
    setGenerateResult(null);
    if (!generateForm.schoolId || !generateForm.period) {
      setGenerateError('Please select a school and a period.');
      return;
    }
    generatePayroll.mutate(generateForm);
  }

  // ─────────────────────────── My Payslips tab ───────────────────────────
  const myPayslipsQuery = useQuery({
    queryKey: ['payroll', 'payslips', 'mine'],
    queryFn: () => api.get<Payslip[]>('/payroll/payslips/mine'),
    retry: false,
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Payroll</h2>
        <p className="mt-1 text-sm text-muted-foreground">Staff salary structures, monthly payslip generation, and payment.</p>
      </div>

      <Tabs defaultValue={canViewStaff ? 'staff' : canViewPayroll ? 'salary' : 'mine'}>
        <TabsList>
          {canViewStaff && <TabsTrigger value="staff">Staff Profiles</TabsTrigger>}
          {canViewPayroll && <TabsTrigger value="salary">Salary Structures</TabsTrigger>}
          {canViewPayroll && <TabsTrigger value="payslips">Payslips</TabsTrigger>}
          <TabsTrigger value="mine">My Payslips</TabsTrigger>
        </TabsList>

        {/* ── Staff Profiles ── */}
        {canViewStaff && (
          <TabsContent value="staff">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div />
                {canManageStaff && (
                  <Button onClick={openStaffDialog}>
                    <Plus className="h-4 w-4" />
                    Register Staff Profile
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {staffQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !staffQuery.data?.length ? (
                  <EmptyState icon={IdCard} label="No staff profiles registered yet" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Status</TableHead>
                        {canDeleteStaff && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffQuery.data.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-foreground">{s.user.fullName}</TableCell>
                          <TableCell className="text-muted-foreground">{s.employeeId}</TableCell>
                          <TableCell className="text-muted-foreground">{s.category ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{s.designation ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={s.isActive ? 'success' : 'secondary'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                          </TableCell>
                          {canDeleteStaff && (
                            <TableCell className="text-right">
                              {s.isActive && (
                                <Button variant="ghost" size="sm" onClick={() => setDeactivateStaff(s)}>
                                  Deactivate
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

        {/* ── Salary Structures ── */}
        {canViewPayroll && (
          <TabsContent value="salary">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div />
                {canManagePayroll && (
                  <Button onClick={() => openSalaryDialog()}>
                    <Plus className="h-4 w-4" />
                    Set Salary
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {salaryQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !salaryQuery.data?.length ? (
                  <EmptyState icon={Wallet} label="No salary structures set yet" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Basic Pay</TableHead>
                        <TableHead>Allowances</TableHead>
                        <TableHead>Deductions</TableHead>
                        <TableHead>Net Pay</TableHead>
                        {canManagePayroll && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaryQuery.data.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-foreground">{s.staff.user.fullName}</TableCell>
                          <TableCell className="text-muted-foreground">Rs. {s.basicPay}</TableCell>
                          <TableCell className="text-muted-foreground">Rs. {s.allowances}</TableCell>
                          <TableCell className="text-muted-foreground">Rs. {s.deductions}</TableCell>
                          <TableCell className="font-medium text-foreground">
                            Rs. {(Number(s.basicPay) + Number(s.allowances) - Number(s.deductions)).toFixed(2)}
                          </TableCell>
                          {canManagePayroll && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openSalaryDialog(s)}>
                                Edit
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

        {/* ── Payslips ── */}
        {canViewPayroll && (
          <TabsContent value="payslips">
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div className="w-full max-w-xs">
                  <Field label="Period">
                    <Input type="month" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} />
                  </Field>
                </div>
                {canManagePayroll && (
                  <Button onClick={openGenerateDialog}>
                    <Plus className="h-4 w-4" />
                    Generate Payroll
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {payslipsQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !payslipsQuery.data?.length ? (
                  <EmptyState icon={ReceiptText} label="No payslips for this period yet" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Net Pay</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paid Date</TableHead>
                        {canManagePayroll && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payslipsQuery.data.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium text-foreground">{p.staff?.user.fullName}</TableCell>
                          <TableCell className="text-muted-foreground">{p.period}</TableCell>
                          <TableCell className="text-muted-foreground">Rs. {p.netPay}</TableCell>
                          <TableCell>
                            <Badge variant={p.status === 'PAID' ? 'success' : 'secondary'}>{p.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.paidDate ? formatDate(p.paidDate) : '—'}</TableCell>
                          {canManagePayroll && (
                            <TableCell className="text-right">
                              {p.status === 'PENDING' && (
                                <Button variant="ghost" size="sm" onClick={() => setPayTarget(p)}>
                                  Mark Paid
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

        {/* ── My Payslips ── */}
        <TabsContent value="mine">
          <Card>
            <CardContent className="pt-6">
              {myPayslipsQuery.isLoading ? (
                <Skeleton className="h-11 w-full" />
              ) : !myPayslipsQuery.data?.length ? (
                <EmptyState icon={ReceiptText} label="No payslips found for your account" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Basic Pay</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myPayslipsQuery.data.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-foreground">{p.period}</TableCell>
                        <TableCell className="text-muted-foreground">Rs. {p.basicPay}</TableCell>
                        <TableCell className="text-muted-foreground">Rs. {p.netPay}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'PAID' ? 'success' : 'secondary'}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.paidDate ? formatDate(p.paidDate) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Register staff profile dialog */}
      <Dialog open={staffOpen} onOpenChange={setStaffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Staff Profile</DialogTitle>
            <DialogDescription>Attach HR details to an existing account so it can be paid through Payroll.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitStaff} className="space-y-4">
            <Field label="User account" required>
              <Select value={staffForm.userId} onValueChange={(v) => setStaffForm((f) => ({ ...f, userId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user without a staff profile yet" />
                </SelectTrigger>
                <SelectContent>
                  {(eligibleUsersQuery.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Employee ID" required>
              <Input value={staffForm.employeeId} onChange={(e) => setStaffForm((f) => ({ ...f, employeeId: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <Input placeholder="Teacher, Accountant, Peon..." value={staffForm.category} onChange={(e) => setStaffForm((f) => ({ ...f, category: e.target.value }))} />
              </Field>
              <Field label="Designation">
                <Input value={staffForm.designation} onChange={(e) => setStaffForm((f) => ({ ...f, designation: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <Input value={staffForm.phone} onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
              <Field label="Joining date">
                <Input type="date" value={staffForm.joiningDate} onChange={(e) => setStaffForm((f) => ({ ...f, joiningDate: e.target.value }))} />
              </Field>
            </div>
            {staffError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{staffError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStaffOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createStaffProfile.isPending}>
                Register
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Set salary dialog */}
      <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Salary Structure</DialogTitle>
            <DialogDescription>A staff member has one current structure - saving again overwrites it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitSalary} className="space-y-4">
            <Field label="Staff member" required>
              <Select value={salaryForm.staffId} onValueChange={(v) => setSalaryForm((f) => ({ ...f, staffId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {(staffQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.user.fullName} — {s.employeeId}
                      {salaryQuery.data?.some((sal) => sal.staffId === s.id) ? ' (has a structure)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Basic pay (Rs.)" required>
                <Input type="number" min={0} value={salaryForm.basicPay} onChange={(e) => setSalaryForm((f) => ({ ...f, basicPay: e.target.value }))} required />
              </Field>
              <Field label="Allowances (Rs.)">
                <Input type="number" min={0} value={salaryForm.allowances} onChange={(e) => setSalaryForm((f) => ({ ...f, allowances: e.target.value }))} />
              </Field>
              <Field label="Deductions (Rs.)">
                <Input type="number" min={0} value={salaryForm.deductions} onChange={(e) => setSalaryForm((f) => ({ ...f, deductions: e.target.value }))} />
              </Field>
            </div>
            {salaryError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{salaryError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSalaryOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={upsertSalary.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generate payroll dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Payroll</DialogTitle>
            <DialogDescription>Creates one payslip for every active staff member with a salary structure. Existing payslips for the period are skipped.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitGenerate} className="space-y-4">
            <Field label="School" required>
              <Select value={generateForm.schoolId} onValueChange={(v) => setGenerateForm((f) => ({ ...f, schoolId: v }))}>
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
            <Field label="Period" required>
              <Input type="month" value={generateForm.period} onChange={(e) => setGenerateForm((f) => ({ ...f, period: e.target.value }))} required />
            </Field>
            {generateError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{generateError}</div>
            )}
            {generateResult && (
              <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-sm text-success">
                {generateResult.created} payslip(s) created, {generateResult.skipped} already existed.
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>
                Close
              </Button>
              <Button type="submit" loading={generatePayroll.isPending}>
                Generate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateStaff}
        onOpenChange={(open) => !open && setDeactivateStaff(null)}
        title="Deactivate staff profile?"
        description={`This will mark "${deactivateStaff?.user.fullName ?? ''}" as inactive in the staff directory.`}
        confirmLabel="Deactivate"
        loading={removeStaffProfile.isPending}
        onConfirm={() => deactivateStaff && removeStaffProfile.mutate(deactivateStaff.id)}
      />
      <ConfirmDialog
        open={!!payTarget}
        onOpenChange={(open) => !open && setPayTarget(null)}
        title="Mark payslip as paid?"
        description={`This will record a Rs. ${payTarget?.netPay ?? ''} salary expense for "${payTarget?.staff?.user.fullName ?? ''}" (${payTarget?.period ?? ''}).`}
        confirmLabel="Mark Paid"
        loading={payPayslip.isPending}
        onConfirm={() => payTarget && payPayslip.mutate(payTarget.id)}
      />
    </div>
  );
}
