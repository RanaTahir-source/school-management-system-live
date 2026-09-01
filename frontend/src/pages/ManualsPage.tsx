import { FormEvent, Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { ManualCategory, ManualDocument } from '@/types';

const MANAGE_ROLES = ['CHAIRMAN', 'DIRECTOR', 'ADMIN', 'PRINCIPAL'] as const;

const CATEGORY_LABEL: Record<ManualCategory, string> = {
  ACADEMIC: 'Academic',
  ADMINISTRATION: 'Administration',
  HUMAN_RESOURCE: 'Human Resource',
  FINANCE: 'Finance',
  HEALTH_SAFETY: 'Health & Safety',
  USER_MANUAL: 'User Manuals (ERP)',
  CUSTOM: 'Custom',
};

const CATEGORIES: ManualCategory[] = ['ACADEMIC', 'ADMINISTRATION', 'HUMAN_RESOURCE', 'FINANCE', 'HEALTH_SAFETY', 'USER_MANUAL', 'CUSTOM'];

// Small dependency-free renderer for the limited markdown subset used in our
// manual content (## headings, numbered/bulleted lists, paragraphs) - avoids
// pulling in a markdown library just for this.
function ManualContent({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter(Boolean);
        if (lines.length === 0) return null;
        if (lines[0].startsWith('## ')) {
          return (
            <div key={i}>
              <h4 className="text-sm font-semibold text-foreground">{lines[0].replace(/^##\s+/, '')}</h4>
              {lines.slice(1).length > 0 && <ManualContentLines lines={lines.slice(1)} />}
            </div>
          );
        }
        return <ManualContentLines key={i} lines={lines} />;
      })}
    </div>
  );
}

function ManualContentLines({ lines }: { lines: string[] }) {
  const isOrderedList = lines.every((l) => /^\d+\.\s/.test(l));
  if (isOrderedList) {
    return (
      <ol className="ml-5 list-decimal space-y-1 text-sm text-muted-foreground">
        {lines.map((l, i) => (
          <li key={i}>{l.replace(/^\d+\.\s/, '')}</li>
        ))}
      </ol>
    );
  }
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 inline-block">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

export default function ManualsPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isManager = hasRole(...MANAGE_ROLES);

  const [categoryFilter, setCategoryFilter] = useState<string>('__all__');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManualDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManualDocument | null>(null);

  const listQuery = useQuery({
    queryKey: ['manuals', categoryFilter, search],
    queryFn: () =>
      api.get<ManualDocument[]>('/manuals', {
        ...(categoryFilter !== '__all__' ? { category: categoryFilter } : {}),
        ...(search ? { search } : {}),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/manuals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manuals'] });
      setDeleteTarget(null);
      setSelectedId(null);
    },
  });

  const selected = useMemo(() => listQuery.data?.find((m) => m.id === selectedId) ?? null, [listQuery.data, selectedId]);
  const canManageSelected = !!selected && (selected.schoolId != null || hasRole('CHAIRMAN'));

  const grouped = useMemo(() => {
    const map = new Map<ManualCategory, ManualDocument[]>();
    for (const m of listQuery.data ?? []) {
      const list = map.get(m.category) ?? [];
      list.push(m);
      map.set(m.category, list);
    }
    return map;
  }, [listQuery.data]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">SOPs & Manuals Library</h2>
          <p className="mt-1 text-sm text-muted-foreground">Bundled operating procedures plus your school's own custom manuals.</p>
        </div>
        {isManager && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Custom Manual
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search manuals..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="max-h-[70vh] overflow-y-auto p-0">
            {listQuery.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !listQuery.data?.length ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No manuals found.</p>
              </div>
            ) : (
              Array.from(grouped.entries()).map(([category, manuals]) => (
                <Fragment key={category}>
                  <p className="sticky top-0 bg-muted/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABEL[category]}
                  </p>
                  {manuals.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`block w-full border-b border-border/60 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 ${
                        selectedId === m.id ? 'bg-muted/70' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{m.title}</p>
                        {!m.isPublished && <Badge variant="warning">Draft</Badge>}
                        {m.schoolId == null && <Badge variant="secondary">Bundled</Badge>}
                      </div>
                      {m.summary && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{m.summary}</p>}
                    </button>
                  ))}
                </Fragment>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="max-h-[70vh] overflow-y-auto p-5">
            {!selected ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Select a manual from the list to read it.</p>
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{selected.title}</h3>
                    {selected.summary && <p className="mt-0.5 text-sm text-muted-foreground">{selected.summary}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="secondary">{CATEGORY_LABEL[selected.category]}</Badge>
                    {!selected.isPublished && <Badge variant="warning">Draft</Badge>}
                  </div>
                </div>
                <ManualContent content={selected.content} />
                {isManager && canManageSelected && (
                  <div className="mt-5 flex gap-2 border-t border-border pt-4">
                    <Button variant="outline" size="sm" onClick={() => setEditTarget(selected)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(selected)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {createOpen && (
        <ManualFormDialog
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['manuals'] })}
        />
      )}

      {editTarget && (
        <ManualFormDialog
          mode="edit"
          manual={editTarget}
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['manuals'] })}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this manual?"
        description={`This will remove "${deleteTarget?.title}" from the library.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function ManualFormDialog({
  mode,
  manual,
  open,
  onOpenChange,
  onSaved,
}: {
  mode: 'create' | 'edit';
  manual?: ManualDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [category, setCategory] = useState<ManualCategory>(manual?.category ?? 'CUSTOM');
  const [title, setTitle] = useState(manual?.title ?? '');
  const [summary, setSummary] = useState(manual?.summary ?? '');
  const [content, setContent] = useState(manual?.content ?? '');
  const [isPublished, setIsPublished] = useState(manual?.isPublished ?? true);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'create'
        ? api.post('/manuals', { schoolId: user?.schoolId, category, title, summary: summary || undefined, content, isPublished })
        : api.patch(`/manuals/${manual!.id}`, { category, title, summary: summary || undefined, content, isPublished }),
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !content.trim()) return setError('Please provide a title and content.');
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Custom Manual' : 'Edit Manual'}</DialogTitle>
          <DialogDescription>Your own school-specific SOP, shown alongside the bundled library.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </Field>
            <Field label="Category">
              <Select value={category} onValueChange={(v) => setCategory(v as ManualCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Summary">
            <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One line describing this manual" />
          </Field>
          <Field label="Content" required>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder={'## Purpose\n...\n\n## Procedure\n1. ...'}
              required
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            Published (visible to everyone at your school)
          </label>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
