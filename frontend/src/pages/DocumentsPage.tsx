import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, FileBadge, Plus, Trash2, Download, Check, X, Ban } from 'lucide-react';
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
  StudentProfile,
  TeacherProfile,
  PayrollStaffProfile,
  DocumentRecord,
  DocumentOwnerType,
  DocumentCategory,
  CertificateRecord,
  CertificateType,
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

function EmptyState({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function ownerName(doc: DocumentRecord | CertificateRecord) {
  if ('student' in doc && doc.student) return `${doc.student.user.fullName} (${doc.student.admissionNo})`;
  if ('teacher' in doc && doc.teacher) return doc.teacher.user.fullName;
  if ('staff' in doc && doc.staff) return doc.staff.user.fullName;
  return '—';
}

const DOC_STATUS_VARIANT: Record<string, 'secondary' | 'success' | 'destructive'> = {
  PENDING: 'secondary',
  VERIFIED: 'success',
  REJECTED: 'destructive',
};

const DOC_CATEGORIES: DocumentCategory[] = [
  'B_FORM', 'CNIC', 'DOMICILE', 'BIRTH_CERTIFICATE', 'CHARACTER_CERTIFICATE',
  'TRANSCRIPT', 'DEGREE', 'CONTRACT', 'MEDICAL', 'PHOTO', 'OTHER',
];
const CERT_TYPES: CertificateType[] = ['CHARACTER', 'TRANSFER', 'LEAVING', 'BONAFIDE', 'EXPERIENCE', 'ACHIEVEMENT', 'MIGRATION', 'CUSTOM'];

const uploadForm0 = {
  schoolId: '', ownerType: 'STUDENT' as DocumentOwnerType, ownerId: '',
  category: 'OTHER' as DocumentCategory, title: '', isConfidential: false, expiresAt: '',
};
const certForm0 = {
  schoolId: '',
  holderType: 'STUDENT' as 'STUDENT' | 'STAFF',
  holderId: '',
  type: 'BONAFIDE' as CertificateType,
  title: '',
  bodyText: '',
  remarks: '',
  shiftedToSchool: '',
};

export default function DocumentsPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');
  const canManageDocs = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST');
  const canVerifyDocs = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const canDeleteDocs = hasRole('DIRECTOR', 'ADMIN');
  const canIssueCerts = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const isSelfViewer = !canManageDocs;

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools'), enabled: canManageDocs });
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: () => api.get<StudentProfile[]>('/students'), enabled: canManageDocs });
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: () => api.get<TeacherProfile[]>('/teachers'), enabled: canManageDocs });
  const staffQuery = useQuery({
    queryKey: ['payroll', 'staff-profiles'],
    queryFn: () => api.get<PayrollStaffProfile[]>('/payroll/staff-profiles'),
    enabled: canManageDocs,
  });

  // ─────────────────────────── Documents tab ───────────────────────────
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const documentsQuery = useQuery({
    queryKey: ['documents', categoryFilter, statusFilter],
    queryFn: () => api.get<DocumentRecord[]>('/documents', { category: categoryFilter || undefined, status: statusFilter || undefined }),
    enabled: canManageDocs,
  });
  const myDocumentsQuery = useQuery({
    queryKey: ['documents', 'me'],
    queryFn: () => api.get<DocumentRecord[]>('/documents/me'),
    enabled: isSelfViewer,
  });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(uploadForm0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DocumentRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteDoc, setDeleteDoc] = useState<DocumentRecord | null>(null);

  const ownerOptions = useMemo(() => {
    if (uploadForm.ownerType === 'STUDENT') {
      return (studentsQuery.data ?? []).map((s) => ({ id: s.id, label: `${s.user.fullName} — ${s.admissionNo}` }));
    }
    if (uploadForm.ownerType === 'TEACHER') {
      return (teachersQuery.data ?? []).map((t) => ({ id: t.id, label: t.user.fullName }));
    }
    return (staffQuery.data ?? []).map((s) => ({ id: s.id, label: `${s.user.fullName}${s.designation ? ' — ' + s.designation : ''}` }));
  }, [uploadForm.ownerType, studentsQuery.data, teachersQuery.data, staffQuery.data]);

  const uploadDoc = useMutation({
    mutationFn: (fd: FormData) => api.upload('/documents', fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setUploadOpen(false);
      setUploadForm(uploadForm0);
      setUploadFile(null);
      setUploadError(null);
    },
    onError: (err: unknown) => setUploadError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const updateDoc = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => api.patch(`/documents/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setRejectTarget(null);
      setRejectReason('');
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setDeleteDoc(null);
    },
  });

  function openUploadDialog() {
    setUploadForm({ ...uploadForm0, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setUploadFile(null);
    setUploadError(null);
    setUploadOpen(true);
  }

  function submitUpload(e: FormEvent) {
    e.preventDefault();
    setUploadError(null);
    const effectiveSchoolId = isUnrestricted ? uploadForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !uploadForm.ownerId || !uploadForm.title || !uploadFile) {
      setUploadError('Please fill all required fields and choose a file.');
      return;
    }
    const fd = new FormData();
    fd.append('schoolId', effectiveSchoolId);
    fd.append('ownerType', uploadForm.ownerType);
    if (uploadForm.ownerType === 'STUDENT') fd.append('studentId', uploadForm.ownerId);
    if (uploadForm.ownerType === 'TEACHER') fd.append('teacherId', uploadForm.ownerId);
    if (uploadForm.ownerType === 'STAFF') fd.append('staffId', uploadForm.ownerId);
    fd.append('category', uploadForm.category);
    fd.append('title', uploadForm.title);
    fd.append('isConfidential', String(uploadForm.isConfidential));
    if (uploadForm.expiresAt) fd.append('expiresAt', uploadForm.expiresAt);
    fd.append('file', uploadFile);
    uploadDoc.mutate(fd);
  }

  function downloadDocument(doc: DocumentRecord) {
    api.openBlob(`/documents/${doc.id}/download`);
  }

  // ─────────────────────────── Certificates tab ───────────────────────────
  const [certTypeFilter, setCertTypeFilter] = useState('');
  const certificatesQuery = useQuery({
    queryKey: ['certificates', certTypeFilter],
    queryFn: () => api.get<CertificateRecord[]>('/certificates', { type: certTypeFilter || undefined }),
    enabled: canManageDocs,
  });
  const myCertificatesQuery = useQuery({
    queryKey: ['certificates', 'mine'],
    queryFn: () => api.get<CertificateRecord[]>('/certificates/mine'),
    enabled: isSelfViewer && hasRole('STUDENT'),
  });

  const [certOpen, setCertOpen] = useState(false);
  const [certForm, setCertForm] = useState(certForm0);
  const [certError, setCertError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<CertificateRecord | null>(null);

  const certOwnerOptions = useMemo(() => {
    if (certForm.holderType === 'STUDENT') {
      return (studentsQuery.data ?? []).map((s) => ({ id: s.id, label: `${s.user.fullName} — ${s.admissionNo}` }));
    }
    return (staffQuery.data ?? []).map((s) => ({ id: s.id, label: `${s.user.fullName}${s.designation ? ' — ' + s.designation : ''}` }));
  }, [certForm.holderType, studentsQuery.data, staffQuery.data]);

  const issueCert = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/certificates', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setCertOpen(false);
      setCertForm(certForm0);
      setCertError(null);
    },
    onError: (err: unknown) => setCertError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const revokeCert = useMutation({
    mutationFn: (id: string) => api.patch(`/certificates/${id}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      setRevokeTarget(null);
    },
  });

  function openCertDialog() {
    setCertForm({ ...certForm0, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setCertError(null);
    setCertOpen(true);
  }

  function submitCert(e: FormEvent) {
    e.preventDefault();
    setCertError(null);
    const effectiveSchoolId = isUnrestricted ? certForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !certForm.holderId || !certForm.title) {
      setCertError('Please fill all required fields.');
      return;
    }
    issueCert.mutate({
      schoolId: effectiveSchoolId,
      studentId: certForm.holderType === 'STUDENT' ? certForm.holderId : undefined,
      staffId: certForm.holderType === 'STAFF' ? certForm.holderId : undefined,
      type: certForm.type,
      title: certForm.title,
      bodyText: certForm.bodyText || undefined,
      remarks: certForm.remarks || undefined,
      shiftedToSchool: certForm.type === 'MIGRATION' ? certForm.shiftedToSchool || undefined : undefined,
    });
  }

  function viewCertPdf(cert: CertificateRecord) {
    api.openBlob(`/certificates/${cert.id}/pdf`);
  }
  function downloadCertPdf(cert: CertificateRecord) {
    api.downloadBlob(`/certificates/${cert.id}/pdf`, `${cert.certificateNo}.pdf`);
  }

  const docsToShow = canManageDocs ? documentsQuery.data : myDocumentsQuery.data;
  const docsLoading = canManageDocs ? documentsQuery.isLoading : myDocumentsQuery.isLoading;
  const certsToShow = canManageDocs ? certificatesQuery.data : myCertificatesQuery.data;
  const certsLoading = canManageDocs ? certificatesQuery.isLoading : myCertificatesQuery.isLoading;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Documents & Certificates</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {canManageDocs
            ? 'Student/teacher/staff document vault and certificate issuance.'
            : 'Your uploaded documents and issued certificates.'}
        </p>
      </div>

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {(canManageDocs || hasRole('STUDENT')) && <TabsTrigger value="certificates">Certificates</TabsTrigger>}
        </TabsList>

        {/* ── Documents ── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              {canManageDocs && (
                <div className="flex flex-wrap gap-3">
                  <div className="w-40">
                    <Field label="Category">
                      <Select value={categoryFilter || '__all__'} onValueChange={(v) => setCategoryFilter(v === '__all__' ? '' : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Every category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Every category</SelectItem>
                          {DOC_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {titleCase(c)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="w-36">
                    <Field label="Status">
                      <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Every status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Every status</SelectItem>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="VERIFIED">Verified</SelectItem>
                          <SelectItem value="REJECTED">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>
              )}
              {canManageDocs && (
                <Button onClick={openUploadDialog}>
                  <Plus className="h-4 w-4" />
                  Upload Document
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {docsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !docsToShow?.length ? (
                <EmptyState icon={FileText} label="No documents found" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      {canManageDocs && <TableHead>Owner</TableHead>}
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docsToShow.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium text-foreground">
                          {d.title}
                          {d.isConfidential && (
                            <Badge variant="secondary" className="ml-2">
                              Confidential
                            </Badge>
                          )}
                        </TableCell>
                        {canManageDocs && <TableCell className="text-muted-foreground">{ownerName(d)}</TableCell>}
                        <TableCell className="text-muted-foreground">{titleCase(d.category)}</TableCell>
                        <TableCell>
                          <Badge variant={DOC_STATUS_VARIANT[d.status]}>{d.status}</Badge>
                          {d.status === 'REJECTED' && d.rejectionReason && (
                            <p className="mt-1 text-xs text-muted-foreground">{d.rejectionReason}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => downloadDocument(d)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            {canVerifyDocs && d.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-700 hover:bg-green-50"
                                  onClick={() => updateDoc.mutate({ id: d.id, payload: { status: 'VERIFIED' } })}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setRejectTarget(d)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {canDeleteDocs && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setDeleteDoc(d)}
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
        </TabsContent>

        {/* ── Certificates ── */}
        {(canManageDocs || hasRole('STUDENT')) && (
          <TabsContent value="certificates">
            <Card>
              <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
                {canManageDocs && (
                  <div className="w-full sm:max-w-xs">
                    <Field label="Type">
                      <Select value={certTypeFilter || '__all__'} onValueChange={(v) => setCertTypeFilter(v === '__all__' ? '' : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Every type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Every type</SelectItem>
                          {CERT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {titleCase(t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                )}
                {canIssueCerts && (
                  <Button onClick={openCertDialog}>
                    <Plus className="h-4 w-4" />
                    Issue Certificate
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {certsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !certsToShow?.length ? (
                  <EmptyState icon={FileBadge} label="No certificates issued yet" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Certificate No</TableHead>
                        <TableHead>Type</TableHead>
                        {canManageDocs && <TableHead>Holder</TableHead>}
                        <TableHead>Issued</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {certsToShow.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-foreground">{c.certificateNo}</TableCell>
                          <TableCell className="text-muted-foreground">{titleCase(c.type)}</TableCell>
                          {canManageDocs && <TableCell className="text-muted-foreground">{ownerName(c)}</TableCell>}
                          <TableCell className="text-muted-foreground">{formatDate(c.issuedDate)}</TableCell>
                          <TableCell>
                            <Badge variant={c.isRevoked ? 'destructive' : 'success'}>{c.isRevoked ? 'Revoked' : 'Valid'}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => viewCertPdf(c)}>
                                View
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => downloadCertPdf(c)}>
                                <Download className="h-4 w-4" />
                              </Button>
                              {canIssueCerts && !c.isRevoked && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setRevokeTarget(c)}
                                >
                                  <Ban className="h-4 w-4" />
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
        )}
      </Tabs>

      {/* Upload document dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>PDF, JPG, PNG or WEBP, up to 10MB.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitUpload} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select value={uploadForm.schoolId} onValueChange={(v) => setUploadForm((f) => ({ ...f, schoolId: v }))}>
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
              <Field label="Owner type" required>
                <Select
                  value={uploadForm.ownerType}
                  onValueChange={(v) => setUploadForm((f) => ({ ...f, ownerType: v as DocumentOwnerType, ownerId: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="TEACHER">Teacher</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Owner" required>
                <Select value={uploadForm.ownerId} onValueChange={(v) => setUploadForm((f) => ({ ...f, ownerId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {ownerOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category" required>
                <Select value={uploadForm.category} onValueChange={(v) => setUploadForm((f) => ({ ...f, category: v as DocumentCategory }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {titleCase(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Expiry date (optional)">
                <Input type="date" value={uploadForm.expiresAt} onChange={(e) => setUploadForm((f) => ({ ...f, expiresAt: e.target.value }))} />
              </Field>
            </div>
            <Field label="Title" required>
              <Input value={uploadForm.title} onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            <Field label="File" required>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                required
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={uploadForm.isConfidential}
                onChange={(e) => setUploadForm((f) => ({ ...f, isConfidential: e.target.checked }))}
              />
              Mark as confidential (CNIC, medical, etc. — restricted to Director/Admin/Principal and the owner)
            </label>
            {uploadError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{uploadError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={uploadDoc.isPending}>
                Upload
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject document dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
            <DialogDescription>Give a reason so the uploader knows what to fix.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Reason">
              <textarea
                className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Image is blurry, please re-upload"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={updateDoc.isPending}
                onClick={() => rejectTarget && updateDoc.mutate({ id: rejectTarget.id, payload: { status: 'REJECTED', rejectionReason: rejectReason } })}
              >
                Reject
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue certificate dialog */}
      <Dialog open={certOpen} onOpenChange={setCertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Certificate</DialogTitle>
            <DialogDescription>Generates a signed PDF with a public verification code.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCert} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select value={certForm.schoolId} onValueChange={(v) => setCertForm((f) => ({ ...f, schoolId: v }))}>
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
              <Field label="Holder type" required>
                <Select
                  value={certForm.holderType}
                  onValueChange={(v) => setCertForm((f) => ({ ...f, holderType: v as 'STUDENT' | 'STAFF', holderId: '' }))}
                  disabled={certForm.type === 'MIGRATION'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    {certForm.type !== 'MIGRATION' && <SelectItem value="STAFF">Staff</SelectItem>}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Holder" required>
                <Select value={certForm.holderId} onValueChange={(v) => setCertForm((f) => ({ ...f, holderId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {certOwnerOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Certificate type" required>
              <Select
                value={certForm.type}
                onValueChange={(v) =>
                  setCertForm((f) => ({
                    ...f,
                    type: v as CertificateType,
                    // Migration certificates are student-only.
                    holderType: v === 'MIGRATION' ? 'STUDENT' : f.holderType,
                    holderId: v === 'MIGRATION' && f.holderType !== 'STUDENT' ? '' : f.holderId,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CERT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {titleCase(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Title" required>
              <Input value={certForm.title} onChange={(e) => setCertForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            {certForm.type === 'MIGRATION' && (
              <Field label="Shifted to school (optional)">
                <Input
                  value={certForm.shiftedToSchool}
                  onChange={(e) => setCertForm((f) => ({ ...f, shiftedToSchool: e.target.value }))}
                  placeholder="Destination school name"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Admission date, attendance, marks and dues are filled in automatically from the student's records.
                </p>
              </Field>
            )}
            <Field label="Body text (optional — a default is used if left blank)">
              <textarea
                className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                value={certForm.bodyText}
                onChange={(e) => setCertForm((f) => ({ ...f, bodyText: e.target.value }))}
              />
            </Field>
            <Field label="Internal remarks (optional)">
              <Input value={certForm.remarks} onChange={(e) => setCertForm((f) => ({ ...f, remarks: e.target.value }))} />
            </Field>
            {certError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{certError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCertOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={issueCert.isPending}>
                Issue Certificate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteDoc}
        onOpenChange={(open) => !open && setDeleteDoc(null)}
        title="Delete document?"
        description={`This will remove "${deleteDoc?.title ?? ''}" from the vault.`}
        confirmLabel="Delete"
        destructive
        loading={deleteDocMutation.isPending}
        onConfirm={() => deleteDoc && deleteDocMutation.mutate(deleteDoc.id)}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke certificate?"
        description={`"${revokeTarget?.certificateNo ?? ''}" will show as revoked to anyone who verifies it.`}
        confirmLabel="Revoke"
        destructive
        loading={revokeCert.isPending}
        onConfirm={() => revokeTarget && revokeCert.mutate(revokeTarget.id)}
      />
    </div>
  );
}
