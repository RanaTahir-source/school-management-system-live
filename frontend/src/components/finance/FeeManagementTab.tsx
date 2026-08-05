import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, Plus, Receipt, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { formatCurrency, formatDate } from '@/lib/utils';
import type {
  ClassRecord,
  AcademicYear,
  FeeHead,
  FeeStructure,
  FeeInvoice,
  FeePayment,
  FeeConcession,
  StudentProfile,
} from '@/types';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function statusVariant(status: string) {
  if (status === 'PAID') return 'success' as const;
  if (status === 'PARTIAL') return 'warning' as const;
  return 'destructive' as const;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export default function FeeManagementTab({ effectiveSchoolId }: { effectiveSchoolId: string }) {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'ACCOUNTANT');

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassRecord[]>('/classes') });
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => api.get<AcademicYear[]>('/academic-years') });
  const feeHeadsQuery = useQuery({
    queryKey: ['fee-heads', effectiveSchoolId],
    queryFn: () => api.get<FeeHead[]>('/finance/fee-heads', { schoolId: effectiveSchoolId || undefined }),
  });

  const classesForSchool = useMemo(
    () => (classesQuery.data ?? []).filter((c) => !effectiveSchoolId || c.schoolId === effectiveSchoolId),
    [classesQuery.data, effectiveSchoolId],
  );
  const yearsForSchool = useMemo(
    () => (yearsQuery.data ?? []).filter((y) => !effectiveSchoolId || y.schoolId === effectiveSchoolId),
    [yearsQuery.data, effectiveSchoolId],
  );

  // ── Fee Heads ──
  const [headOpen, setHeadOpen] = useState(false);
  const [headName, setHeadName] = useState('');
  const [headMonthly, setHeadMonthly] = useState(true);
  const [headError, setHeadError] = useState<string | null>(null);
  const createHead = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/finance/fee-heads', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-heads'] });
      setHeadOpen(false);
      setHeadName('');
      setHeadMonthly(true);
      setHeadError(null);
    },
    onError: (err: unknown) => setHeadError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  function submitHead(e: FormEvent) {
    e.preventDefault();
    if (!effectiveSchoolId) {
      setHeadError('Select a school first.');
      return;
    }
    if (!headName.trim()) {
      setHeadError('Name is required.');
      return;
    }
    createHead.mutate({ schoolId: effectiveSchoolId, name: headName.trim(), isMonthly: headMonthly });
  }

  // ── Fee Structure ──
  const [structureClassId, setStructureClassId] = useState('');
  const [structureYearId, setStructureYearId] = useState('');
  const structureQuery = useQuery({
    queryKey: ['fee-structure', structureClassId, structureYearId],
    queryFn: () => api.get<FeeStructure | null>('/finance/fee-structures', { classId: structureClassId, academicYearId: structureYearId }),
    enabled: !!structureClassId && !!structureYearId,
  });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const head of feeHeadsQuery.data ?? []) {
      const existing = structureQuery.data?.items?.find((i) => i.feeHeadId === head.id);
      next[head.id] = existing ? String(existing.amount) : '';
    }
    setAmounts(next);
  }, [structureQuery.data, feeHeadsQuery.data]);

  const [structureError, setStructureError] = useState<string | null>(null);
  const [structureSaved, setStructureSaved] = useState(false);
  const saveStructure = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/finance/fee-structures', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-structure'] });
      setStructureError(null);
      setStructureSaved(true);
      setTimeout(() => setStructureSaved(false), 3000);
    },
    onError: (err: unknown) => setStructureError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  function submitStructure() {
    setStructureError(null);
    const items = Object.entries(amounts)
      .filter(([, v]) => v !== '' && Number(v) >= 0)
      .map(([feeHeadId, v]) => ({ feeHeadId, amount: Number(v) }));
    if (items.length === 0) {
      setStructureError('Enter at least one fee head amount.');
      return;
    }
    saveStructure.mutate({ classId: structureClassId, academicYearId: structureYearId, items });
  }

  // ── Generate Invoices ──
  const [genClassId, setGenClassId] = useState('');
  const [genYearId, setGenYearId] = useState('');
  const [genPeriod, setGenPeriod] = useState(currentPeriod());
  const [genDueDate, setGenDueDate] = useState(today());
  const [genIncludeOneTime, setGenIncludeOneTime] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const generateInvoices = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<any>('/finance/fee-invoices/generate', payload),
    onSuccess: (res) => {
      setGenError(null);
      setGenResult(`Created ${res.created} invoice(s), skipped ${res.skipped} (already invoiced) out of ${res.students} student(s).`);
      queryClient.invalidateQueries({ queryKey: ['fee-dues'] });
    },
    onError: (err: unknown) => {
      setGenResult(null);
      setGenError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });
  function submitGenerate(e: FormEvent) {
    e.preventDefault();
    setGenResult(null);
    setGenError(null);
    if (!genClassId || !genYearId || !genPeriod || !genDueDate) {
      setGenError('Please fill all fields.');
      return;
    }
    generateInvoices.mutate({
      classId: genClassId,
      academicYearId: genYearId,
      period: genPeriod,
      dueDate: genDueDate,
      includeOneTimeFees: genIncludeOneTime,
    });
  }

  const [guardianPhoneSearch, setGuardianPhoneSearch] = useState('');

  // ── Dues & Payments ──
  const [duesPeriod, setDuesPeriod] = useState(currentPeriod());
  const [duesStatus, setDuesStatus] = useState<string>('');
  const [collectionDate, setCollectionDate] = useState(today());
  const [annualYear, setAnnualYear] = useState(String(new Date().getFullYear()));
  const duesQuery = useQuery({
    queryKey: ['fee-dues', effectiveSchoolId, duesPeriod, duesStatus],
    queryFn: () =>
      api.get<FeeInvoice[]>('/finance/fee-invoices/dues', {
        schoolId: effectiveSchoolId || undefined,
        period: duesPeriod || undefined,
        status: duesStatus || undefined,
      }),
  });

  const [payTarget, setPayTarget] = useState<FeeInvoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [payMethod, setPayMethod] = useState('Cash');
  const [payError, setPayError] = useState<string | null>(null);
  const [lastPayment, setLastPayment] = useState<FeePayment | null>(null);
  const recordPayment = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<FeePayment>('/finance/fee-payments', payload),
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ['fee-dues'] });
      setPayTarget(null);
      setPayError(null);
      setLastPayment(payment);
    },
    onError: (err: unknown) => setPayError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  function openPayDialog(invoice: FeeInvoice) {
    const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    setPayTarget(invoice);
    setPayAmount(balance.toFixed(2));
    setPayDate(today());
    setPayMethod('Cash');
    setPayError(null);
  }
  function submitPayment(e: FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    setPayError(null);
    if (!payAmount || Number(payAmount) <= 0) {
      setPayError('Enter a valid amount.');
      return;
    }
    recordPayment.mutate({
      invoiceId: payTarget.id,
      amount: Number(payAmount),
      paidDate: payDate,
      method: payMethod,
    });
  }

  // ── Concessions ──
  const [concStudentSearch, setConcStudentSearch] = useState('');
  const [concStudentId, setConcStudentId] = useState('');
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: () => api.get<StudentProfile[]>('/students') });
  const studentsForSchool = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data]);
  const filteredStudents = useMemo(() => {
    const q = concStudentSearch.trim().toLowerCase();
    if (!q) return studentsForSchool.slice(0, 20);
    return studentsForSchool
      .filter((s) => s.user.fullName.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q))
      .slice(0, 20);
  }, [studentsForSchool, concStudentSearch]);
  const selectedConcStudent = useMemo(
    () => studentsForSchool.find((s) => s.id === concStudentId) ?? null,
    [studentsForSchool, concStudentId],
  );

  const concessionsQuery = useQuery({
    queryKey: ['fee-concessions', concStudentId],
    queryFn: () => api.get<FeeConcession[]>(`/finance/fee-concessions/student/${concStudentId}`),
    enabled: !!concStudentId,
  });

  const [concFeeHeadId, setConcFeeHeadId] = useState('');
  const [concType, setConcType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE');
  const [concValue, setConcValue] = useState('');
  const [concReason, setConcReason] = useState('');
  const [concError, setConcError] = useState<string | null>(null);
  const createConcession = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/finance/fee-concessions', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-concessions', concStudentId] });
      setConcFeeHeadId('');
      setConcType('PERCENTAGE');
      setConcValue('');
      setConcReason('');
      setConcError(null);
    },
    onError: (err: unknown) => setConcError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  function submitConcession(e: FormEvent) {
    e.preventDefault();
    setConcError(null);
    if (!concStudentId) {
      setConcError('Select a student first.');
      return;
    }
    if (!concValue || Number(concValue) <= 0) {
      setConcError('Enter a valid value.');
      return;
    }
    if (concType === 'PERCENTAGE' && Number(concValue) > 100) {
      setConcError('Percentage cannot exceed 100.');
      return;
    }
    createConcession.mutate({
      studentId: concStudentId,
      feeHeadId: concFeeHeadId || undefined,
      type: concType,
      value: Number(concValue),
      reason: concReason.trim() || undefined,
    });
  }
  const removeConcession = useMutation({
    mutationFn: (id: string) => api.delete(`/finance/fee-concessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fee-concessions', concStudentId] }),
  });

  return (
    <div className="space-y-5">
      <Tabs defaultValue="structure">
        <TabsList>
          <TabsTrigger value="structure">Fee Structure</TabsTrigger>
          <TabsTrigger value="generate">Generate Invoices</TabsTrigger>
          <TabsTrigger value="dues">Dues & Payments</TabsTrigger>
          <TabsTrigger value="concessions">Concessions</TabsTrigger>
        </TabsList>

        {/* Fee Structure tab (fee heads live here too, since a structure needs heads to exist first) */}
        <TabsContent value="structure" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Fee Heads</CardTitle>
                <CardDescription>Categories like Tuition Fee, Admission Fee, Transport Fee</CardDescription>
              </div>
              {canManage && (
                <Button size="sm" onClick={() => setHeadOpen(true)} disabled={!effectiveSchoolId}>
                  <Plus className="h-4 w-4" />
                  Add Fee Head
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {feeHeadsQuery.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : !feeHeadsQuery.data?.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No fee heads yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {feeHeadsQuery.data.map((h) => (
                    <Badge key={h.id} variant={h.isMonthly ? 'default' : 'secondary'}>
                      {h.name} {!h.isMonthly && '(one-time)'}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Class Fee Structure</CardTitle>
              <CardDescription>Set the monthly amount per fee head for a class, for an academic year</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Class" required>
                  <Select value={structureClassId} onValueChange={setStructureClassId}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {classesForSchool.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Academic Year" required>
                  <Select value={structureYearId} onValueChange={setStructureYearId}>
                    <SelectTrigger><SelectValue placeholder="Select academic year" /></SelectTrigger>
                    <SelectContent>
                      {yearsForSchool.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {structureClassId && structureYearId && (
                <div className="space-y-3">
                  {feeHeadsQuery.isLoading || structureQuery.isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : !feeHeadsQuery.data?.length ? (
                    <p className="text-sm text-muted-foreground">Add fee heads above first.</p>
                  ) : (
                    <div className="space-y-2">
                      {feeHeadsQuery.data.map((h) => (
                        <div key={h.id} className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
                          <span className="text-sm font-medium text-foreground">
                            {h.name} {!h.isMonthly && <span className="text-xs text-muted-foreground">(one-time)</span>}
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-36"
                            value={amounts[h.id] ?? ''}
                            onChange={(e) => setAmounts((a) => ({ ...a, [h.id]: e.target.value }))}
                            disabled={!canManage}
                            placeholder="0.00"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {structureError && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{structureError}</div>}
                  {structureSaved && <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-sm text-success">Fee structure saved.</div>}
                  {canManage && !!feeHeadsQuery.data?.length && (
                    <Button onClick={submitStructure} loading={saveStructure.isPending}>Save Fee Structure</Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generate Invoices tab */}
        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>Generate Monthly Invoices</CardTitle>
              <CardDescription>Creates one due-invoice per active student in the class, from its fee structure</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <form onSubmit={submitGenerate} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Class" required>
                    <Select value={genClassId} onValueChange={setGenClassId}>
                      <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>
                        {classesForSchool.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Academic Year" required>
                    <Select value={genYearId} onValueChange={setGenYearId}>
                      <SelectTrigger><SelectValue placeholder="Select academic year" /></SelectTrigger>
                      <SelectContent>
                        {yearsForSchool.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {genClassId && genYearId && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        api.openBlob(
                          `/finance/fee-invoices/register.pdf?${new URLSearchParams({ classId: genClassId, academicYearId: genYearId }).toString()}`,
                        )
                      }
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Fee Register
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        api.downloadBlob(
                          `/finance/fee-invoices/register.pdf?${new URLSearchParams({ classId: genClassId, academicYearId: genYearId }).toString()}`,
                          `fee-register-${genClassId}.pdf`,
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Fee Register
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        api.openBlob(
                          `/finance/fee-invoices/register-blank.pdf?${new URLSearchParams({ classId: genClassId, academicYearId: genYearId }).toString()}`,
                        )
                      }
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Blank Register
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        api.downloadBlob(
                          `/finance/fee-invoices/register-blank.pdf?${new URLSearchParams({ classId: genClassId, academicYearId: genYearId }).toString()}`,
                          `fee-register-blank-${genClassId}.pdf`,
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Blank Register
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Period (month)" required>
                    <Input type="month" value={genPeriod} onChange={(e) => setGenPeriod(e.target.value)} required />
                  </Field>
                  <Field label="Due Date" required>
                    <Input type="date" value={genDueDate} onChange={(e) => setGenDueDate(e.target.value)} required />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={genIncludeOneTime}
                    onChange={(e) => setGenIncludeOneTime(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Include one-time fee heads (e.g. Admission Fee) — use only for the first invoice
                </label>
                {genError && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{genError}</div>}
                {genResult && <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-sm text-success">{genResult}</div>}
                {canManage && <Button type="submit" loading={generateInvoices.isPending}>Generate Invoices</Button>}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dues & Payments tab */}
        <TabsContent value="dues" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Period">
                <Input type="month" value={duesPeriod} onChange={(e) => setDuesPeriod(e.target.value)} className="w-40" />
              </Field>
              <Field label="Status">
                <Select value={duesStatus || '__all__'} onValueChange={(v) => setDuesStatus(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All</SelectItem>
                    <SelectItem value="UNPAID">Unpaid</SelectItem>
                    <SelectItem value="PARTIAL">Partial</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {!!duesQuery.data?.length && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    api.openBlob(
                      `/finance/fee-invoices/dues/report.pdf?${new URLSearchParams({
                        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                        ...(duesPeriod ? { period: duesPeriod } : {}),
                        ...(duesStatus ? { status: duesStatus } : {}),
                      }).toString()}`,
                    )
                  }
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Dues Report
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    api.downloadBlob(
                      `/finance/fee-invoices/dues/report.pdf?${new URLSearchParams({
                        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                        ...(duesPeriod ? { period: duesPeriod } : {}),
                        ...(duesStatus ? { status: duesStatus } : {}),
                      }).toString()}`,
                      `fee-dues-report-${duesPeriod || 'all'}.pdf`,
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Dues Report
                </Button>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">More Fee Reports</CardTitle>
              <CardDescription>Daily collection sheet, monthly class summary, and annual totals</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4 pt-0">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Collection date">
                  <Input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} className="w-40" />
                </Field>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    api.openBlob(
                      `/finance/fee-payments/collection-report.pdf?${new URLSearchParams({
                        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                        date: collectionDate,
                      }).toString()}`,
                    )
                  }
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    api.downloadBlob(
                      `/finance/fee-payments/collection-report.pdf?${new URLSearchParams({
                        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                        date: collectionDate,
                      }).toString()}`,
                      `fee-collection-${collectionDate}.pdf`,
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Daily Collection
                </Button>
              </div>

              <div className="flex flex-wrap items-end gap-2 border-l border-border pl-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!effectiveSchoolId}
                  onClick={() =>
                    api.openBlob(
                      `/finance/fee-invoices/summary.pdf?${new URLSearchParams({
                        schoolId: effectiveSchoolId,
                        period: duesPeriod,
                      }).toString()}`,
                    )
                  }
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!effectiveSchoolId}
                  onClick={() =>
                    api.downloadBlob(
                      `/finance/fee-invoices/summary.pdf?${new URLSearchParams({
                        schoolId: effectiveSchoolId,
                        period: duesPeriod,
                      }).toString()}`,
                      `fee-summary-${duesPeriod}.pdf`,
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Monthly Summary ({duesPeriod})
                </Button>
              </div>

              <div className="flex flex-wrap items-end gap-2 border-l border-border pl-4">
                <Field label="Year">
                  <Input type="number" min="2000" max="2100" value={annualYear} onChange={(e) => setAnnualYear(e.target.value)} className="w-24" />
                </Field>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!effectiveSchoolId}
                  onClick={() =>
                    api.openBlob(
                      `/finance/fee-invoices/annual.pdf?${new URLSearchParams({
                        schoolId: effectiveSchoolId,
                        year: annualYear,
                      }).toString()}`,
                    )
                  }
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!effectiveSchoolId}
                  onClick={() =>
                    api.downloadBlob(
                      `/finance/fee-invoices/annual.pdf?${new URLSearchParams({
                        schoolId: effectiveSchoolId,
                        year: annualYear,
                      }).toString()}`,
                      `annual-fee-report-${annualYear}.pdf`,
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Annual Report
                </Button>
              </div>

              <div className="flex flex-wrap items-end gap-2 border-l border-border pl-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    api.openBlob(
                      `/finance/fee-invoices/advance.pdf?${new URLSearchParams({
                        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                      }).toString()}`,
                    )
                  }
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    api.downloadBlob(
                      `/finance/fee-invoices/advance.pdf?${new URLSearchParams({
                        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                      }).toString()}`,
                      'advance-fee-sheet.pdf',
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Advance Fee Sheet
                </Button>
              </div>

              <div className="flex flex-wrap items-end gap-2 border-l border-border pl-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    api.openBlob(
                      `/finance/fee-invoices/nominees.pdf?${new URLSearchParams({
                        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                      }).toString()}`,
                    )
                  }
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    api.downloadBlob(
                      `/finance/fee-invoices/nominees.pdf?${new URLSearchParams({
                        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                      }).toString()}`,
                      'fee-nominees.pdf',
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Fee Nominees
                </Button>
              </div>

              <div className="flex flex-wrap items-end gap-2 border-l border-border pl-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!effectiveSchoolId}
                  onClick={() =>
                    api.openBlob(`/finance/fee-invoices/analysis.pdf?${new URLSearchParams({ schoolId: effectiveSchoolId }).toString()}`)
                  }
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!effectiveSchoolId}
                  onClick={() =>
                    api.downloadBlob(
                      `/finance/fee-invoices/analysis.pdf?${new URLSearchParams({ schoolId: effectiveSchoolId }).toString()}`,
                      'fee-analysis.pdf',
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Fee Analysis
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {duesQuery.isLoading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
                </div>
              ) : !duesQuery.data?.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No invoices for this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      {canManage && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duesQuery.data.map((inv) => {
                      const balance = Number(inv.totalAmount) - Number(inv.paidAmount);
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium text-foreground">
                            {inv.student?.user.fullName ?? '—'}
                            <div className="text-xs text-muted-foreground">{inv.student?.admissionNo}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {inv.student?.section ? `${inv.student.section.class.name} - ${inv.student.section.name}` : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(inv.totalAmount)}</TableCell>
                          <TableCell className="text-right tabular-nums text-success">{formatCurrency(inv.paidAmount)}</TableCell>
                          <TableCell className="text-right tabular-nums text-destructive">{formatCurrency(Math.max(balance, 0))}</TableCell>
                          <TableCell><Badge variant={statusVariant(inv.status)}>{inv.status}</Badge></TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {inv.status !== 'PAID' && (
                                  <Button variant="outline" size="sm" onClick={() => openPayDialog(inv)}>
                                    <Receipt className="h-3.5 w-3.5" />
                                    Record Payment
                                  </Button>
                                )}
                                {inv.status !== 'PAID' && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => api.openBlob(`/finance/fee-invoices/${inv.id}/overdue-notice.pdf`)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Notice
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        api.downloadBlob(
                                          `/finance/fee-invoices/${inv.id}/overdue-notice.pdf`,
                                          `overdue-notice-${inv.student?.admissionNo ?? inv.id}.pdf`,
                                        )
                                      }
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      Notice
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => api.openBlob(`/finance/fee-invoices/${inv.id}/challan.pdf`)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Challan
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        api.downloadBlob(
                                          `/finance/fee-invoices/${inv.id}/challan.pdf`,
                                          `challan-${inv.student?.admissionNo ?? inv.id}-${inv.period}.pdf`,
                                        )
                                      }
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      Challan
                                    </Button>
                                  </>
                                )}
                                {!!inv.payments?.length && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => api.openBlob(`/finance/fee-payments/${inv.payments![0].id}/receipt.pdf`)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      View
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        api.downloadBlob(
                                          `/finance/fee-payments/${inv.payments![0].id}/receipt.pdf`,
                                          `receipt-${inv.payments![0].receiptNo}.pdf`,
                                        )
                                      }
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      Download
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Concessions tab */}
        <TabsContent value="concessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Find Student</CardTitle>
              <CardDescription>Search by name or admission number to view or add a concession</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <Input
                value={concStudentSearch}
                onChange={(e) => setConcStudentSearch(e.target.value)}
                placeholder="Search students..."
              />
              {studentsQuery.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
                  {filteredStudents.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No students found.</p>
                  ) : (
                    filteredStudents.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setConcStudentId(s.id)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          concStudentId === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                        }`}
                      >
                        <span className="font-medium text-foreground">{s.user.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.admissionNo}
                          {s.section ? ` · ${s.section.class?.name ?? ''} - ${s.section.name}` : ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Family Fee Statement</CardTitle>
              <CardDescription>Combined statement for all active siblings sharing one guardian phone number</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-2 pt-0">
              <Field label="Guardian phone">
                <Input
                  value={guardianPhoneSearch}
                  onChange={(e) => setGuardianPhoneSearch(e.target.value)}
                  placeholder="e.g. 0300-1234567"
                  className="w-48"
                />
              </Field>
              <Button
                variant="outline"
                size="sm"
                disabled={!guardianPhoneSearch}
                onClick={() => api.openBlob(`/finance/fee-invoices/family.pdf?${new URLSearchParams({ guardianPhone: guardianPhoneSearch }).toString()}`)}
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!guardianPhoneSearch}
                onClick={() =>
                  api.downloadBlob(
                    `/finance/fee-invoices/family.pdf?${new URLSearchParams({ guardianPhone: guardianPhoneSearch }).toString()}`,
                    'family-fee-statement.pdf',
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                api.openBlob(
                  `/finance/fee-concessions/report.pdf?${new URLSearchParams({
                    ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                  }).toString()}`,
                )
              }
            >
              <Eye className="h-3.5 w-3.5" />
              View Concession List
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                api.downloadBlob(
                  `/finance/fee-concessions/report.pdf?${new URLSearchParams({
                    ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
                  }).toString()}`,
                  'concession-list.pdf',
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              Download Concession List
            </Button>
          </div>

          {selectedConcStudent && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{selectedConcStudent.user.fullName}</CardTitle>
                    <CardDescription>{selectedConcStudent.admissionNo}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => api.openBlob(`/finance/fee-invoices/student/${selectedConcStudent.id}/ledger.pdf`)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Ledger
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        api.downloadBlob(
                          `/finance/fee-invoices/student/${selectedConcStudent.id}/ledger.pdf`,
                          `ledger-${selectedConcStudent.admissionNo}.pdf`,
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Ledger
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    Concessions — {selectedConcStudent.user.fullName}
                  </CardTitle>
                  <CardDescription>{selectedConcStudent.admissionNo}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {concessionsQuery.isLoading ? (
                    <div className="space-y-2 p-5"><Skeleton className="h-11 w-full" /></div>
                  ) : !concessionsQuery.data?.length ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No active concessions for this student.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fee Head</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Reason</TableHead>
                          {canManage && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {concessionsQuery.data.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium text-foreground">{c.feeHead?.name ?? 'All fee heads'}</TableCell>
                            <TableCell><Badge variant="secondary">{c.type === 'PERCENTAGE' ? 'Percentage' : 'Flat'}</Badge></TableCell>
                            <TableCell className="text-right tabular-nums">
                              {c.type === 'PERCENTAGE' ? `${c.value}%` : formatCurrency(c.value)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{c.reason ?? '—'}</TableCell>
                            {canManage && (
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeConcession.mutate(c.id)}
                                  loading={removeConcession.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove
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

              {canManage && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add Concession</CardTitle>
                    <CardDescription>e.g. sibling, staff, or merit discount</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <form onSubmit={submitConcession} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Fee Head">
                          <Select value={concFeeHeadId || '__all__'} onValueChange={(v) => setConcFeeHeadId(v === '__all__' ? '' : v)}>
                            <SelectTrigger><SelectValue placeholder="All fee heads" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">All fee heads</SelectItem>
                              {feeHeadsQuery.data?.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Type" required>
                          <Select value={concType} onValueChange={(v) => setConcType(v as 'PERCENTAGE' | 'FLAT')}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                              <SelectItem value="FLAT">Flat (PKR)</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label={concType === 'PERCENTAGE' ? 'Value (%)' : 'Value (PKR)'} required>
                          <Input
                            type="number"
                            min="0"
                            max={concType === 'PERCENTAGE' ? 100 : undefined}
                            step="0.01"
                            value={concValue}
                            onChange={(e) => setConcValue(e.target.value)}
                            required
                          />
                        </Field>
                        <Field label="Reason">
                          <Input value={concReason} onChange={(e) => setConcReason(e.target.value)} placeholder="e.g. Sibling discount" />
                        </Field>
                      </div>
                      {concError && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{concError}</div>}
                      <Button type="submit" loading={createConcession.isPending}>Add Concession</Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Add fee head dialog */}
      <Dialog open={headOpen} onOpenChange={setHeadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fee Head</DialogTitle>
            <DialogDescription>A fee category, e.g. Tuition Fee, Admission Fee, Transport Fee.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitHead} className="space-y-4">
            <Field label="Name" required>
              <Input value={headName} onChange={(e) => setHeadName(e.target.value)} placeholder="e.g. Tuition Fee" required />
            </Field>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={headMonthly} onChange={(e) => setHeadMonthly(e.target.checked)} className="h-4 w-4 rounded border-border" />
              Charged monthly (uncheck for one-time charges like Admission Fee)
            </label>
            {headError && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{headError}</div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHeadOpen(false)}>Cancel</Button>
              <Button type="submit" loading={createHead.isPending}>Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Fee Payment</DialogTitle>
            <DialogDescription>
              {payTarget?.student?.user.fullName} &middot; {payTarget?.period} &middot; Balance:{' '}
              {payTarget && formatCurrency(Math.max(Number(payTarget.totalAmount) - Number(payTarget.paidAmount), 0))}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPayment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (PKR)" required>
                <Input type="number" min="0.01" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
              </Field>
              <Field label="Date" required>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
              </Field>
            </div>
            <Field label="Method">
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="JazzCash">JazzCash</SelectItem>
                  <SelectItem value="EasyPaisa">EasyPaisa</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Online Transfer">Online Transfer</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {payError && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{payError}</div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayTarget(null)}>Cancel</Button>
              <Button type="submit" loading={recordPayment.isPending}>Record Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment success -> receipt download */}
      <Dialog open={!!lastPayment} onOpenChange={(open) => !open && setLastPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Recorded</DialogTitle>
            <DialogDescription>Receipt No: {lastPayment?.receiptNo}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLastPayment(null)}>Close</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => lastPayment && api.openBlob(`/finance/fee-payments/${lastPayment.id}/receipt.pdf`)}
            >
              <Eye className="h-4 w-4" />
              View
            </Button>
            <Button
              type="button"
              onClick={() =>
                lastPayment && api.downloadBlob(`/finance/fee-payments/${lastPayment.id}/receipt.pdf`, `receipt-${lastPayment.receiptNo}.pdf`)
              }
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
