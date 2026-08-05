import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, Plus, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import FeeManagementTab from '@/components/finance/FeeManagementTab';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { School, IncomeRecord, ExpenseRecord } from '@/types';

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

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

type MoneyForm = { schoolId: string; branchId: string; category: string; amount: string; date: string; description: string };
const EMPTY_MONEY: MoneyForm = { schoolId: '', branchId: '', category: '', amount: '', date: today(), description: '' };

export default function FinancePage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'ACCOUNTANT');
  const canDelete = hasRole('DIRECTOR', 'ADMIN');
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [filterSchoolId, setFilterSchoolId] = useState(isUnrestricted ? '' : user?.schoolId ?? '');

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools') });

  const incomeQuery = useQuery({
    queryKey: ['income', filterSchoolId, from, to],
    queryFn: () => api.get<IncomeRecord[]>('/income', { schoolId: filterSchoolId || undefined, from, to }),
  });
  const expenseQuery = useQuery({
    queryKey: ['expenses', filterSchoolId, from, to],
    queryFn: () => api.get<ExpenseRecord[]>('/expenses', { schoolId: filterSchoolId || undefined, from, to }),
  });

  const reportSchoolId = filterSchoolId || user?.schoolId || schoolsQuery.data?.[0]?.id || '';
  const reportQuery = useQuery({
    queryKey: ['finance-report', reportSchoolId, from, to],
    queryFn: () => api.get<any>('/finance/report', { schoolId: reportSchoolId, from, to }),
    enabled: !!reportSchoolId,
  });

  const branchesForSchool = (schoolId: string) => schoolsQuery.data?.find((s) => s.id === schoolId)?.branches ?? [];

  // ---- Income dialog ----
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeForm, setIncomeForm] = useState<MoneyForm>(EMPTY_MONEY);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const createIncome = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/income', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      setIncomeOpen(false);
      setIncomeForm(EMPTY_MONEY);
      setIncomeError(null);
    },
    onError: (err: unknown) => setIncomeError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deleteIncomeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/income/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      setDeleteIncomeTarget(null);
    },
  });
  const [deleteIncomeTarget, setDeleteIncomeTarget] = useState<IncomeRecord | null>(null);

  // ---- Expense dialog ----
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<MoneyForm>(EMPTY_MONEY);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const createExpense = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/expenses', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      setExpenseOpen(false);
      setExpenseForm(EMPTY_MONEY);
      setExpenseError(null);
    },
    onError: (err: unknown) => setExpenseError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      setDeleteExpenseTarget(null);
    },
  });
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<ExpenseRecord | null>(null);

  function openIncomeDialog() {
    setIncomeForm({ ...EMPTY_MONEY, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setIncomeError(null);
    setIncomeOpen(true);
  }
  function submitIncome(e: FormEvent) {
    e.preventDefault();
    setIncomeError(null);
    const effectiveSchoolId = isUnrestricted ? incomeForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !incomeForm.category || !incomeForm.amount || !incomeForm.date) {
      setIncomeError('Please fill all required fields.');
      return;
    }
    createIncome.mutate({
      schoolId: effectiveSchoolId,
      branchId: incomeForm.branchId || undefined,
      category: incomeForm.category,
      amount: Number(incomeForm.amount),
      date: incomeForm.date,
      description: incomeForm.description || undefined,
    });
  }

  function openExpenseDialog() {
    setExpenseForm({ ...EMPTY_MONEY, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setExpenseError(null);
    setExpenseOpen(true);
  }
  function submitExpense(e: FormEvent) {
    e.preventDefault();
    setExpenseError(null);
    const effectiveSchoolId = isUnrestricted ? expenseForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !expenseForm.category || !expenseForm.amount || !expenseForm.date) {
      setExpenseError('Please fill all required fields.');
      return;
    }
    createExpense.mutate({
      schoolId: effectiveSchoolId,
      branchId: expenseForm.branchId || undefined,
      category: expenseForm.category,
      amount: Number(expenseForm.amount),
      date: expenseForm.date,
      description: expenseForm.description || undefined,
    });
  }

  const totalIncome = useMemo(
    () => (incomeQuery.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0),
    [incomeQuery.data],
  );
  const totalExpense = useMemo(
    () => (expenseQuery.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0),
    [expenseQuery.data],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Finance</h2>
          <p className="mt-1 text-sm text-muted-foreground">Income, expenses and monthly reports</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
          {isUnrestricted && (
            <div className="space-y-1.5">
              <Label className="text-xs">School</Label>
              <Select value={filterSchoolId} onValueChange={setFilterSchoolId}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All schools" />
                </SelectTrigger>
                <SelectContent>
                  {(schoolsQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Income</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Expenses</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatCurrency(totalExpense)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Net Balance</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {formatCurrency(totalIncome - totalExpense)}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="fees">Student Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="income">
          <div className="mb-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                api.openBlob(
                  `/income/security-deposits.pdf?${new URLSearchParams({ ...(filterSchoolId ? { schoolId: filterSchoolId } : {}) }).toString()}`,
                )
              }
            >
              <Eye className="h-3.5 w-3.5" />
              View Security Deposits
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                api.downloadBlob(
                  `/income/security-deposits.pdf?${new URLSearchParams({ ...(filterSchoolId ? { schoolId: filterSchoolId } : {}) }).toString()}`,
                  'security-deposits.pdf',
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            {canManage && (
              <Button onClick={openIncomeDialog}>
                <Plus className="h-4 w-4" />
                Add Income
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {incomeQuery.isLoading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
                </div>
              ) : !incomeQuery.data?.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No income records in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeQuery.data.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">{formatDate(r.date)}</TableCell>
                        <TableCell className="font-medium text-foreground">{r.category}</TableCell>
                        <TableCell className="text-muted-foreground">{r.description || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums text-success">{formatCurrency(r.amount)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => api.openBlob(`/income/${r.id}/voucher.pdf`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => api.downloadBlob(`/income/${r.id}/voucher.pdf`, `income-voucher-${r.id}.pdf`)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            {canDelete && (
                              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteIncomeTarget(r)}>
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
        </TabsContent>

        <TabsContent value="expenses">
          <div className="mb-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                api.openBlob(
                  `/expenses/purchases.pdf?${new URLSearchParams({ ...(filterSchoolId ? { schoolId: filterSchoolId } : {}) }).toString()}`,
                )
              }
            >
              <Eye className="h-3.5 w-3.5" />
              View Purchases
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                api.downloadBlob(
                  `/expenses/purchases.pdf?${new URLSearchParams({ ...(filterSchoolId ? { schoolId: filterSchoolId } : {}) }).toString()}`,
                  'purchase-report.pdf',
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            {canManage && (
              <Button onClick={openExpenseDialog}>
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {expenseQuery.isLoading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
                </div>
              ) : !expenseQuery.data?.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No expense records in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseQuery.data.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">{formatDate(r.date)}</TableCell>
                        <TableCell className="font-medium text-foreground">{r.category}</TableCell>
                        <TableCell className="text-muted-foreground">{r.description || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">{formatCurrency(r.amount)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => api.openBlob(`/expenses/${r.id}/voucher.pdf`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => api.downloadBlob(`/expenses/${r.id}/voucher.pdf`, `expense-voucher-${r.id}.pdf`)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            {canDelete && (
                              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteExpenseTarget(r)}>
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
        </TabsContent>

        <TabsContent value="report">
          <div className="mb-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!reportSchoolId}
              onClick={() =>
                api.openBlob(
                  `/finance/report.pdf?${new URLSearchParams({ schoolId: reportSchoolId, from, to }).toString()}`,
                )
              }
            >
              <Eye className="h-3.5 w-3.5" />
              View Statement
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!reportSchoolId}
              onClick={() =>
                api.downloadBlob(
                  `/finance/report.pdf?${new URLSearchParams({ schoolId: reportSchoolId, from, to }).toString()}`,
                  `income-expense-statement-${from}-to-${to}.pdf`,
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              Download Statement
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!reportSchoolId}
              onClick={() =>
                api.openBlob(
                  `/finance/balance-sheet.pdf?${new URLSearchParams({ schoolId: reportSchoolId, asOfDate: to }).toString()}`,
                )
              }
            >
              <Eye className="h-3.5 w-3.5" />
              View Balance Sheet
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!reportSchoolId}
              onClick={() =>
                api.downloadBlob(
                  `/finance/balance-sheet.pdf?${new URLSearchParams({ schoolId: reportSchoolId, asOfDate: to }).toString()}`,
                  `balance-sheet-${to}.pdf`,
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              Download Balance Sheet
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Branch-wise breakdown</CardTitle>
              <CardDescription>
                {reportQuery.data?.schoolName ?? 'Select a school'} &middot; {formatDate(from)} &ndash; {formatDate(to)}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {reportQuery.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : !reportQuery.data ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No report data available.</p>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-success">Income by branch</h4>
                    {reportQuery.data.income.byBranch.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No income recorded.</p>
                    ) : (
                      reportQuery.data.income.byBranch.map((b: any) => (
                        <div key={b.branchId ?? 'none'} className="mb-3 rounded-lg border border-border p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{b.branchName}</span>
                            <span className="text-sm font-semibold tabular-nums text-success">{formatCurrency(b.total)}</span>
                          </div>
                          <div className="mt-1.5 space-y-0.5">
                            {b.byCategory.map((c: any) => (
                              <div key={c.category} className="flex justify-between text-xs text-muted-foreground">
                                <span>{c.category}</span>
                                <span className="tabular-nums">{formatCurrency(c.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-destructive">Expenses by branch</h4>
                    {reportQuery.data.expense.byBranch.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No expenses recorded.</p>
                    ) : (
                      reportQuery.data.expense.byBranch.map((b: any) => (
                        <div key={b.branchId ?? 'none'} className="mb-3 rounded-lg border border-border p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{b.branchName}</span>
                            <span className="text-sm font-semibold tabular-nums text-destructive">{formatCurrency(b.total)}</span>
                          </div>
                          <div className="mt-1.5 space-y-0.5">
                            {b.byCategory.map((c: any) => (
                              <div key={c.category} className="flex justify-between text-xs text-muted-foreground">
                                <span>{c.category}</span>
                                <span className="tabular-nums">{formatCurrency(c.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              {reportQuery.data && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-sm font-medium text-muted-foreground">Net Balance</span>
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    {formatCurrency(reportQuery.data.netBalance)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees">
          <FeeManagementTab effectiveSchoolId={reportSchoolId} />
        </TabsContent>
      </Tabs>

      {/* Income dialog */}
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Income</DialogTitle>
            <DialogDescription>Record money received under any category.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitIncome} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select value={incomeForm.schoolId} onValueChange={(v) => setIncomeForm((f) => ({ ...f, schoolId: v, branchId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                  <SelectContent>
                    {(schoolsQuery.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Branch">
              <Select value={incomeForm.branchId} onValueChange={(v) => setIncomeForm((f) => ({ ...f, branchId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select branch (optional)" /></SelectTrigger>
                <SelectContent>
                  {branchesForSchool(isUnrestricted ? incomeForm.schoolId : user?.schoolId ?? '').map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category" required>
              <Input value={incomeForm.category} onChange={(e) => setIncomeForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Tuition Fee" required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (PKR)" required>
                <Input type="number" min="0.01" step="0.01" value={incomeForm.amount} onChange={(e) => setIncomeForm((f) => ({ ...f, amount: e.target.value }))} required />
              </Field>
              <Field label="Date" required>
                <Input type="date" value={incomeForm.date} onChange={(e) => setIncomeForm((f) => ({ ...f, date: e.target.value }))} required />
              </Field>
            </div>
            <Field label="Description">
              <Input value={incomeForm.description} onChange={(e) => setIncomeForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            {incomeError && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{incomeError}</div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIncomeOpen(false)}>Cancel</Button>
              <Button type="submit" loading={createIncome.isPending}>Add Income</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Expense dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Record money spent under any category.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitExpense} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select value={expenseForm.schoolId} onValueChange={(v) => setExpenseForm((f) => ({ ...f, schoolId: v, branchId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                  <SelectContent>
                    {(schoolsQuery.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Branch">
              <Select value={expenseForm.branchId} onValueChange={(v) => setExpenseForm((f) => ({ ...f, branchId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select branch (optional)" /></SelectTrigger>
                <SelectContent>
                  {branchesForSchool(isUnrestricted ? expenseForm.schoolId : user?.schoolId ?? '').map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category" required>
              <Input value={expenseForm.category} onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Salaries" required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (PKR)" required>
                <Input type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))} required />
              </Field>
              <Field label="Date" required>
                <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))} required />
              </Field>
            </div>
            <Field label="Description">
              <Input value={expenseForm.description} onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            {expenseError && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{expenseError}</div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button>
              <Button type="submit" loading={createExpense.isPending}>Add Expense</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteIncomeTarget}
        onOpenChange={(open) => !open && setDeleteIncomeTarget(null)}
        title="Delete income record?"
        description={`This will permanently remove this ${deleteIncomeTarget?.category ?? ''} record of ${deleteIncomeTarget ? formatCurrency(deleteIncomeTarget.amount) : ''}.`}
        confirmLabel="Delete"
        loading={deleteIncomeMutation.isPending}
        onConfirm={() => deleteIncomeTarget && deleteIncomeMutation.mutate(deleteIncomeTarget.id)}
      />
      <ConfirmDialog
        open={!!deleteExpenseTarget}
        onOpenChange={(open) => !open && setDeleteExpenseTarget(null)}
        title="Delete expense record?"
        description={`This will permanently remove this ${deleteExpenseTarget?.category ?? ''} record of ${deleteExpenseTarget ? formatCurrency(deleteExpenseTarget.amount) : ''}.`}
        confirmLabel="Delete"
        loading={deleteExpenseMutation.isPending}
        onConfirm={() => deleteExpenseTarget && deleteExpenseMutation.mutate(deleteExpenseTarget.id)}
      />
    </div>
  );
}
