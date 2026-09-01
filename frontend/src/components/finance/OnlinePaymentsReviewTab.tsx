import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import type { OnlinePaymentAttempt } from '@/types';

const METHOD_LABEL: Record<string, string> = {
  JAZZCASH: 'JazzCash',
  EASYPAISA: 'EasyPaisa',
  BANK_TRANSFER: 'Bank Transfer',
  CARD: 'Card',
};

// Staff review queue for the proof-upload online payment flow (see
// PayOnlineDialog on the Parent Portal side) - approving here creates the
// real FeePayment/IncomeRecord via the existing fee-recording logic, exactly
// as if an Accountant had typed it in manually.
export default function OnlinePaymentsReviewTab({ effectiveSchoolId }: { effectiveSchoolId: string }) {
  const queryClient = useQueryClient();
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  const pendingQuery = useQuery({
    queryKey: ['online-payments', 'pending', effectiveSchoolId],
    queryFn: () => api.get<OnlinePaymentAttempt[]>('/online-payments/pending', { schoolId: effectiveSchoolId || undefined }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['online-payments'] });
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/online-payments/${id}/approve`),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/online-payments/${id}/reject`, { reviewNote: rejectNotes[id] || undefined }),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <CardContent className="p-0">
        {pendingQuery.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : !pendingQuery.data?.length ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <p className="text-sm font-medium text-foreground">No payment proofs waiting for review</p>
            <p className="text-sm text-muted-foreground">Submitted online payments will show up here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Proof</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingQuery.data.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">{p.invoice?.student?.user?.fullName ?? '—'}</span>
                    {p.proofNote && <p className="text-xs text-muted-foreground">{p.proofNote}</p>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.invoice?.period}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{METHOD_LABEL[p.method] ?? p.method}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">Rs. {Number(p.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => api.openBlob(`/online-payments/${p.id}/proof`)}>
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Input
                        placeholder="Reject reason"
                        className="h-8 w-32 text-xs"
                        value={rejectNotes[p.id] ?? ''}
                        onChange={(e) => setRejectNotes((r) => ({ ...r, [p.id]: e.target.value }))}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        loading={rejectMutation.isPending}
                        onClick={() => rejectMutation.mutate(p.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-success hover:bg-success/10"
                        loading={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(p.id)}
                      >
                        <Check className="h-4 w-4" />
                        Approve
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
  );
}
