import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, MessageSquare, Send } from 'lucide-react';
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import type { Suggestion, SuggestionStatus } from '@/types';

const REVIEW_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'] as const;

const STATUS_BADGE: Record<SuggestionStatus, 'secondary' | 'default' | 'warning' | 'success' | 'destructive'> = {
  NEW: 'secondary',
  REVIEWED: 'default',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  DISMISSED: 'destructive',
};

export default function SuggestionsPage() {
  const { hasRole } = useAuth();
  const canReview = hasRole(...REVIEW_ROLES);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Suggestions Box</h2>
        <p className="mt-1 text-sm text-muted-foreground">Share feedback with school management, anonymously if you prefer.</p>
      </div>

      <Tabs defaultValue="submit">
        <TabsList>
          <TabsTrigger value="submit">Submit & Track</TabsTrigger>
          {canReview && <TabsTrigger value="review">Review</TabsTrigger>}
        </TabsList>
        <TabsContent value="submit">
          <SubmitTab />
        </TabsContent>
        {canReview && (
          <TabsContent value="review">
            <ReviewTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function SubmitTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mineQuery = useQuery({
    queryKey: ['suggestions-mine'],
    queryFn: () => api.get<Suggestion[]>('/suggestions/mine'),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/suggestions', {
        schoolId: user?.schoolId,
        category: category || undefined,
        message,
        isAnonymous,
      }),
    onSuccess: () => {
      setMessage('');
      setCategory('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['suggestions-mine'] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 5) return setError('Please write a bit more detail.');
    mutation.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="mb-1.5 inline-block">Category (optional)</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Cafeteria, Transport, Academics" />
            </div>
            <div>
              <Label className="mb-1.5 inline-block">
                Your suggestion <span className="text-destructive">*</span>
              </Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
              Submit anonymously (management won't see your name)
            </label>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
            )}

            <Button type="submit" loading={mutation.isPending}>
              <Send className="h-4 w-4" />
              Submit
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-medium text-foreground">Your submissions</p>
          {mineQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !mineQuery.data?.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Lightbulb className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
            </div>
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {mineQuery.data.map((s) => (
                <div key={s.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground">{s.message}</p>
                    <Badge variant={STATUS_BADGE[s.status]}>{s.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.category ?? 'General'} · {formatDate(s.createdAt)}
                  </p>
                  {s.adminResponse && (
                    <div className="mt-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Management response: </span>
                      {s.adminResponse}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('__all__');
  const [respondTarget, setRespondTarget] = useState<Suggestion | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState<SuggestionStatus>('REVIEWED');

  const listQuery = useQuery({
    queryKey: ['suggestions', statusFilter],
    queryFn: () => api.get<Suggestion[]>('/suggestions', statusFilter !== '__all__' ? { status: statusFilter } : undefined),
  });

  const respondMutation = useMutation({
    mutationFn: () =>
      api.patch(`/suggestions/${respondTarget!.id}/respond`, {
        status: responseStatus,
        adminResponse: responseText || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      setRespondTarget(null);
      setResponseText('');
    },
  });

  function openRespond(s: Suggestion) {
    setRespondTarget(s);
    setResponseText(s.adminResponse ?? '');
    setResponseStatus(s.status === 'NEW' ? 'REVIEWED' : s.status);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="REVIEWED">Reviewed</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="DISMISSED">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !listQuery.data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No suggestions here yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {listQuery.data.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-foreground">{s.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.category ?? 'General'} · {formatDate(s.createdAt)} ·{' '}
                      {s.isAnonymous ? 'Anonymous' : s.submittedBy?.fullName ?? 'Unknown'}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[s.status]}>{s.status}</Badge>
                </div>
                {s.adminResponse && (
                  <div className="mt-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Response: </span>
                    {s.adminResponse}
                  </div>
                )}
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => openRespond(s)}>
                    Respond
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!respondTarget} onOpenChange={(open) => !open && setRespondTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to suggestion</DialogTitle>
            <DialogDescription>{respondTarget?.message}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 inline-block">Status</Label>
              <Select value={responseStatus} onValueChange={(v) => setResponseStatus(v as SuggestionStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REVIEWED">Reviewed</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="DISMISSED">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 inline-block">Response (optional)</Label>
              <Textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRespondTarget(null)}>
              Cancel
            </Button>
            <Button type="button" loading={respondMutation.isPending} onClick={() => respondMutation.mutate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
