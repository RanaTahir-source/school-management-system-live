import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { formatDate } from '@/lib/utils';
import type {
  School,
  ClassRecord,
  Subject,
  AiQuestionPaper,
  AiQuestionPaperContent,
  AiLessonPlan,
  AiLessonPlanContent,
} from '@/types';

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

export default function AiToolsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">AI Tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a first draft in seconds, then review and edit before printing - the AI never publishes anything
          automatically.
        </p>
      </div>

      <Tabs defaultValue="question-papers">
        <TabsList>
          <TabsTrigger value="question-papers">Question Papers</TabsTrigger>
          <TabsTrigger value="lesson-plans">Lesson Plans</TabsTrigger>
        </TabsList>
        <TabsContent value="question-papers">
          <QuestionPapersTab />
        </TabsContent>
        <TabsContent value="lesson-plans">
          <LessonPlansTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// QUESTION PAPERS
// ─────────────────────────────────────────────────────────────────────────

type QpForm = {
  schoolId: string;
  subjectId: string;
  classId: string;
  title: string;
  examType: string;
  totalMarks: string;
  durationMinutes: string;
  topics: string;
  instructions: string;
};

const EMPTY_QP_FORM: QpForm = {
  schoolId: '',
  subjectId: '',
  classId: '',
  title: '',
  examType: '',
  totalMarks: '100',
  durationMinutes: '',
  topics: '',
  instructions: '',
};

function QuestionPapersTab() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [generateOpen, setGenerateOpen] = useState(false);
  const [form, setForm] = useState<QpForm>(EMPTY_QP_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AiQuestionPaper | null>(null);

  const papersQuery = useQuery({
    queryKey: ['ai-question-papers'],
    queryFn: () => api.get<AiQuestionPaper[]>('/ai/question-papers'),
  });
  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
    enabled: generateOpen,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassRecord[]>('/classes'),
    enabled: generateOpen,
  });
  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get<Subject[]>('/subjects'),
    enabled: generateOpen,
  });

  const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId ?? '';
  const schoolClasses = (classesQuery.data ?? []).filter((c) => c.schoolId === effectiveSchoolId);
  const schoolSubjects = (subjectsQuery.data ?? []).filter((s) => s.schoolId === effectiveSchoolId);

  const generateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<AiQuestionPaper>('/ai/question-papers/generate', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-question-papers'] });
      setGenerateOpen(false);
      setForm(EMPTY_QP_FORM);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ai/question-papers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-question-papers'] });
      setDeleteTarget(null);
    },
  });

  function openGenerate() {
    setForm({ ...EMPTY_QP_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setFormError(null);
    setGenerateOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!effectiveSchoolId) return setFormError('Please select a school.');
    if (!form.title.trim() || !form.topics.trim()) return setFormError('Please fill title and topics.');
    const totalMarks = Number(form.totalMarks);
    if (!totalMarks || totalMarks < 5) return setFormError('Please enter valid total marks.');

    generateMutation.mutate({
      schoolId: effectiveSchoolId,
      subjectId: form.subjectId || undefined,
      classId: form.classId || undefined,
      title: form.title,
      examType: form.examType || undefined,
      totalMarks,
      durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
      topics: form.topics,
      instructions: form.instructions || undefined,
    });
  }

  const detail = useMemo(() => papersQuery.data?.find((p) => p.id === detailId) ?? null, [papersQuery.data, detailId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openGenerate}>
          <Sparkles className="h-4 w-4" />
          Generate Question Paper
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {papersQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !papersQuery.data?.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <p className="text-sm font-medium text-foreground">No question papers generated yet</p>
              <p className="text-sm text-muted-foreground">Click "Generate Question Paper" to create your first draft.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject / Class</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {papersQuery.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{p.title}</span>
                      {p.examType && <p className="text-xs text-muted-foreground">{p.examType}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.subject?.name ?? '—'} {p.class ? `/ ${p.class.name}` : ''}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{p.totalMarks}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(p.id)}>
                          View / Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => api.openBlob(`/ai/question-papers/${p.id}/pdf`)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Generate dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Generate Question Paper</DialogTitle>
            <DialogDescription>
              The AI drafts a full question paper from the topics you give it - you can edit every question afterwards.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Title" required className="sm:col-span-2">
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Class 8 Science - Midterm Examination"
                  required
                />
              </Field>
              {isUnrestricted && (
                <Field label="School" required>
                  <Select value={form.schoolId} onValueChange={(v) => setForm((f) => ({ ...f, schoolId: v, classId: '', subjectId: '' }))}>
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
              <Field label="Exam type">
                <Select value={form.examType || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, examType: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
                    <SelectItem value="Class Test">Class Test</SelectItem>
                    <SelectItem value="Quiz">Quiz</SelectItem>
                    <SelectItem value="Midterm">Midterm</SelectItem>
                    <SelectItem value="Final">Final</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Subject">
                <Select value={form.subjectId || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, subjectId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
                    {schoolSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Class">
                <Select value={form.classId || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, classId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
                    {schoolClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Total marks" required>
                <Input type="number" min={5} value={form.totalMarks} onChange={(e) => setForm((f) => ({ ...f, totalMarks: e.target.value }))} required />
              </Field>
              <Field label="Duration (minutes)">
                <Input type="number" min={10} value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))} />
              </Field>
              <Field label="Topics / chapters to cover" required className="sm:col-span-2">
                <Textarea
                  value={form.topics}
                  onChange={(e) => setForm((f) => ({ ...f, topics: e.target.value }))}
                  placeholder="e.g. Chapter 3: Photosynthesis, Chapter 4: Respiration in Plants"
                  rows={3}
                  required
                />
              </Field>
              <Field label="Extra instructions (optional)" className="sm:col-span-2">
                <Textarea
                  value={form.instructions}
                  onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                  placeholder="e.g. Include 10 MCQs, 5 short questions, and 2 long questions"
                  rows={2}
                />
              </Field>
            </div>

            {formError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={generateMutation.isPending}>
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {detail && (
        <QuestionPaperDetailDialog
          paper={detail}
          open={!!detail}
          onOpenChange={(open) => !open && setDetailId(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['ai-question-papers'] })}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete question paper?"
        description={`This will permanently remove "${deleteTarget?.title}".`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function QuestionPaperDetailDialog({
  paper,
  open,
  onOpenChange,
  onSaved,
}: {
  paper: AiQuestionPaper;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(paper.title);
  const [instructions, setInstructions] = useState(paper.instructions ?? '');
  const [content, setContent] = useState<AiQuestionPaperContent>(paper.content);

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/ai/question-papers/${paper.id}`, { title, instructions, content }),
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
    },
  });

  function updateQuestion(sIdx: number, qIdx: number, patch: Partial<AiQuestionPaperContent['sections'][number]['questions'][number]>) {
    setContent((c) => {
      const sections = [...c.sections];
      const questions = [...sections[sIdx].questions];
      questions[qIdx] = { ...questions[qIdx], ...patch };
      sections[sIdx] = { ...sections[sIdx], questions };
      return { sections };
    });
  }

  function removeQuestion(sIdx: number, qIdx: number) {
    setContent((c) => {
      const sections = [...c.sections];
      sections[sIdx] = { ...sections[sIdx], questions: sections[sIdx].questions.filter((_, i) => i !== qIdx) };
      return { sections };
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit Question Paper</DialogTitle>
          <DialogDescription>Review and tweak the AI's draft before printing.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Instructions">
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} />
          </Field>

          {content.sections.map((section, sIdx) => (
            <div key={sIdx} className="rounded-lg border border-border p-3">
              <p className="mb-2 text-sm font-semibold text-foreground">
                {section.title} <span className="text-muted-foreground">({section.marks} marks)</span>
              </p>
              <div className="space-y-3">
                {section.questions.map((q, qIdx) => (
                  <div key={qIdx} className="flex gap-2 rounded-md bg-muted/30 p-2">
                    <div className="flex-1 space-y-1.5">
                      <Textarea
                        value={q.text}
                        onChange={(e) => updateQuestion(sIdx, qIdx, { text: e.target.value })}
                        rows={2}
                        className="text-sm"
                      />
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-2 gap-1.5 pl-2 text-xs text-muted-foreground">
                          {q.options.map((opt, oi) => (
                            <span key={oi}>
                              {String.fromCharCode(65 + oi)}) {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Input
                        type="number"
                        className="h-8 w-16 text-xs"
                        value={q.marks}
                        onChange={(e) => updateQuestion(sIdx, qIdx, { marks: Number(e.target.value) })}
                      />
                      <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => removeQuestion(sIdx, qIdx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LESSON PLANS
// ─────────────────────────────────────────────────────────────────────────

type LpForm = {
  schoolId: string;
  subjectId: string;
  classId: string;
  topic: string;
  durationMinutes: string;
  instructions: string;
};

const EMPTY_LP_FORM: LpForm = {
  schoolId: '',
  subjectId: '',
  classId: '',
  topic: '',
  durationMinutes: '40',
  instructions: '',
};

function LessonPlansTab() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [generateOpen, setGenerateOpen] = useState(false);
  const [form, setForm] = useState<LpForm>(EMPTY_LP_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AiLessonPlan | null>(null);

  const plansQuery = useQuery({
    queryKey: ['ai-lesson-plans'],
    queryFn: () => api.get<AiLessonPlan[]>('/ai/lesson-plans'),
  });
  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
    enabled: generateOpen,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassRecord[]>('/classes'),
    enabled: generateOpen,
  });
  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get<Subject[]>('/subjects'),
    enabled: generateOpen,
  });

  const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId ?? '';
  const schoolClasses = (classesQuery.data ?? []).filter((c) => c.schoolId === effectiveSchoolId);
  const schoolSubjects = (subjectsQuery.data ?? []).filter((s) => s.schoolId === effectiveSchoolId);

  const generateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<AiLessonPlan>('/ai/lesson-plans/generate', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-lesson-plans'] });
      setGenerateOpen(false);
      setForm(EMPTY_LP_FORM);
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ai/lesson-plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-lesson-plans'] });
      setDeleteTarget(null);
    },
  });

  function openGenerate() {
    setForm({ ...EMPTY_LP_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setFormError(null);
    setGenerateOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!effectiveSchoolId) return setFormError('Please select a school.');
    if (!form.topic.trim()) return setFormError('Please enter a topic.');

    generateMutation.mutate({
      schoolId: effectiveSchoolId,
      subjectId: form.subjectId || undefined,
      classId: form.classId || undefined,
      topic: form.topic,
      durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
      instructions: form.instructions || undefined,
    });
  }

  const detail = useMemo(() => plansQuery.data?.find((p) => p.id === detailId) ?? null, [plansQuery.data, detailId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openGenerate}>
          <Sparkles className="h-4 w-4" />
          Generate Lesson Plan
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {plansQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !plansQuery.data?.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <p className="text-sm font-medium text-foreground">No lesson plans generated yet</p>
              <p className="text-sm text-muted-foreground">Click "Generate Lesson Plan" to create your first draft.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead>Subject / Class</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plansQuery.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-foreground">{p.topic}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.subject?.name ?? '—'} {p.class ? `/ ${p.class.name}` : ''}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.durationMinutes ? `${p.durationMinutes} min` : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(p.id)}>
                          View / Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => api.openBlob(`/ai/lesson-plans/${p.id}/pdf`)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Generate Lesson Plan</DialogTitle>
            <DialogDescription>Get a ready-to-teach lesson plan structure in seconds.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Topic" required className="sm:col-span-2">
                <Input
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g. Photosynthesis in plants"
                  required
                />
              </Field>
              {isUnrestricted && (
                <Field label="School" required>
                  <Select value={form.schoolId} onValueChange={(v) => setForm((f) => ({ ...f, schoolId: v, classId: '', subjectId: '' }))}>
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
              <Field label="Subject">
                <Select value={form.subjectId || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, subjectId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
                    {schoolSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Class">
                <Select value={form.classId || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, classId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
                    {schoolClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Duration (minutes)">
                <Input type="number" min={10} value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))} />
              </Field>
              <Field label="Extra instructions (optional)" className="sm:col-span-2">
                <Textarea
                  value={form.instructions}
                  onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                  placeholder="e.g. Include a group activity, focus on practical examples"
                  rows={2}
                />
              </Field>
            </div>

            {formError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={generateMutation.isPending}>
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {detail && (
        <LessonPlanDetailDialog
          plan={detail}
          open={!!detail}
          onOpenChange={(open) => !open && setDetailId(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['ai-lesson-plans'] })}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete lesson plan?"
        description={`This will permanently remove "${deleteTarget?.topic}".`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function LessonPlanDetailDialog({
  plan,
  open,
  onOpenChange,
  onSaved,
}: {
  plan: AiLessonPlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [topic, setTopic] = useState(plan.topic);
  const [content, setContent] = useState<AiLessonPlanContent>(plan.content);

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/ai/lesson-plans/${plan.id}`, { topic, content }),
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
    },
  });

  function updateListItem(key: 'objectives' | 'materials' | 'mainActivities', idx: number, value: string) {
    setContent((c) => {
      const list = [...c[key]];
      list[idx] = value;
      return { ...c, [key]: list };
    });
  }

  function removeListItem(key: 'objectives' | 'materials' | 'mainActivities', idx: number) {
    setContent((c) => ({ ...c, [key]: c[key].filter((_, i) => i !== idx) }));
  }

  function renderList(label: string, key: 'objectives' | 'materials' | 'mainActivities') {
    return (
      <Field label={label}>
        <div className="space-y-1.5">
          {content[key].map((item, idx) => (
            <div key={idx} className="flex gap-1.5">
              <Input value={item} onChange={(e) => updateListItem(key, idx, e.target.value)} className="text-sm" />
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeListItem(key, idx)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </Field>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit Lesson Plan</DialogTitle>
          <DialogDescription>Review and tweak the AI's draft before using it in class.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Topic">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </Field>
          {renderList('Learning Objectives', 'objectives')}
          {renderList('Materials Needed', 'materials')}
          <Field label="Warm-up">
            <Textarea value={content.warmUp} onChange={(e) => setContent((c) => ({ ...c, warmUp: e.target.value }))} rows={2} />
          </Field>
          {renderList('Main Activities', 'mainActivities')}
          <Field label="Assessment">
            <Textarea value={content.assessment} onChange={(e) => setContent((c) => ({ ...c, assessment: e.target.value }))} rows={2} />
          </Field>
          <Field label="Homework">
            <Textarea value={content.homework} onChange={(e) => setContent((c) => ({ ...c, homework: e.target.value }))} rows={2} />
          </Field>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
