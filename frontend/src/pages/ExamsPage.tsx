import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CalendarDays, ClipboardList, Download, Eye, Pencil, Plus, Save, Trash2, Trophy } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { cn, formatDate } from '@/lib/utils';
import type {
  School,
  AcademicYear,
  ClassRecord,
  Subject,
  Exam,
  ExamSubject,
  MarkSheet,
  ClassSummary,
} from '@/types';

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

function EmptyState({ icon: Icon, label }: { icon: typeof BookOpen; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

type MarksDraft = Record<string, { marksObtained: string; isAbsent: boolean; remarks: string }>;

export default function ExamsPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const canDelete = hasRole('DIRECTOR', 'ADMIN');
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');
  const canEnterMarks = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER');

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools') });
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => api.get<AcademicYear[]>('/academic-years') });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassRecord[]>('/classes') });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => api.get<Subject[]>('/subjects') });
  const examsQuery = useQuery({ queryKey: ['exams'], queryFn: () => api.get<Exam[]>('/exams') });

  const schoolName = (id: string) => schoolsQuery.data?.find((s) => s.id === id)?.name ?? '—';
  const yearName = (id: string) => yearsQuery.data?.find((y) => y.id === id)?.name ?? '—';

  // ─────────────────────────── Subjects tab ───────────────────────────
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ schoolId: '', name: '', code: '' });
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [deactivateSubject, setDeactivateSubject] = useState<Subject | null>(null);

  const createSubject = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/subjects', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setSubjectOpen(false);
      setSubjectForm({ schoolId: '', name: '', code: '' });
      setSubjectError(null);
    },
    onError: (err: unknown) =>
      setSubjectError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const updateSubject = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/subjects/${editingSubjectId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setSubjectOpen(false);
      setEditingSubjectId(null);
      setSubjectForm({ schoolId: '', name: '', code: '' });
      setSubjectError(null);
    },
    onError: (err: unknown) =>
      setSubjectError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const deactivateSubjectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/subjects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setDeactivateSubject(null);
    },
  });

  function openSubjectDialog() {
    setEditingSubjectId(null);
    setSubjectForm({ schoolId: isUnrestricted ? '' : user?.schoolId ?? '', name: '', code: '' });
    setSubjectError(null);
    setSubjectOpen(true);
  }
  function openEditSubjectDialog(s: Subject) {
    setEditingSubjectId(s.id);
    setSubjectForm({ schoolId: s.schoolId, name: s.name, code: s.code ?? '' });
    setSubjectError(null);
    setSubjectOpen(true);
  }
  function submitSubject(e: FormEvent) {
    e.preventDefault();
    setSubjectError(null);
    if (editingSubjectId) {
      if (!subjectForm.name) {
        setSubjectError('Please fill all required fields.');
        return;
      }
      updateSubject.mutate({ name: subjectForm.name, code: subjectForm.code || undefined });
      return;
    }
    const effectiveSchoolId = isUnrestricted ? subjectForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !subjectForm.name) {
      setSubjectError('Please fill all required fields.');
      return;
    }
    createSubject.mutate({ schoolId: effectiveSchoolId, name: subjectForm.name, code: subjectForm.code || undefined });
  }

  // ─────────────────────────── Exams tab ───────────────────────────
  const [examOpen, setExamOpen] = useState(false);
  const [examForm, setExamForm] = useState({ schoolId: '', academicYearId: '', name: '', startDate: '', endDate: '' });
  const [examError, setExamError] = useState<string | null>(null);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [deleteExam, setDeleteExam] = useState<Exam | null>(null);
  const [managePapersExam, setManagePapersExam] = useState<Exam | null>(null);

  const createExam = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/exams', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setExamOpen(false);
      setExamForm({ schoolId: '', academicYearId: '', name: '', startDate: '', endDate: '' });
      setExamError(null);
    },
    onError: (err: unknown) => setExamError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const updateExam = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/exams/${editingExamId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setExamOpen(false);
      setEditingExamId(null);
      setExamForm({ schoolId: '', academicYearId: '', name: '', startDate: '', endDate: '' });
      setExamError(null);
    },
    onError: (err: unknown) => setExamError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const deleteExamMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/exams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setDeleteExam(null);
    },
  });

  const examYearOptions = useMemo(() => {
    const effectiveSchoolId = isUnrestricted ? examForm.schoolId : user?.schoolId;
    return (yearsQuery.data ?? []).filter((y) => y.schoolId === effectiveSchoolId);
  }, [yearsQuery.data, examForm.schoolId, isUnrestricted, user?.schoolId]);

  function openExamDialog() {
    setEditingExamId(null);
    setExamForm({ schoolId: isUnrestricted ? '' : user?.schoolId ?? '', academicYearId: '', name: '', startDate: '', endDate: '' });
    setExamError(null);
    setExamOpen(true);
  }
  function openEditExamDialog(ex: Exam) {
    setEditingExamId(ex.id);
    setExamForm({
      schoolId: ex.schoolId,
      academicYearId: ex.academicYearId,
      name: ex.name,
      startDate: ex.startDate.slice(0, 10),
      endDate: ex.endDate.slice(0, 10),
    });
    setExamError(null);
    setExamOpen(true);
  }
  function submitExam(e: FormEvent) {
    e.preventDefault();
    setExamError(null);
    if (editingExamId) {
      if (!examForm.academicYearId || !examForm.name || !examForm.startDate || !examForm.endDate) {
        setExamError('Please fill all required fields.');
        return;
      }
      updateExam.mutate({
        academicYearId: examForm.academicYearId,
        name: examForm.name,
        startDate: examForm.startDate,
        endDate: examForm.endDate,
      });
      return;
    }
    const effectiveSchoolId = isUnrestricted ? examForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !examForm.academicYearId || !examForm.name || !examForm.startDate || !examForm.endDate) {
      setExamError('Please fill all required fields.');
      return;
    }
    createExam.mutate({
      schoolId: effectiveSchoolId,
      academicYearId: examForm.academicYearId,
      name: examForm.name,
      startDate: examForm.startDate,
      endDate: examForm.endDate,
    });
  }

  // ── Papers (exam subjects) within the "Manage papers" dialog ──
  const papersQuery = useQuery({
    queryKey: ['exam-subjects', managePapersExam?.id],
    queryFn: () => api.get<ExamSubject[]>(`/exams/${managePapersExam!.id}/subjects`),
    enabled: !!managePapersExam,
  });

  const [paperForm, setPaperForm] = useState({ classId: '', subjectId: '', maxMarks: '', passingMarks: '', examDate: '' });
  const [paperError, setPaperError] = useState<string | null>(null);
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
  const [removePaperTarget, setRemovePaperTarget] = useState<ExamSubject | null>(null);
  const [removePaperError, setRemovePaperError] = useState<string | null>(null);

  const addPaper = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post(`/exams/${managePapersExam!.id}/subjects`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-subjects', managePapersExam?.id] });
      setPaperForm({ classId: '', subjectId: '', maxMarks: '', passingMarks: '', examDate: '' });
      setPaperError(null);
    },
    onError: (err: unknown) => setPaperError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const updatePaper = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/exams/subjects/${editingPaperId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-subjects', managePapersExam?.id] });
      setEditingPaperId(null);
      setPaperForm({ classId: '', subjectId: '', maxMarks: '', passingMarks: '', examDate: '' });
      setPaperError(null);
    },
    onError: (err: unknown) => setPaperError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const removePaper = useMutation({
    mutationFn: (id: string) => api.delete(`/exams/subjects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-subjects', managePapersExam?.id] });
      setRemovePaperTarget(null);
      setRemovePaperError(null);
    },
    onError: (err: unknown) => {
      setRemovePaperError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
      setRemovePaperTarget(null);
    },
  });

  const paperClassOptions = useMemo(
    () => (classesQuery.data ?? []).filter((c) => c.schoolId === managePapersExam?.schoolId),
    [classesQuery.data, managePapersExam],
  );
  const paperSubjectOptions = useMemo(
    () => (subjectsQuery.data ?? []).filter((s) => s.schoolId === managePapersExam?.schoolId),
    [subjectsQuery.data, managePapersExam],
  );

  function openPapersDialog(exam: Exam) {
    setManagePapersExam(exam);
    setEditingPaperId(null);
    setPaperForm({ classId: '', subjectId: '', maxMarks: '', passingMarks: '', examDate: '' });
    setPaperError(null);
    setRemovePaperError(null);
  }
  function openEditPaperDialog(p: ExamSubject) {
    setEditingPaperId(p.id);
    setPaperForm({
      classId: p.classId,
      subjectId: p.subjectId,
      maxMarks: String(p.maxMarks),
      passingMarks: String(p.passingMarks),
      examDate: p.examDate ? p.examDate.slice(0, 10) : '',
    });
    setPaperError(null);
  }
  function cancelPaperEdit() {
    setEditingPaperId(null);
    setPaperForm({ classId: '', subjectId: '', maxMarks: '', passingMarks: '', examDate: '' });
    setPaperError(null);
  }
  function submitPaper(e: FormEvent) {
    e.preventDefault();
    setPaperError(null);
    if (!paperForm.maxMarks || !paperForm.passingMarks) {
      setPaperError('Please fill all required fields.');
      return;
    }
    if (editingPaperId) {
      updatePaper.mutate({
        maxMarks: Number(paperForm.maxMarks),
        passingMarks: Number(paperForm.passingMarks),
        examDate: paperForm.examDate || undefined,
      });
      return;
    }
    if (!paperForm.classId || !paperForm.subjectId) {
      setPaperError('Please fill all required fields.');
      return;
    }
    addPaper.mutate({
      classId: paperForm.classId,
      subjectId: paperForm.subjectId,
      maxMarks: Number(paperForm.maxMarks),
      passingMarks: Number(paperForm.passingMarks),
      examDate: paperForm.examDate || undefined,
    });
  }

  // ─────────────────────────── Enter Marks tab ───────────────────────────
  const [marksExamId, setMarksExamId] = useState('');
  const [marksPaperId, setMarksPaperId] = useState('');
  const [marksDraft, setMarksDraft] = useState<MarksDraft>({});
  const [marksError, setMarksError] = useState<string | null>(null);

  const marksExamPapersQuery = useQuery({
    queryKey: ['exam-subjects', marksExamId],
    queryFn: () => api.get<ExamSubject[]>(`/exams/${marksExamId}/subjects`),
    enabled: !!marksExamId,
  });

  const markSheetQuery = useQuery({
    queryKey: ['results', 'sheet', marksPaperId],
    queryFn: () => api.get<MarkSheet>('/results', { examSubjectId: marksPaperId }),
    enabled: !!marksPaperId,
  });

  const saveMarks = useMutation({
    mutationFn: (entries: { studentId: string; marksObtained?: number; isAbsent?: boolean; remarks?: string }[]) =>
      api.post('/results/mark', { examSubjectId: marksPaperId, entries }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results', 'sheet', marksPaperId] });
      setMarksDraft({});
      setMarksError(null);
    },
    onError: (err: unknown) =>
      setMarksError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function updateDraft(studentId: string, patch: Partial<MarksDraft[string]>) {
    setMarksDraft((d) => {
      const row = markSheetQuery.data?.students.find((s) => s.studentId === studentId);
      const current = d[studentId] ?? {
        marksObtained: row?.marksObtained != null ? String(row.marksObtained) : '',
        isAbsent: row?.isAbsent ?? false,
        remarks: row?.remarks ?? '',
      };
      return { ...d, [studentId]: { ...current, ...patch } };
    });
  }

  function handleSaveMarks() {
    const rows = markSheetQuery.data?.students ?? [];
    const entries = rows.map((r) => {
      const draft = marksDraft[r.studentId];
      const isAbsent = draft?.isAbsent ?? r.isAbsent;
      const marksStr = draft?.marksObtained ?? (r.marksObtained != null ? String(r.marksObtained) : '');
      return {
        studentId: r.studentId,
        isAbsent,
        marksObtained: isAbsent ? undefined : marksStr !== '' ? Number(marksStr) : undefined,
        remarks: draft?.remarks || undefined,
      };
    });
    const invalid = entries.some((e) => !e.isAbsent && (e.marksObtained === undefined || Number.isNaN(e.marksObtained)));
    if (invalid) {
      setMarksError('Enter marks for every student, or mark them absent.');
      return;
    }
    saveMarks.mutate(entries);
  }

  const hasMarksUnsaved = Object.keys(marksDraft).length > 0;

  // ─────────────────────────── Results tab ───────────────────────────
  const [resultsExamId, setResultsExamId] = useState('');
  const [resultsClassId, setResultsClassId] = useState('');

  const classSummaryQuery = useQuery({
    queryKey: ['results', 'class-summary', resultsExamId, resultsClassId],
    queryFn: () => api.get<ClassSummary>('/results/class-summary', { examId: resultsExamId, classId: resultsClassId }),
    enabled: !!resultsExamId && !!resultsClassId,
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Exams &amp; Results</h2>
        <p className="mt-1 text-sm text-muted-foreground">Subjects, exams, marks entry and result summaries</p>
      </div>

      <Tabs defaultValue="exams">
        <TabsList>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          {canEnterMarks && <TabsTrigger value="marks">Enter Marks</TabsTrigger>}
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        {/* ── Subjects ── */}
        <TabsContent value="subjects">
          <div className="mb-3 flex justify-end">
            {canManage && (
              <Button onClick={openSubjectDialog}>
                <Plus className="h-4 w-4" />
                Add Subject
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {subjectsQuery.isLoading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !subjectsQuery.data?.length ? (
                <EmptyState icon={BookOpen} label="No subjects yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>Status</TableHead>
                      {(canManage || canDelete) && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjectsQuery.data.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.code ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{schoolName(s.schoolId)}</TableCell>
                        <TableCell>
                          <Badge variant={s.isActive ? 'success' : 'secondary'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                        </TableCell>
                        {(canManage || canDelete) && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {canManage && (
                                <Button variant="ghost" size="sm" onClick={() => openEditSubjectDialog(s)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && s.isActive && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeactivateSubject(s)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Deactivate
                                </Button>
                              )}
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
        </TabsContent>

        {/* ── Exams ── */}
        <TabsContent value="exams">
          <div className="mb-3 flex justify-end">
            {canManage && (
              <Button onClick={openExamDialog}>
                <Plus className="h-4 w-4" />
                Add Exam
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {examsQuery.isLoading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !examsQuery.data?.length ? (
                <EmptyState icon={CalendarDays} label="No exams yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>Academic Year</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {examsQuery.data.map((ex) => (
                      <TableRow key={ex.id}>
                        <TableCell className="font-medium text-foreground">{ex.name}</TableCell>
                        <TableCell className="text-muted-foreground">{schoolName(ex.schoolId)}</TableCell>
                        <TableCell className="text-muted-foreground">{yearName(ex.academicYearId)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(ex.startDate)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(ex.endDate)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canManage && (
                              <Button variant="ghost" size="sm" onClick={() => openPapersDialog(ex)}>
                                <ClipboardList className="h-4 w-4" />
                                Manage Papers
                              </Button>
                            )}
                            {canManage && (
                              <Button variant="ghost" size="sm" onClick={() => openEditExamDialog(ex)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setDeleteExam(ex)}
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

        {/* ── Enter Marks ── */}
        {canEnterMarks && (
          <TabsContent value="marks">
            <Card>
              <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
                  <div className="space-y-1.5">
                    <Label>Exam</Label>
                    <Select
                      value={marksExamId}
                      onValueChange={(v) => {
                        setMarksExamId(v);
                        setMarksPaperId('');
                        setMarksDraft({});
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select exam" />
                      </SelectTrigger>
                      <SelectContent>
                        {(examsQuery.data ?? []).map((ex) => (
                          <SelectItem key={ex.id} value={ex.id}>
                            {ex.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Paper</Label>
                    <Select
                      value={marksPaperId}
                      onValueChange={(v) => {
                        setMarksPaperId(v);
                        setMarksDraft({});
                      }}
                      disabled={!marksExamId || !marksExamPapersQuery.data?.length}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select paper" />
                      </SelectTrigger>
                      <SelectContent>
                        {(marksExamPapersQuery.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.class?.name} — {p.subject?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {marksPaperId && (
                  <Button onClick={handleSaveMarks} loading={saveMarks.isPending} disabled={!hasMarksUnsaved}>
                    <Save className="h-4 w-4" />
                    Save Marks
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {!marksPaperId ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <ClipboardList className="h-7 w-7" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Select an exam and paper to begin</p>
                  </div>
                ) : markSheetQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !markSheetQuery.data?.students.length ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No students enrolled in this class.</p>
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <span>Subject: <span className="font-medium text-foreground">{markSheetQuery.data.subject}</span></span>
                      <span>Class: <span className="font-medium text-foreground">{markSheetQuery.data.className}</span></span>
                      <span>Max marks: <span className="font-medium text-foreground">{markSheetQuery.data.maxMarks}</span></span>
                      <span>Passing marks: <span className="font-medium text-foreground">{markSheetQuery.data.passingMarks}</span></span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Admission No</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead className="w-32">Marks</TableHead>
                          <TableHead className="w-24">Absent</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {markSheetQuery.data.students.map((row) => {
                          const draft = marksDraft[row.studentId];
                          const isAbsent = draft?.isAbsent ?? row.isAbsent;
                          const marksVal = draft?.marksObtained ?? (row.marksObtained != null ? String(row.marksObtained) : '');
                          const remarksVal = draft?.remarks ?? row.remarks ?? '';
                          return (
                            <TableRow key={row.studentId}>
                              <TableCell className="tabular-nums text-muted-foreground">{row.admissionNo}</TableCell>
                              <TableCell className="font-medium text-foreground">{row.fullName}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  max={markSheetQuery.data!.maxMarks}
                                  value={marksVal}
                                  disabled={isAbsent}
                                  onChange={(e) => updateDraft(row.studentId, { marksObtained: e.target.value })}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => updateDraft(row.studentId, { isAbsent: !isAbsent })}
                                  className={cn(
                                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                                    isAbsent
                                      ? 'border-destructive/20 bg-destructive/10 text-destructive'
                                      : 'border-border text-muted-foreground hover:bg-secondary',
                                  )}
                                >
                                  {isAbsent ? 'Absent' : 'Present'}
                                </button>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={remarksVal}
                                  onChange={(e) => updateDraft(row.studentId, { remarks: e.target.value })}
                                  className="h-8"
                                  placeholder="Optional"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {marksError && (
                      <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {marksError}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Results ── */}
        <TabsContent value="results">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
                <div className="space-y-1.5">
                  <Label>Exam</Label>
                  <Select value={resultsExamId} onValueChange={setResultsExamId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {(examsQuery.data ?? []).map((ex) => (
                        <SelectItem key={ex.id} value={ex.id}>
                          {ex.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Class</Label>
                  <Select value={resultsClassId} onValueChange={setResultsClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {(classesQuery.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.school?.name ? `${c.school.name} — ${c.name}` : c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {!resultsExamId || !resultsClassId ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Trophy className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Select an exam and class to view results</p>
                </div>
              ) : classSummaryQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !classSummaryQuery.data?.students.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No results found for this exam and class.</p>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>Papers: <span className="font-medium text-foreground">{classSummaryQuery.data.papers}</span></span>
                    <span>Total marks: <span className="font-medium text-foreground">{classSummaryQuery.data.totalMax}</span></span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Admission No</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead className="text-right">Report Card</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classSummaryQuery.data.students.map((row, i) => (
                        <TableRow key={row.studentId}>
                          <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">{row.admissionNo}</TableCell>
                          <TableCell className="font-medium text-foreground">{row.fullName}</TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {row.totalObtained} / {row.totalMax}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">{row.percentage ?? '—'}%</TableCell>
                          <TableCell className="text-muted-foreground">{row.grade ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={row.overallResult === 'PASS' ? 'success' : 'destructive'}>
                              {row.overallResult}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="View report card"
                                onClick={() =>
                                  api.openBlob(`/results/report-card/${row.studentId}/pdf?examId=${resultsExamId}`)
                                }
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Download report card"
                                onClick={() =>
                                  api.downloadBlob(
                                    `/results/report-card/${row.studentId}/pdf?examId=${resultsExamId}`,
                                    `report-card-${row.admissionNo}.pdf`,
                                  )
                                }
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Subject dialog */}
      <Dialog
        open={subjectOpen}
        onOpenChange={(open) => {
          setSubjectOpen(open);
          if (!open) setEditingSubjectId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubjectId ? 'Edit Subject' : 'Add Subject'}</DialogTitle>
            <DialogDescription>
              {editingSubjectId ? "Update this subject's name or code." : 'Create a subject for a school, used across exams.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitSubject} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select
                  value={subjectForm.schoolId}
                  onValueChange={(v) => setSubjectForm((f) => ({ ...f, schoolId: v }))}
                  disabled={!!editingSubjectId}
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
            <Field label="Subject name" required>
              <Input
                value={subjectForm.name}
                onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Mathematics"
                required
              />
            </Field>
            <Field label="Code">
              <Input
                value={subjectForm.code}
                onChange={(e) => setSubjectForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. MATH"
              />
            </Field>
            {subjectError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {subjectError}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSubjectOpen(false);
                  setEditingSubjectId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingSubjectId ? updateSubject.isPending : createSubject.isPending}>
                {editingSubjectId ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Exam dialog */}
      <Dialog
        open={examOpen}
        onOpenChange={(open) => {
          setExamOpen(open);
          if (!open) setEditingExamId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExamId ? 'Edit Exam' : 'Add Exam'}</DialogTitle>
            <DialogDescription>
              {editingExamId ? "Update this exam's academic year, name or dates." : 'Create an exam within an academic year.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitExam} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select
                  value={examForm.schoolId}
                  onValueChange={(v) => setExamForm((f) => ({ ...f, schoolId: v, academicYearId: '' }))}
                  disabled={!!editingExamId}
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
            <Field label="Academic year" required>
              <Select
                value={examForm.academicYearId}
                onValueChange={(v) => setExamForm((f) => ({ ...f, academicYearId: v }))}
                disabled={!examYearOptions.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {examYearOptions.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Exam name" required>
              <Input
                value={examForm.name}
                onChange={(e) => setExamForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Mid-Term Examination"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date" required>
                <Input
                  type="date"
                  value={examForm.startDate}
                  onChange={(e) => setExamForm((f) => ({ ...f, startDate: e.target.value }))}
                  required
                />
              </Field>
              <Field label="End date" required>
                <Input
                  type="date"
                  value={examForm.endDate}
                  onChange={(e) => setExamForm((f) => ({ ...f, endDate: e.target.value }))}
                  required
                />
              </Field>
            </div>
            {examError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {examError}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setExamOpen(false);
                  setEditingExamId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingExamId ? updateExam.isPending : createExam.isPending}>
                {editingExamId ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage papers dialog */}
      <Dialog open={!!managePapersExam} onOpenChange={(open) => !open && setManagePapersExam(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Papers — {managePapersExam?.name}</DialogTitle>
            <DialogDescription>Add subjects (papers) per class for this exam, with marks scales.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {papersQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : !papersQuery.data?.length ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No papers added yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead>Passing</TableHead>
                    <TableHead>Date</TableHead>
                    {(canManage || canDelete) && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {papersQuery.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-foreground">{p.class?.name}</TableCell>
                      <TableCell className="text-foreground">{p.subject?.name}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{p.maxMarks}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{p.passingMarks}</TableCell>
                      <TableCell className="text-muted-foreground">{p.examDate ? formatDate(p.examDate) : '—'}</TableCell>
                      {(canManage || canDelete) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canManage && (
                              <Button variant="ghost" size="sm" onClick={() => openEditPaperDialog(p)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setRemovePaperTarget(p)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {canManage && (
              <form onSubmit={submitPaper} className="space-y-4 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">{editingPaperId ? 'Edit paper' : 'Add a paper'}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Class" required>
                    <Select
                      value={paperForm.classId}
                      onValueChange={(v) => setPaperForm((f) => ({ ...f, classId: v }))}
                      disabled={!!editingPaperId || !paperClassOptions.length}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {paperClassOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Subject" required>
                    <Select
                      value={paperForm.subjectId}
                      onValueChange={(v) => setPaperForm((f) => ({ ...f, subjectId: v }))}
                      disabled={!!editingPaperId || !paperSubjectOptions.length}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {paperSubjectOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Max marks" required>
                    <Input
                      type="number"
                      min={1}
                      value={paperForm.maxMarks}
                      onChange={(e) => setPaperForm((f) => ({ ...f, maxMarks: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Passing marks" required>
                    <Input
                      type="number"
                      min={0}
                      value={paperForm.passingMarks}
                      onChange={(e) => setPaperForm((f) => ({ ...f, passingMarks: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Exam date" className="sm:col-span-2">
                    <Input
                      type="date"
                      value={paperForm.examDate}
                      onChange={(e) => setPaperForm((f) => ({ ...f, examDate: e.target.value }))}
                    />
                  </Field>
                </div>
                {paperError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {paperError}
                  </div>
                )}
                {removePaperError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {removePaperError}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  {editingPaperId && (
                    <Button type="button" variant="outline" onClick={cancelPaperEdit}>
                      Cancel
                    </Button>
                  )}
                  <Button type="submit" loading={editingPaperId ? updatePaper.isPending : addPaper.isPending}>
                    {editingPaperId ? (
                      <>
                        <Pencil className="h-4 w-4" />
                        Save Changes
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Add Paper
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManagePapersExam(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateSubject}
        onOpenChange={(open) => !open && setDeactivateSubject(null)}
        title="Deactivate subject?"
        description={`This will mark "${deactivateSubject?.name ?? ''}" as inactive.`}
        confirmLabel="Deactivate"
        loading={deactivateSubjectMutation.isPending}
        onConfirm={() => deactivateSubject && deactivateSubjectMutation.mutate(deactivateSubject.id)}
      />

      <ConfirmDialog
        open={!!deleteExam}
        onOpenChange={(open) => !open && setDeleteExam(null)}
        title="Delete exam?"
        description={`This will remove "${deleteExam?.name ?? ''}" and its papers cannot be modified afterwards.`}
        confirmLabel="Delete"
        destructive
        loading={deleteExamMutation.isPending}
        onConfirm={() => deleteExam && deleteExamMutation.mutate(deleteExam.id)}
      />

      <ConfirmDialog
        open={!!removePaperTarget}
        onOpenChange={(open) => !open && setRemovePaperTarget(null)}
        title="Remove paper?"
        description={`This will remove ${removePaperTarget?.subject?.name ?? 'this paper'} from the exam. This fails if marks have already been entered.`}
        confirmLabel="Remove"
        destructive
        loading={removePaper.isPending}
        onConfirm={() => removePaperTarget && removePaper.mutate(removePaperTarget.id)}
      />
    </div>
  );
}
