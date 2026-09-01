import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { FeeInvoice, InitiateOnlinePaymentResponse, OnlinePaymentMethod } from '@/types';

const METHOD_LABEL: Record<OnlinePaymentMethod, string> = {
  JAZZCASH: 'JazzCash',
  EASYPAISA: 'EasyPaisa',
  BANK_TRANSFER: 'Bank Transfer',
  CARD: 'Card (coming soon)',
};

// Two-step flow: (1) parent picks a method and amount, we create a PENDING
// attempt and show them exactly where to send the money (from
// SchoolSetting); (2) parent uploads a screenshot/receipt as proof, which
// goes to SUBMITTED and waits for an Accountant/Director to approve it.
// No card gateway yet - see OnlinePaymentsService.initiate() for why.
export function PayOnlineDialog({
  invoice,
  open,
  onOpenChange,
  onSubmitted,
}: {
  invoice: FeeInvoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const remaining = Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount));

  const [method, setMethod] = useState<OnlinePaymentMethod>('JAZZCASH');
  const [amount, setAmount] = useState(String(remaining));
  const [initiated, setInitiated] = useState<InitiateOnlinePaymentResponse | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initiateMutation = useMutation({
    mutationFn: () =>
      api.post<InitiateOnlinePaymentResponse>('/online-payments/initiate', {
        invoiceId: invoice.id,
        method,
        amount: Number(amount),
      }),
    onSuccess: (data) => {
      setInitiated(data);
      setError(null);
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  const submitProofMutation = useMutation({
    mutationFn: () => {
      const file = fileInputRef.current?.files?.[0];
      if (!file) throw new Error('Please attach a screenshot or photo of the payment receipt.');
      const formData = new FormData();
      formData.append('file', file);
      if (proofNote) formData.append('proofNote', proofNote);
      return api.upload(`/online-payments/${initiated!.attempt.id}/proof`, formData);
    },
    onSuccess: () => {
      onSubmitted();
      reset();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : (err as Error).message);
    },
  });

  function reset() {
    setMethod('JAZZCASH');
    setAmount(String(remaining));
    setInitiated(null);
    setProofNote('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay Fee Online - {invoice.period}</DialogTitle>
          <DialogDescription>Remaining balance: Rs. {remaining.toLocaleString()}</DialogDescription>
        </DialogHeader>

        {!initiated ? (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 inline-block">Payment method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as OnlinePaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JAZZCASH">JazzCash</SelectItem>
                  <SelectItem value="EASYPAISA">EasyPaisa</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 inline-block">Amount (Rs.)</Label>
              <Input type="number" min={1} max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" loading={initiateMutation.isPending} onClick={() => initiateMutation.mutate()}>
                Continue
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">
                Send Rs. {Number(initiated.attempt.amount).toLocaleString()} via {METHOD_LABEL[method]} to:
              </p>
              <div className="mt-2 space-y-1 text-muted-foreground">
                {method === 'JAZZCASH' && <p>JazzCash number: {initiated.payTo.jazzCashNumber ?? 'Not set - contact school office'}</p>}
                {method === 'EASYPAISA' && <p>EasyPaisa number: {initiated.payTo.easyPaisaNumber ?? 'Not set - contact school office'}</p>}
                {method === 'BANK_TRANSFER' && (
                  <>
                    <p>Bank: {initiated.payTo.bankName ?? '—'}</p>
                    <p>Account title: {initiated.payTo.bankAccountTitle ?? '—'}</p>
                    <p>Account number: {initiated.payTo.bankAccountNumber ?? '—'}</p>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                After sending the money, upload a screenshot or photo of the receipt below. The school will verify and
                confirm your payment.
              </p>
            </div>

            <div>
              <Label className="mb-1.5 inline-block">
                Payment receipt/screenshot <span className="text-destructive">*</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>
            <div>
              <Label className="mb-1.5 inline-block">Note (optional)</Label>
              <Textarea
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                placeholder="e.g. Transaction ref #123"
                rows={2}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" loading={submitProofMutation.isPending} onClick={() => submitProofMutation.mutate()}>
                <Upload className="h-4 w-4" />
                Submit Proof
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

