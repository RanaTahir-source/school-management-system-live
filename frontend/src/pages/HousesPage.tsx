import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, Plus, Pencil, Trash2, Star, Search, UserMinus, UserPlus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { School, StaffUser, House, HouseDetail, StudentProfile } from '@/types';

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

function EmptyState({ icon: Icon, label }: { icon: typeof Trophy; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

type HouseForm = { schoolId: string; name: string; colorHex: string; inChargeId: string };
const EMPTY_HOUSE_FORM: HouseForm = { schoolId: '', name: '', colorHex: '#DC2626', inChargeId: '' };

type AwardForm = { points: string; reason: string; category: string };
const EMPTY_AWARD_FORM: AwardForm = { points: '10', reason: '', category: '' };

export default function HousesPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR');
  const canDelete = hasRole('DIRECTOR', 'ADMIN');
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HouseForm>(EMPTY_HOUSE_FORM);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<House | null>(null);

  const [awardOpen, setAwardOpen] = useState(false);
  const [awardHouseId, setAwardHouseId] = useState<string | null>(null);
  const [awardForm, setAwardForm] = useState<AwardForm>(EMPTY_AWARD_FORM);
  const [awardError, setAwardError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);

  const housesQuery = useQuery({ queryKey: ['houses'], queryFn: () => api.get<House[]>('/houses') });
  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools'), enabled: open && isUnrestricted });
  const staffQuery = useQuery({ queryKey: ['staff-users'], queryFn: () => api.get<StaffUser[]>('/users'), enabled: open });

  const staffOptions = useMemo(() => (staffQuery.data ?? []).map((s) => ({ id: s.id, label: s.fullName })), [staffQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/houses', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['houses'] });
      setOpen(false);
      setForm(EMPTY_HOUSE_FORM);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/houses/${editingId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['houses'] });
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY_HOUSE_FORM);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/houses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['houses'] });
      setDeleteTarget(null);
    },
  });
  const awardMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post(`/houses/${awardHouseId}/points`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['houses'] });
      queryClient.invalidateQueries({ queryKey: ['houses', 'detail', awardHouseId] });
      setAwardOpen(false);
      setAwardForm(EMPTY_AWARD_FORM);
      setAwardError(null);
    },
    onError: (err: unknown) => setAwardError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_HOUSE_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setError(null);
    setOpen(true);
  }
  function openEdit(h: House) {
    setEditingId(h.id);
    setForm({ schoolId: h.schoolId, name: h.name, colorHex: h.colorHex ?? '#DC2626', inChargeId: h.inChargeId ?? '' });
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
    const payload = { name: form.name, colorHex: form.colorHex || undefined, inChargeId: form.inChargeId || undefined };
    if (editingId) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate({ ...payload, schoolId: effectiveSchoolId });
    }
  }

  function openAward(houseId: string) {
    setAwardHouseId(houseId);
    setAwardForm(EMPTY_AWARD_FORM);
    setAwardError(null);
    setAwardOpen(true);
  }
  function submitAward(e: FormEvent) {
    e.preventDefault();
    setAwardError(null);
    const points = Number(awardForm.points);
    if (!points || !awardForm.reason.trim()) {
      setAwardError('Please enter points and a reason.');
      return;
    }
    awardMutation.mutate({ points, reason: awardForm.reason, category: awardForm.category || undefined });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Houses</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sports/discipline teams and the points leaderboard - independent of academic sections.</p>
        </div>
        {canManage && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add House
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {housesQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !housesQuery.data?.length ? (
            <EmptyState icon={Trophy} label="No houses yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>House</TableHead>
                  <TableHead>In-charge</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {housesQuery.data.map((h, i) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      <button className="flex items-center gap-2 text-left" onClick={() => setDetailId(h.id)}>
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: h.colorHex ?? '#94a3b8' }} />
                        <span className="font-medium text-foreground underline-offset-2 hover:underline">
                          {i === 0 ? '🏆 ' : ''}
                          {h.name}
                        </span>
                        {!h.isActive && <Badge variant="secondary">Inactive</Badge>}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{h.inCharge?.fullName ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{h._count?.students ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={i === 0 ? 'success' : 'secondary'}>{h.totalPoints} pts</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canManage && (
                          <Button variant="ghost" size="sm" onClick={() => openAward(h.id)}>
                            <Star className="h-4 w-4" />
                            Points
                          </Button>
                        )}
                        {canManage && (
                          <Button variant="ghost" size="sm" onClick={() => openEdit(h)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(h)}
                          >
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

      {/* Add/edit house dialog */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit House' : 'Add House'}</DialogTitle>
            <DialogDescription>A House is a sports/discipline team students stay in across years, separate from their academic section.</DialogDescription>
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
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Red House" required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Color">
                <Input type="color" className="h-10 w-full p-1" value={form.colorHex} onChange={(e) => setForm((f) => ({ ...f, colorHex: e.target.value }))} />
              </Field>
              <Field label="In-charge (optional)">
                <Select value={form.inChargeId || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, inChargeId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {staffOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
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
                {editingId ? 'Save Changes' : 'Add House'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Award/deduct points dialog */}
      <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Award / Deduct Points</DialogTitle>
            <DialogDescription>Use a negative number to deduct points.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAward} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Points" required>
                <Input type="number" value={awardForm.points} onChange={(e) => setAwardForm((f) => ({ ...f, points: e.target.value }))} required />
              </Field>
              <Field label="Category (optional)">
                <Input
                  placeholder="Sports, Discipline, Event..."
                  value={awardForm.category}
                  onChange={(e) => setAwardForm((f) => ({ ...f, category: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Reason" required>
              <Input
                value={awardForm.reason}
                onChange={(e) => setAwardForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Sports Day relay win"
                required
              />
            </Field>
            {awardError && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{awardError}</div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAwardOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={awardMutation.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <HouseDetailDialog houseId={detailId} onClose={() => setDetailId(null)} canManage={canManage} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this house?"
        description={`"${deleteTarget?.name ?? ''}" will be removed and its students unassigned. Point history is kept.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

// ─────────────────────────── House detail: roster + point history ───────────────────────────
function HouseDetailDialog({ houseId, onClose, canManage }: { houseId: string | null; onClose: () => void; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const detailQuery = useQuery({
    queryKey: ['houses', 'detail', houseId],
    queryFn: () => api.get<HouseDetail>(`/houses/${houseId}`),
    enabled: !!houseId,
  });
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => api.get<StudentProfile[]>('/students'),
    enabled: !!houseId && canManage,
  });

  const assignMutation = useMutation({
    mutationFn: ({ studentId, targetHouseId }: { studentId: string; targetHouseId: string | null }) =>
      api.patch(`/houses/students/${studentId}`, { houseId: targetHouseId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['houses'] });
      queryClient.invalidateQueries({ queryKey: ['houses', 'detail', houseId] });
    },
  });

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const currentRosterIds = new Set((detailQuery.data?.students ?? []).map((s) => s.id));
    return (studentsQuery.data ?? [])
      .filter((s) => !currentRosterIds.has(s.id) && (s.user.fullName.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [search, studentsQuery.data, detailQuery.data]);

  return (
    <Dialog open={!!houseId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: detailQuery.data?.colorHex ?? '#94a3b8' }} />
            {detailQuery.data?.name ?? 'House'}
          </DialogTitle>
          <DialogDescription>{detailQuery.data?.totalPoints ?? 0} total points</DialogDescription>
        </DialogHeader>

        {!detailQuery.data ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {canManage && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search a student to add to this house" value={search} onChange={(e) => setSearch(e.target.value)} />
                {matches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-md">
                    {matches.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
                        onClick={() => {
                          assignMutation.mutate({ studentId: s.id, targetHouseId: houseId });
                          setSearch('');
                        }}
                      >
                        <span className="font-medium text-foreground">{s.user.fullName}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <UserPlus className="h-3.5 w-3.5" />
                          {s.admissionNo}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Roster ({detailQuery.data.students.length})</h4>
              {detailQuery.data.students.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students assigned yet.</p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {detailQuery.data.students.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                      <span className="text-foreground">
                        {s.user.fullName} <span className="text-xs text-muted-foreground">({s.admissionNo})</span>
                      </span>
                      {canManage && (
                        <Button variant="ghost" size="sm" onClick={() => assignMutation.mutate({ studentId: s.id, targetHouseId: null })}>
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Recent points</h4>
              {detailQuery.data.pointEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No points logged yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reason</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailQuery.data.pointEntries.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-foreground">{p.reason}</TableCell>
                        <TableCell className="text-muted-foreground">{p.category ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.awardedBy?.fullName ?? '—'}</TableCell>
                        <TableCell className={`text-right font-medium ${p.points >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                          {p.points >= 0 ? `+${p.points}` : p.points}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
