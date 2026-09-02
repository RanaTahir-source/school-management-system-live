import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
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
import type { School, AccountHead, AccountType, LedgerSummaryReport } from '@/types';

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

function EmptyState({ icon: Icon, label }: { icon: typeof Landmark; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

const ACCOUNT_TYPES: AccountType[] = ['INCOME', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'];
const TYPE_VARIANT: Record<AccountType, 'success' | 'destructive' | 'secondary' | 'warning'> = {
  INCOME: 'success',
  EXPENSE: 'destructive',
  ASSET: 'secondary',
  LIABILITY: 'warning',
  EQUITY: 'secondary',
};

export default function ChartOfAccountsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Chart of Accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Formal account heads you can tag income/expense entries against, plus a ledger summary report.
        </p>
      </div>

      <Tabs defaultValue="heads">
        <TabsList>
          <TabsTrigger value="heads">Account Heads</TabsTrigger>
          <TabsTrigger value="ledger">Ledger Summary</TabsTrigger>
        </TabsList>
        <TabsContent value="heads">
          <AccountHeadsTab />
        </TabsContent>
        <TabsContent value="ledger">
          <LedgerSummaryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type HeadForm = { schoolId: string; name: string; code: string; type: AccountType; parentId: string };
const EMPTY_HEAD_FORM: HeadForm = { schoolId: '', name: '', code: '', type: 'INCOME', parentId: '' };

function AccountHeadsTab() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'ACCOUNTANT');
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HeadForm>(EMPTY_HEAD_FORM);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountHead | null>(null);

  const headsQuery = useQuery({ queryKey: ['account-heads'], queryFn: () => api.get<AccountHead[]>('/accounts') });
  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools'), enabled: open && isUnrestricted });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/accounts', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-heads'] });
      setOpen(false);
      setForm(EMPTY_HEAD_FORM);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/accounts/${editingId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-heads'] });
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY_HEAD_FORM);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-heads'] });
      setDeleteTarget(null);
    },
    onError: (err: unknown) => window.alert(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_HEAD_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setError(null);
    setOpen(true);
  }
  function openEdit(h: AccountHead) {
    setEditingId(h.id);
    setForm({ schoolId: h.schoolId, name: h.name, code: h.code ?? '', type: h.type, parentId: h.parentId ?? '' });
    setError(null);
    setOpen(true);
  }
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !form.name.trim()) {
      setError('Please fill all required fields.');
      return;
    }
    const payload = { name: form.name, code: form.code || undefined, type: form.type, parentId: form.parentId || undefined };
    if (editingId) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate({ ...payload, schoolId: effectiveSchoolId });
    }
  }

  const parentOptions = (headsQuery.data ?? []).filter((h) => h.id !== editingId);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Account Head
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {headsQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !headsQuery.data?.length ? (
            <EmptyState icon={Landmark} label="No account heads yet - your existing free-text categories still work fine without these" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Entries tagged</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {headsQuery.data.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium text-foreground">{h.name}</TableCell>
                    <TableCell className="text-muted-foreground">{h.code ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={TYPE_VARIANT[h.type]}>{h.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{h.parent?.name ?? '—'}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {(h._count?.incomeRecords ?? 0) + (h._count?.expenseRecords ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={h.isActive ? 'success' : 'secondary'}>{h.isActive ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(h)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(h)}
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

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Account Head' : 'Add Account Head'}</DialogTitle>
            <DialogDescription>Optional formal ledger tag - your existing free-text categories keep working either way.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select value={form.schoolId} onValueChange={(v) => setForm((f) => ({ ...f, schoolId: v }))} disabled={!!editingId}>
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" required>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Tuition Fee" required />
              </Field>
              <Field label="Code (optional)">
                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. 4001" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type" required>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as AccountType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Parent (optional)">
                <Select value={form.parentId || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, parentId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Top-level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Top-level</SelectItem>
                    {parentOptions.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {error && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {editingId ? 'Save Changes' : 'Add Account Head'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this account head?"
        description={`"${deleteTarget?.name ?? ''}" will be removed. This is blocked if it still has sub-heads or tagged entries.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function LedgerSummaryTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const reportQuery = useQuery({
    queryKey: ['accounts', 'ledger-summary', from, to],
    queryFn: () => api.get<LedgerSummaryReport>('/accounts/ledger-summary', { from: from || undefined, to: to || undefined }),
  });
  const data = reportQuery.data;

  const rows = useMemo(() => {
    if (!data) return [];
    return [...data.accountHeads].sort((a, b) => b.incomeTotal + b.expenseTotal - (a.incomeTotal + a.expenseTotal));
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end">
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Button variant="outline" onClick={() => reportQuery.refetch()} disabled={reportQuery.isFetching}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {data && (
          <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
            <div className="rounded-lg border border-emerald-300/50 bg-emerald-50 p-3">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" /> Total income
              </p>
              <p className="text-lg font-semibold text-emerald-700">Rs. {data.totalIncome.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingDown className="h-3.5 w-3.5" /> Total expense
              </p>
              <p className="text-lg font-semibold text-destructive">Rs. {data.totalExpense.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Net</p>
              <p className="text-lg font-semibold text-foreground">Rs. {data.net.toLocaleString()}</p>
            </div>
          </div>
        )}

        {reportQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : !data?.accountHeads.length ? (
          <EmptyState icon={Landmark} label="No account heads set up yet - add some in the Account Heads tab to see them here" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Head</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Income</TableHead>
                <TableHead>Expense</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium text-foreground">
                    {h.code ? `${h.code} · ` : ''}
                    {h.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANT[h.type]}>{h.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{h.incomeTotal > 0 ? `Rs. ${h.incomeTotal.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{h.expenseTotal > 0 ? `Rs. ${h.expenseTotal.toLocaleString()}` : '—'}</TableCell>
                </TableRow>
              ))}
              {(data.unassignedIncome > 0 || data.unassignedExpense > 0) && (
                <TableRow>
                  <TableCell className="italic text-muted-foreground">Untagged (free-text category only)</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="text-muted-foreground">{data.unassignedIncome > 0 ? `Rs. ${data.unassignedIncome.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{data.unassignedExpense > 0 ? `Rs. ${data.unassignedExpense.toLocaleString()}` : '—'}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
