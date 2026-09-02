import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pencil, Plus, Search, Trash2, UserPlus, UserCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { formatDate } from '@/lib/utils';
import type {
  AdmissionEnquiry,
  AdmissionSource,
  AdmissionStatus,
  AdmissionSummary,
  School,
  ClassRecord,
  SectionRecord,
} from '@/types';

const STATUS_OPTIONS: AdmissionStatus[] = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'TRIAL_SCHEDULED', 'ADMITTED', 'REJECTED', 'LOST'];
const SOURCE_OPTIONS: AdmissionSource[] = ['WALK_IN', 'PHONE', 'REFERRAL', 'SOCIAL_MEDIA', 'WEBSITE', 'ADVERTISEMENT', 'OTHER'];

const STATUS_LABEL: Record<AdmissionStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  FOLLOW_UP: 'Follow-up',
  TRIAL_SCHEDULED: 'Trial Scheduled',
  ADMITTED: 'Admitted',
  REJECTED: 'Rejected',
  LOST: 'Lost',
};

const SOURCE_LABEL: Record<AdmissionSource, string> = {
  WALK_IN: 'Walk-in',
  PHONE: 'Phone',
  REFERRAL: 'Referral',
  SOCIAL_MEDIA: 'Social Media',
  WEBSITE: 'Website',
  ADVERTISEMENT: 'Advertisement',
  OTHER: 'Other',
};

const STATUS_BADGE: Record<AdmissionStatus, 'default' | 'outline' | 'warning' | 'success' | 'destructive' | 'secondary'> = {
  NEW: 'default',
  CONTACTED: 'outline',
  FOLLOW_UP: 'warning',
  TRIAL_SCHEDULED: 'warning',
  ADMITTED: 'success',
  REJECTED: 'destructive',
  LOST: 'secondary',
};

type EnquiryForm = {
  schoolId: string;
  branchId: string;
  childName: string;
  desiredClassName: string;
  parentName: string;
  phone: string;
  email: string;
  address: string;
  source: AdmissionSource;
  notes: string;
};

const EMPTY_ENQUIRY_FORM: EnquiryForm = {
  schoolId: '',
  branchId: '',
  childName: '',
  desiredClassName: '',
  parentName: '',
  phone: '',
  email: '',
  address: '',
  source: 'WALK_IN',
  notes: '',
};

export default function AdmissionsPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<EnquiryForm>(EMPTY_ENQUIRY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingEnquiryId, setEditingEnquiryId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [convertTarget, setConvertTarget] = useState<AdmissionEnquiry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdmissionEnquiry | null>(null);

  const enquiriesQuery = useQuery({
    queryKey: ['admission-enquiries', statusFilter, sourceFilter],
    queryFn: () =>
      api.get<AdmissionEnquiry[]>('/admissions/enquiries', {
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
      }),
  });

  const summaryQuery = useQuery({
    queryKey: ['admission-enquiries', 'summary'],
    queryFn: () => api.get<AdmissionSummary>('/admissions/enquiries/summary'),
  });

  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
    enabled: createOpen || !!convertTarget,
  });

  const filtered = useMemo(() => {
    const list = enquiriesQuery.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (e) => e.childName.toLowerCase().includes(q) || e.parentName.toLowerCase().includes(q) || e.phone.includes(q),
    );
  }, [enquiriesQuery.data, search]);

  const detail = useMemo(() => enquiriesQuery.data?.find((e) => e.id === detailId) ?? null, [enquiriesQuery.data, detailId]);

  const schoolBranches = useMemo(() => {
    const school = schoolsQuery.data?.find((s) => s.id === (isUnrestricted ? form.schoolId : user?.schoolId));
    return school?.branches ?? [];
  }, [schoolsQuery.data, form.schoolId, isUnrestricted, user?.schoolId]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['admission-enquiries'] });
  }

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/admissions/enquiries', payload),
    onSuccess: () => {
      invalidateAll();
      setCreateOpen(false);
      setForm(EMPTY_ENQUIRY_FORM);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  const updateEnquiryMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/admissions/enquiries/${editingEnquiryId}`, payload),
    onSuccess: () => {
      invalidateAll();
      setCreateOpen(false);
      setEditingEnquiryId(null);
      setForm(EMPTY_ENQUIRY_FORM);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  const deleteEnquiryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admissions/enquiries/${id}`),
    onSuccess: () => {
      invalidateAll();
      setDeleteTarget(null);
      setDetailId((current) => (current === deleteTarget?.id ? null : current));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdmissionStatus }) =>
      api.patch(`/admissions/enquiries/${id}`, { status }),
    onSuccess: invalidateAll,
  });

  const assignToMeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admissions/enquiries/${id}`, { assignedToId: user?.userId }),
    onSuccess: invalidateAll,
  });

  const followUpMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/admissions/enquiries/${id}/follow-ups`, {
        note: followUpNote,
        nextFollowUpDate: followUpDate || undefined,
      }),
    onSuccess: () => {
      invalidateAll();
      setFollowUpNote('');
      setFollowUpDate('');
    },
  });

  function openCreate() {
    setEditingEnquiryId(null);
    setForm({ ...EMPTY_ENQUIRY_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setFormError(null);
    setCreateOpen(true);
  }

  function openEditEnquiryDialog(e: AdmissionEnquiry) {
    setEditingEnquiryId(e.id);
    setForm({
      schoolId: e.schoolId,
      branchId: e.branchId ?? '',
      childName: e.childName,
      desiredClassName: e.desiredClassName ?? '',
      parentName: e.parentName,
      phone: e.phone,
      email: e.email ?? '',
      address: e.address ?? '',
      source: e.source,
      notes: e.notes ?? '',
    });
    setFormError(null);
    setCreateOpen(true);
  }

  function submitEnquiry(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (editingEnquiryId) {
      if (!form.childName || !form.parentName || !form.phone) return setFormError('Please fill all required fields.');
      updateEnquiryMutation.mutate({
        branchId: form.branchId || undefined,
        childName: form.childName,
        desiredClassName: form.desiredClassName || undefined,
        parentName: form.parentName,
        phone: form.phone,
        email: form.email || undefined,
        address: form.address || undefined,
        source: form.source,
        notes: form.notes || undefined,
      });
      return;
    }

    const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId;
    if (!effectiveSchoolId) return setFormError('Please select a school.');
    if (!form.childName || !form.parentName || !form.phone) return setFormError('Please fill all required fields.');

    createMutation.mutate({
      schoolId: effectiveSchoolId,
      branchId: form.branchId || undefined,
      childName: form.childName,
      desiredClassName: form.desiredClassName || undefined,
      parentName: form.parentName,
      phone: form.phone,
      email: form.email || undefined,
      address: form.address || undefined,
      source: form.source,
      notes: form.notes || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Admissions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {summaryQuery.data?.total ?? 0} enquir{summaryQuery.data?.total === 1 ? 'y' : 'ies'} in the pipeline
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Enquiry
        </Button>
      </div>

      {summaryQuery.data && (
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => {
            const count = summaryQuery.data!.byStatus.find((r) => r.status === s)?.count ?? 0;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                className="focus:outline-none"
              >
                <Badge variant={statusFilter === s ? STATUS_BADGE[s] : 'outline'}>
                  {STATUS_LABEL[s]}: {count}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by child, parent, or phone..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sourceFilter || 'ALL'} onValueChange={(v) => setSourceFilter(v === 'ALL' ? '' : v)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sources</SelectItem>
            {SOURCE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {SOURCE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {enquiriesQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UserPlus className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No enquiries found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search || statusFilter || sourceFilter ? 'Try different filters.' : 'Log your first admission enquiry to get started.'}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead>Parent / Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Follow-up</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{e.childName}</span>
                      {e.desiredClassName && <p className="text-xs text-muted-foreground">{e.desiredClassName}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.parentName}
                      <p className="text-xs">{e.phone}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{SOURCE_LABEL[e.source]}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.nextFollowUpDate ? formatDate(e.nextFollowUpDate) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.assignedTo?.fullName ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(e.id)}>
                          View
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditEnquiryDialog(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isUnrestricted && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(e)}
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

      {/* Create / edit enquiry dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditingEnquiryId(null);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editingEnquiryId ? 'Edit Enquiry' : 'New Admission Enquiry'}</DialogTitle>
            <DialogDescription>
              {editingEnquiryId
                ? "Correct this enquiry's child, parent, or contact details."
                : 'Log a walk-in visitor, phone call, or referral before they become a student.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitEnquiry} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Child's name" required>
                <Input value={form.childName} onChange={(e) => setForm((f) => ({ ...f, childName: e.target.value }))} required />
              </Field>
              <Field label="Desired class">
                <Input
                  value={form.desiredClassName}
                  onChange={(e) => setForm((f) => ({ ...f, desiredClassName: e.target.value }))}
                  placeholder="e.g. Class 3"
                />
              </Field>
              <Field label="Parent/guardian name" required>
                <Input value={form.parentName} onChange={(e) => setForm((f) => ({ ...f, parentName: e.target.value }))} required />
              </Field>
              <Field label="Phone" required>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="Source">
                <Select value={form.source} onValueChange={(v) => setForm((f) => ({ ...f, source: v as AdmissionSource }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SOURCE_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {isUnrestricted && (
                <Field label="School" required>
                  <Select
                    value={form.schoolId}
                    onValueChange={(v) => setForm((f) => ({ ...f, schoolId: v, branchId: '' }))}
                    disabled={!!editingEnquiryId}
                  >
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
              <Field label="Branch">
                <Select value={form.branchId} onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))} disabled={!schoolBranches.length}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
              </Field>
            </div>

            {formError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setEditingEnquiryId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingEnquiryId ? updateEnquiryMutation.isPending : createMutation.isPending}>
                {editingEnquiryId ? 'Save Changes' : 'Log Enquiry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete enquiry?"
        description={`This will remove the enquiry for "${deleteTarget?.childName}". This action cannot be undone from here.`}
        confirmLabel="Delete"
        loading={deleteEnquiryMutation.isPending}
        onConfirm={() => deleteTarget && deleteEnquiryMutation.mutate(deleteTarget.id)}
      />

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent size="lg">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle>{detail.childName}</DialogTitle>
                    <DialogDescription>
                      {detail.parentName} &middot; {detail.phone} {detail.email ? `· ${detail.email}` : ''}
                    </DialogDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      openEditEnquiryDialog(detail);
                      setDetailId(null);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Details
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Select
                      value={detail.status}
                      onValueChange={(v) => statusMutation.mutate({ id: detail.id, status: v as AdmissionStatus })}
                    >
                      <SelectTrigger className="mt-1 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="mt-1.5 font-medium text-foreground">{SOURCE_LABEL[detail.source]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Desired Class</p>
                    <p className="mt-1.5 font-medium text-foreground">{detail.desiredClassName ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned To</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{detail.assignedTo?.fullName ?? '—'}</span>
                      {detail.assignedTo?.id !== user?.userId && (
                        <Button variant="ghost" size="sm" onClick={() => assignToMeMutation.mutate(detail.id)}>
                          <UserCheck className="h-3.5 w-3.5" />
                          Assign to me
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="mt-1.5 text-foreground">{detail.address ?? '—'}</p>
                  </div>
                </div>

                {detail.notes && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                    {detail.notes}
                  </div>
                )}

                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Follow-up log</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                    {detail.followUps.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No follow-ups logged yet.</p>
                    ) : (
                      detail.followUps.map((f) => (
                        <div key={f.id} className="border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0">
                          <p className="text-foreground">{f.note}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {f.createdBy?.fullName ?? 'Staff'} &middot; {formatDate(f.createdAt)}
                            {f.nextFollowUpDate && ` · Next: ${formatDate(f.nextFollowUpDate)}`}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-2 space-y-2">
                    <Textarea
                      placeholder="Add a follow-up note..."
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      rows={2}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        className="w-40"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!followUpNote.trim()}
                        loading={followUpMutation.isPending}
                        onClick={() => followUpMutation.mutate(detail.id)}
                      >
                        Add Follow-up
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                {detail.convertedStudentId ? (
                  <span className="flex items-center gap-1.5 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Admitted (Admission No: {detail.convertedStudent?.admissionNo})
                  </span>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      setConvertTarget(detail);
                      setDetailId(null);
                    }}
                  >
                    Convert to Student
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {convertTarget && (
        <ConvertToStudentDialog
          enquiry={convertTarget}
          schools={schoolsQuery.data ?? []}
          isUnrestricted={isUnrestricted}
          onClose={() => setConvertTarget(null)}
          onConverted={() => {
            setConvertTarget(null);
            invalidateAll();
          }}
        />
      )}
    </div>
  );
}

function ConvertToStudentDialog({
  enquiry,
  schools,
  isUnrestricted,
  onClose,
  onConverted,
}: {
  enquiry: AdmissionEnquiry;
  schools: School[];
  isUnrestricted: boolean;
  onClose: () => void;
  onConverted: () => void;
}) {
  const { user } = useAuth();
  const effectiveSchoolId = isUnrestricted ? enquiry.schoolId : user?.schoolId ?? enquiry.schoolId;

  const [branchId, setBranchId] = useState(enquiry.branchId ?? '');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState<string | null>(null);

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassRecord[]>('/classes'),
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections', 'byClass', classId],
    queryFn: () => api.get<SectionRecord[]>('/sections', { classId }),
    enabled: !!classId,
  });

  const branches = schools.find((s) => s.id === effectiveSchoolId)?.branches ?? [];
  const branchClasses = (classesQuery.data ?? []).filter(
    (c) => c.schoolId === effectiveSchoolId && (!branchId || c.branchId === branchId),
  );

  const convertMutation = useMutation({
    mutationFn: () =>
      api.post('/students', {
        fullName: enquiry.childName,
        email: email || undefined,
        password,
        schoolId: effectiveSchoolId,
        branchId,
        admissionNo,
        guardianName: enquiry.parentName,
        guardianPhone: enquiry.phone,
        address: enquiry.address || undefined,
        sectionId: sectionId || undefined,
        enquiryId: enquiry.id,
      }),
    onSuccess: onConverted,
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!branchId) return setError('Please select a branch.');
    if (!admissionNo.trim()) return setError('Please enter an admission number.');
    if (!password || password.length < 8) return setError('Password must be at least 8 characters.');
    convertMutation.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Convert to Student</DialogTitle>
          <DialogDescription>
            Creates a login + student profile for {enquiry.childName}, and marks this enquiry Admitted.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Admission No." required>
              <Input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} required />
            </Field>
            <Field label="Password" required>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="(leave blank to auto-generate)" />
            </Field>
            <Field label="Branch" required>
              <Select
                value={branchId}
                onValueChange={(v) => {
                  setBranchId(v);
                  setClassId('');
                  setSectionId('');
                }}
                disabled={!branches.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Class">
              <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(''); }} disabled={!branchClasses.length}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {branchClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Section">
              <Select value={sectionId} onValueChange={setSectionId} disabled={!classId || !sectionsQuery.data?.length}>
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {(sectionsQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={convertMutation.isPending}>
              Admit Student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
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
