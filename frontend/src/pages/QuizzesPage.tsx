import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Pencil, Play, Plus, Trash2, Users, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import type {
  ClassRecord,
  SectionRecord,
  Subject,
  Quiz,
  QuizQuestionType,
  QuizAttemptRosterEntry,
  AvailableQuiz,
  QuizAttemptStart,
  QuizResult,
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

function EmptyState({ icon: Icon, label, hint }: { icon: typeof ClipboardList; label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function QuizzesPage() {
  const { hasRole } = useAuth();
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Quizzes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasRole('STUDENT') ? 'Take quizzes assigned to your class' : 'Build interactive quizzes for students to take online'}
        </p>
      </div>
      {hasRole('STUDENT') ? <StudentQuizzesView /> : <ManageQuizzesView />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TEACHER / MANAGER SIDE
// ─────────────────────────────────────────────────────────────────────────

type QuestionDraft = {
  type: QuizQuestionType;
  text: string;
  options: string[];
  correctIndex: number;
  marks: string;
};

const EMPTY_QUESTION: QuestionDraft = { type: 'MCQ', text: '', options: ['', '', '', ''], correctIndex: 0, marks: '1' };

type QuizForm = {
  subjectId: string;
  classId: string;
  sectionId: string;
  title: string;
  description: string;
  timeLimitMinutes: string;
  questions: QuestionDraft[];
};

const EMPTY_QUIZ_FORM: QuizForm = {
  subjectId: '',
  classId: '',
  sectionId: '',
  title: '',
  description: '',
  timeLimitMinutes: '',
  questions: [{ ...EMPTY_QUESTION }],
};

function ManageQuizzesView() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [form, setForm] = useState<QuizForm>(EMPTY_QUIZ_FORM);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quiz | null>(null);
  const [rosterTarget, setRosterTarget] = useState<Quiz | null>(null);

  const quizzesQuery = useQuery({ queryKey: ['quizzes'], queryFn: () => api.get<Quiz[]>('/quizzes') });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => api.get<Subject[]>('/subjects'), enabled: open });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassRecord[]>('/classes'), enabled: open });
  const sectionsQuery = useQuery({
    queryKey: ['sections', form.classId],
    queryFn: () => api.get<SectionRecord[]>('/sections', { classId: form.classId }),
    enabled: open && !!form.classId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/quizzes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      closeDialog();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/quizzes/${editingId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      closeDialog();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quizzes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      setDeleteTarget(null);
    },
  });
  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) => api.patch(`/quizzes/${id}`, { isPublished }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quizzes'] }),
  });

  function closeDialog() {
    setOpen(false);
    setEditingId(null);
    setLocked(false);
    setForm(EMPTY_QUIZ_FORM);
    setError(null);
  }

  function openAdd() {
    setEditingId(null);
    setLocked(false);
    setForm(EMPTY_QUIZ_FORM);
    setError(null);
    setOpen(true);
  }

  async function openEdit(row: Quiz) {
    setError(null);
    try {
      const full = await api.get<Quiz>(`/quizzes/${row.id}`);
      setEditingId(full.id);
      setLocked(full.isPublished || (full._count?.attempts ?? 0) > 0);
      setForm({
        subjectId: full.subjectId ?? '',
        classId: full.classId ?? '',
        sectionId: full.sectionId ?? '',
        title: full.title,
        description: full.description ?? '',
        timeLimitMinutes: full.timeLimitMinutes ? String(full.timeLimitMinutes) : '',
        questions: (full.questions ?? []).map((q) => ({
          type: q.type,
          text: q.text,
          options: q.options && q.options.length ? q.options : ['', ''],
          correctIndex: Number(q.correctAnswer) || 0,
          marks: String(q.marks),
        })),
      });
      setOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load this quiz');
    }
  }

  function addQuestion() {
    setForm((f) => ({ ...f, questions: [...f.questions, { ...EMPTY_QUESTION, options: ['', '', '', ''] }] }));
  }
  function removeQuestion(index: number) {
    setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index) }));
  }
  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setForm((f) => ({ ...f, questions: f.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) }));
  }
  function addOption(qIndex: number) {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ''] } : q)),
    }));
  }
  function removeOption(qIndex: number, oIndex: number) {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => {
        if (i !== qIndex) return q;
        const options = q.options.filter((_, oi) => oi !== oIndex);
        const correctIndex = q.correctIndex >= options.length ? 0 : q.correctIndex;
        return { ...q, options, correctIndex };
      }),
    }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError('Please enter a quiz title.');
    if (!form.questions.length) return setError('Add at least one question.');
    for (const q of form.questions) {
      if (!q.text.trim()) return setError('Every question needs its text filled in.');
      if (q.type === 'MCQ' && q.options.filter((o) => o.trim()).length < 2) {
        return setError('Every multiple-choice question needs at least 2 options.');
      }
    }

    const questions = form.questions.map((q) => ({
      type: q.type,
      text: q.text,
      options: q.type === 'MCQ' ? q.options.filter((o) => o.trim()) : undefined,
      correctAnswer: String(q.correctIndex),
      marks: Number(q.marks) || 1,
    }));

    const meta = {
      subjectId: form.subjectId || undefined,
      classId: form.classId || undefined,
      sectionId: form.sectionId || undefined,
      title: form.title,
      description: form.description || undefined,
      timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : undefined,
    };

    if (editingId) {
      updateMutation.mutate(locked ? meta : { ...meta, questions });
    } else {
      createMutation.mutate({ ...meta, schoolId: undefined, questions });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Quiz
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {quizzesQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !quizzesQuery.data?.length ? (
            <EmptyState icon={ClipboardList} label="No quizzes yet" hint="Create one for students to take online." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizzesQuery.data.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{q.title}</span>
                      {q.subject && <p className="text-xs text-muted-foreground">{q.subject.name}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {q.section ? `${q.class?.name ?? ''} - ${q.section.name}` : q.class ? q.class.name : 'Whole school'}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{q._count?.questions ?? 0}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{q._count?.attempts ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={q.isPublished ? 'success' : 'secondary'}>{q.isPublished ? 'Published' : 'Draft'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={publishMutation.isPending}
                          onClick={() => publishMutation.mutate({ id: q.id, isPublished: !q.isPublished })}
                        >
                          {q.isPublished ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRosterTarget(q)}>
                          <Users className="h-4 w-4" />
                          Results
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(q)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(q)}
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

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Quiz' : 'Add Quiz'}</DialogTitle>
            <DialogDescription>
              {locked
                ? 'This quiz is published or already has attempts, so its questions are locked — you can still edit the title, description and scope.'
                : 'Build the quiz questions below. Students see this once you publish it.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Subject">
                <Select value={form.subjectId || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, subjectId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Any subject</SelectItem>
                    {(subjectsQuery.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Class">
                <Select
                  value={form.classId || '__none__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, classId: v === '__none__' ? '' : v, sectionId: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Whole school" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Whole school</SelectItem>
                    {(classesQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Section">
                <Select
                  value={form.sectionId || '__none__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, sectionId: v === '__none__' ? '' : v }))}
                  disabled={!form.classId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Every section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Every section</SelectItem>
                    {(sectionsQuery.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Title" required>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Chapter 3 Quick Check" required />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Description">
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </Field>
              <Field label="Time limit (minutes)">
                <Input
                  type="number"
                  min={1}
                  value={form.timeLimitMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, timeLimitMinutes: e.target.value }))}
                  placeholder="No limit"
                />
              </Field>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Questions</Label>
                {!locked && (
                  <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="h-4 w-4" />
                    Add Question
                  </Button>
                )}
              </div>

              {form.questions.map((q, qi) => (
                <div key={qi} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="mt-2 text-xs font-medium text-muted-foreground">Q{qi + 1}</span>
                    {!locked && form.questions.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeQuestion(qi)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <Field label="Question text">
                      <Input value={q.text} onChange={(e) => updateQuestion(qi, { text: e.target.value })} disabled={locked} required />
                    </Field>
                    <Field label="Type">
                      <Select
                        value={q.type}
                        onValueChange={(v) => updateQuestion(qi, { type: v as QuizQuestionType, correctIndex: 0, options: v === 'TRUE_FALSE' ? ['True', 'False'] : ['', '', '', ''] })}
                        disabled={locked}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MCQ">Multiple Choice</SelectItem>
                          <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Marks">
                      <Input type="number" min={1} className="w-20" value={q.marks} onChange={(e) => updateQuestion(qi, { marks: e.target.value })} disabled={locked} />
                    </Field>
                  </div>

                  {q.type === 'TRUE_FALSE' ? (
                    <div className="flex gap-4 pl-1">
                      {['True', 'False'].map((label, oi) => (
                        <label key={label} className="flex items-center gap-2 text-sm text-foreground">
                          <input type="radio" className="h-4 w-4 accent-primary" checked={q.correctIndex === oi} onChange={() => updateQuestion(qi, { correctIndex: oi })} disabled={locked} />
                          {label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5 pl-1">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="radio" className="h-4 w-4 shrink-0 accent-primary" checked={q.correctIndex === oi} onChange={() => updateQuestion(qi, { correctIndex: oi })} disabled={locked} />
                          <Input
                            value={opt}
                            onChange={(e) =>
                              updateQuestion(qi, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })
                            }
                            placeholder={`Option ${oi + 1}`}
                            disabled={locked}
                          />
                          {!locked && q.options.length > 2 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(qi, oi)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {!locked && (
                        <Button type="button" variant="outline" size="sm" onClick={() => addOption(qi)}>
                          <Plus className="h-4 w-4" />
                          Add Option
                        </Button>
                      )}
                    </div>
                  )}
                  <p className="pl-1 text-xs text-muted-foreground">Select the radio button next to the correct answer.</p>
                </div>
              ))}
            </div>

            {error && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" loading={editingId ? updateMutation.isPending : createMutation.isPending}>
                {editingId ? 'Save Changes' : 'Create Quiz'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {rosterTarget && <QuizRosterDialog quiz={rosterTarget} open={!!rosterTarget} onOpenChange={(o) => !o && setRosterTarget(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete quiz?"
        description={`This will remove "${deleteTarget?.title}" and any attempts students have made on it.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function QuizRosterDialog({ quiz, open, onOpenChange }: { quiz: Quiz; open: boolean; onOpenChange: (open: boolean) => void }) {
  const rosterQuery = useQuery({
    queryKey: ['quiz-attempts', quiz.id],
    queryFn: () => api.get<QuizAttemptRosterEntry[]>(`/quizzes/${quiz.id}/attempts`),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{quiz.title} — Results</DialogTitle>
          <DialogDescription>Every student attempt on this quiz.</DialogDescription>
        </DialogHeader>
        {rosterQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !rosterQuery.data?.length ? (
          <EmptyState icon={Users} label="No attempts yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rosterQuery.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">{a.student.user.fullName}</span>
                    <p className="text-xs text-muted-foreground">{a.student.admissionNo}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.status === 'SUBMITTED' ? 'success' : 'secondary'}>{a.status === 'SUBMITTED' ? 'Submitted' : 'In Progress'}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{a.score != null ? `${a.score} / ${a.totalMarks}` : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STUDENT SIDE
// ─────────────────────────────────────────────────────────────────────────

function StudentQuizzesView() {
  const queryClient = useQueryClient();
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [resultQuizId, setResultQuizId] = useState<string | null>(null);

  const availableQuery = useQuery({ queryKey: ['quizzes-available'], queryFn: () => api.get<AvailableQuiz[]>('/quizzes/available') });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          {availableQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !availableQuery.data?.length ? (
            <EmptyState icon={ClipboardList} label="No quizzes available right now" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Time Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableQuery.data.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{q.title}</span>
                      {q.subject && <p className="text-xs text-muted-foreground">{q.subject.name}</p>}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{q.questionCount}</TableCell>
                    <TableCell className="text-muted-foreground">{q.timeLimitMinutes ? `${q.timeLimitMinutes} min` : 'No limit'}</TableCell>
                    <TableCell>
                      {q.myAttempt?.status === 'SUBMITTED' ? (
                        <Badge variant="success">
                          Submitted — {q.myAttempt.score}/{q.myAttempt.totalMarks}
                        </Badge>
                      ) : q.myAttempt?.status === 'IN_PROGRESS' ? (
                        <Badge variant="warning">In Progress</Badge>
                      ) : (
                        <Badge variant="secondary">Not started</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {q.myAttempt?.status === 'SUBMITTED' ? (
                        <Button variant="ghost" size="sm" onClick={() => setResultQuizId(q.id)}>
                          View Result
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setActiveQuizId(q.id)}>
                          <Play className="h-4 w-4" />
                          {q.myAttempt?.status === 'IN_PROGRESS' ? 'Resume' : 'Start'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {activeQuizId && (
        <TakeQuizDialog
          quizId={activeQuizId}
          open={!!activeQuizId}
          onOpenChange={(o) => !o && setActiveQuizId(null)}
          onSubmitted={() => {
            queryClient.invalidateQueries({ queryKey: ['quizzes-available'] });
            setResultQuizId(activeQuizId);
            setActiveQuizId(null);
          }}
        />
      )}

      {resultQuizId && <QuizResultDialog quizId={resultQuizId} open={!!resultQuizId} onOpenChange={(o) => !o && setResultQuizId(null)} />}
    </div>
  );
}

function TakeQuizDialog({
  quizId,
  open,
  onOpenChange,
  onSubmitted,
}: {
  quizId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const [data, setData] = useState<QuizAttemptStart | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api
      .post<QuizAttemptStart>(`/quizzes/${quizId}/attempts/start`)
      .then((d) => setData(d))
      .catch((err) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'))
      .finally(() => setLoading(false));
  }, [open, quizId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/quizzes/${quizId}/attempts/submit`, {
        answers: Object.entries(answers).map(([questionId, responseText]) => ({ questionId, responseText })),
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{data?.quiz.title ?? 'Quiz'}</DialogTitle>
          <DialogDescription>
            {data?.quiz.timeLimitMinutes ? `Time limit: ${data.quiz.timeLimitMinutes} minutes. ` : ''}
            Answer every question, then submit — you can't change your answers afterward.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {data?.quiz.questions.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium text-foreground">
                  {i + 1}. {q.text} <span className="text-xs font-normal text-muted-foreground">({q.marks} marks)</span>
                </p>
                <div className="mt-2 space-y-1.5">
                  {(q.options ?? []).map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        className="h-4 w-4 accent-primary"
                        name={q.id}
                        checked={answers[q.id] === String(oi)}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: String(oi) }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} loading={submitting} disabled={!data}>
            Submit Quiz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuizResultDialog({ quizId, open, onOpenChange }: { quizId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const resultQuery = useQuery({
    queryKey: ['quiz-result', quizId],
    queryFn: () => api.get<QuizResult>(`/quizzes/${quizId}/attempts/me`),
    enabled: open,
  });
  const result = resultQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{result?.quizTitle ?? 'Quiz Result'}</DialogTitle>
          {result && (
            <DialogDescription>
              Score: <span className="font-medium text-foreground">{result.score}</span> / {result.totalMarks}
            </DialogDescription>
          )}
        </DialogHeader>
        {resultQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {result?.questions.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {i + 1}. {q.text}
                  </p>
                  {q.isCorrect ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your answer: {q.yourAnswer != null && q.options ? q.options[Number(q.yourAnswer)] ?? '—' : 'Not answered'}
                </p>
                {!q.isCorrect && q.correctAnswer != null && q.options && (
                  <p className="text-xs text-success">Correct answer: {q.options[Number(q.correctAnswer)]}</p>
                )}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
