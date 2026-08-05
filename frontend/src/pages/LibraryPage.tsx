import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, BookMarked, FileText, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
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
  ClassRecord,
  Subject,
  StudentProfile,
  TeacherProfile,
  Book,
  BookIssue,
  StudyMaterial,
  MaterialType,
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

const bookForm0 = { schoolId: '', title: '', author: '', isbn: '', category: '', shelfLocation: '', totalCopies: '1' };
const materialForm0 = { schoolId: '', classId: '', subjectId: '', title: '', description: '', fileUrl: '', type: 'DOCUMENT' as MaterialType };

export default function LibraryPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const canDelete = hasRole('DIRECTOR', 'ADMIN');
  const canShareMaterial = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER');

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools') });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassRecord[]>('/classes') });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: () => api.get<Subject[]>('/subjects') });

  const schoolName = (id: string) => schoolsQuery.data?.find((s) => s.id === id)?.name ?? '—';

  // ─────────────────────────── Catalog tab ───────────────────────────
  const [search, setSearch] = useState('');
  const booksQuery = useQuery({
    queryKey: ['library', 'books', search],
    queryFn: () => api.get<Book[]>('/library/books', { search: search || undefined }),
  });

  const [bookOpen, setBookOpen] = useState(false);
  const [bookForm, setBookForm] = useState(bookForm0);
  const [bookError, setBookError] = useState<string | null>(null);
  const [deactivateBook, setDeactivateBook] = useState<Book | null>(null);

  const createBook = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/library/books', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', 'books'] });
      setBookOpen(false);
      setBookForm(bookForm0);
      setBookError(null);
    },
    onError: (err: unknown) => setBookError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const deactivateBookMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/library/books/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', 'books'] });
      setDeactivateBook(null);
    },
  });

  function openBookDialog() {
    setBookForm({ ...bookForm0, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setBookError(null);
    setBookOpen(true);
  }
  function submitBook(e: FormEvent) {
    e.preventDefault();
    setBookError(null);
    const effectiveSchoolId = isUnrestricted ? bookForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !bookForm.title) {
      setBookError('Please fill all required fields.');
      return;
    }
    createBook.mutate({
      schoolId: effectiveSchoolId,
      title: bookForm.title,
      author: bookForm.author || undefined,
      isbn: bookForm.isbn || undefined,
      category: bookForm.category || undefined,
      shelfLocation: bookForm.shelfLocation || undefined,
      totalCopies: bookForm.totalCopies ? Number(bookForm.totalCopies) : undefined,
    });
  }

  // ─────────────────────────── Issued Books tab ───────────────────────────
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => api.get<StudentProfile[]>('/students'),
    enabled: canManage,
  });
  const teachersQuery = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.get<TeacherProfile[]>('/teachers'),
    enabled: canManage,
  });
  const borrowerOptions = useMemo(() => {
    const students = (studentsQuery.data ?? []).map((s) => ({
      userId: s.user.id,
      label: `${s.user.fullName} — ${s.admissionNo} (Student)`,
    }));
    const teachers = (teachersQuery.data ?? []).map((t) => ({
      userId: t.user.id,
      label: `${t.user.fullName} (Staff)`,
    }));
    return [...students, ...teachers];
  }, [studentsQuery.data, teachersQuery.data]);

  const [issueStatusFilter, setIssueStatusFilter] = useState('');
  const issuesQuery = useQuery({
    queryKey: ['library', 'issues', issueStatusFilter],
    queryFn: () => api.get<BookIssue[]>('/library/issues', { status: issueStatusFilter || undefined }),
    enabled: canManage,
  });

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ bookId: '', borrowerId: '', dueDate: '' });
  const [issueError, setIssueError] = useState<string | null>(null);
  const [returnTarget, setReturnTarget] = useState<BookIssue | null>(null);
  const [lostTarget, setLostTarget] = useState<BookIssue | null>(null);

  const issueBook = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/library/issues', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', 'issues'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'books'] });
      setIssueOpen(false);
      setIssueForm({ bookId: '', borrowerId: '', dueDate: '' });
      setIssueError(null);
    },
    onError: (err: unknown) => setIssueError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const returnBook = useMutation({
    mutationFn: (id: string) => api.patch(`/library/issues/${id}/return`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', 'issues'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'books'] });
      setReturnTarget(null);
    },
  });

  const markLost = useMutation({
    mutationFn: (id: string) => api.patch(`/library/issues/${id}/lost`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', 'issues'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'books'] });
      setLostTarget(null);
    },
  });

  const settleFine = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'PAID' | 'WAIVED' }) =>
      api.patch(`/library/issues/${id}/settle-fine`, { action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library', 'issues'] }),
  });

  function openIssueDialog() {
    setIssueForm({ bookId: '', borrowerId: '', dueDate: '' });
    setIssueError(null);
    setIssueOpen(true);
  }
  function submitIssue(e: FormEvent) {
    e.preventDefault();
    setIssueError(null);
    if (!issueForm.bookId || !issueForm.borrowerId || !issueForm.dueDate) {
      setIssueError('Please fill all required fields.');
      return;
    }
    issueBook.mutate(issueForm);
  }

  // ─────────────────────────── My Books tab ───────────────────────────
  const myBooksQuery = useQuery({ queryKey: ['library', 'issues', 'mine'], queryFn: () => api.get<BookIssue[]>('/library/issues/mine') });

  // ─────────────────────────── Study Materials tab ───────────────────────────
  const [materialClassFilter, setMaterialClassFilter] = useState('');
  const materialsQuery = useQuery({
    queryKey: ['library', 'materials', materialClassFilter],
    queryFn: () => api.get<StudyMaterial[]>('/library/materials', { classId: materialClassFilter || undefined }),
  });

  const [materialOpen, setMaterialOpen] = useState(false);
  const [materialForm, setMaterialForm] = useState(materialForm0);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [deleteMaterial, setDeleteMaterial] = useState<StudyMaterial | null>(null);

  const createMaterial = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/library/materials', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', 'materials'] });
      setMaterialOpen(false);
      setMaterialForm(materialForm0);
      setMaterialError(null);
    },
    onError: (err: unknown) => setMaterialError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const removeMaterial = useMutation({
    mutationFn: (id: string) => api.delete(`/library/materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library', 'materials'] });
      setDeleteMaterial(null);
    },
  });

  function openMaterialDialog() {
    setMaterialForm({ ...materialForm0, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setMaterialError(null);
    setMaterialOpen(true);
  }
  function submitMaterial(e: FormEvent) {
    e.preventDefault();
    setMaterialError(null);
    const effectiveSchoolId = isUnrestricted ? materialForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !materialForm.title || !materialForm.fileUrl) {
      setMaterialError('Please fill all required fields.');
      return;
    }
    createMaterial.mutate({
      schoolId: effectiveSchoolId,
      classId: materialForm.classId || undefined,
      subjectId: materialForm.subjectId || undefined,
      title: materialForm.title,
      description: materialForm.description || undefined,
      fileUrl: materialForm.fileUrl,
      type: materialForm.type,
    });
  }

  const STATUS_VARIANT: Record<string, 'secondary' | 'success' | 'destructive'> = {
    ISSUED: 'secondary',
    RETURNED: 'success',
    LOST: 'destructive',
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Library</h2>
        <p className="mt-1 text-sm text-muted-foreground">Book catalog, issue/return tracking, and shared study material.</p>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          {canManage && <TabsTrigger value="issues">Issued Books</TabsTrigger>}
          <TabsTrigger value="mine">My Books</TabsTrigger>
          <TabsTrigger value="materials">Study Materials</TabsTrigger>
        </TabsList>

        {/* ── Catalog ── */}
        <TabsContent value="catalog">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full sm:max-w-xs">
                <Field label="Search">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, author, ISBN..." />
                </Field>
              </div>
              {canManage && (
                <Button onClick={openBookDialog}>
                  <Plus className="h-4 w-4" />
                  Add Book
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {booksQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !booksQuery.data?.length ? (
                <EmptyState icon={BookOpen} label="No books found" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Copies</TableHead>
                      <TableHead>Status</TableHead>
                      {canDelete && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {booksQuery.data.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium text-foreground">{b.title}</TableCell>
                        <TableCell className="text-muted-foreground">{b.author ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{b.category ?? '—'}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {b.availableCopies} / {b.totalCopies}
                        </TableCell>
                        <TableCell>
                          <Badge variant={b.isActive ? 'success' : 'secondary'}>{b.isActive ? 'Active' : 'Inactive'}</Badge>
                        </TableCell>
                        {canDelete && (
                          <TableCell className="text-right">
                            {b.isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setDeactivateBook(b)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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

        {/* ── Issued Books ── */}
        {canManage && (
          <TabsContent value="issues">
            <Card>
              <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full sm:max-w-xs">
                  <Field label="Status">
                    <Select value={issueStatusFilter || '__all__'} onValueChange={(v) => setIssueStatusFilter(v === '__all__' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Every status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Every status</SelectItem>
                        <SelectItem value="ISSUED">Issued</SelectItem>
                        <SelectItem value="RETURNED">Returned</SelectItem>
                        <SelectItem value="LOST">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Button onClick={openIssueDialog}>
                  <Plus className="h-4 w-4" />
                  Issue Book
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {issuesQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !issuesQuery.data?.length ? (
                  <EmptyState icon={BookMarked} label="No issued books found" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Book</TableHead>
                        <TableHead>Borrower</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Fine</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issuesQuery.data.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium text-foreground">{i.book?.title}</TableCell>
                          <TableCell className="text-muted-foreground">{i.borrower?.fullName}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(i.dueDate)}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[i.status]}>{i.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {Number(i.fineAmount) > 0 ? (
                              <span className="flex items-center gap-2">
                                Rs. {i.fineAmount}
                                {i.fineWaived ? (
                                  <Badge variant="secondary">Waived</Badge>
                                ) : i.finePaid ? (
                                  <Badge variant="success">Paid</Badge>
                                ) : (
                                  <span className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => settleFine.mutate({ id: i.id, action: 'PAID' })}>
                                      Mark Paid
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => settleFine.mutate({ id: i.id, action: 'WAIVED' })}>
                                      Waive
                                    </Button>
                                  </span>
                                )}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {i.status === 'ISSUED' && (
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setReturnTarget(i)}>
                                  <RotateCcw className="h-4 w-4" />
                                  Return
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setLostTarget(i)}
                                >
                                  <TriangleAlert className="h-4 w-4" />
                                  Lost
                                </Button>
                              </div>
                            )}
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

        {/* ── My Books ── */}
        <TabsContent value="mine">
          <Card>
            <CardContent className="pt-6">
              {myBooksQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !myBooksQuery.data?.length ? (
                <EmptyState icon={BookMarked} label="You haven't borrowed any books" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Book</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fine</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myBooksQuery.data.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium text-foreground">{i.book?.title}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(i.issueDate)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(i.dueDate)}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[i.status]}>{i.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {Number(i.fineAmount) > 0 ? `Rs. ${i.fineAmount}${i.finePaid ? ' (Paid)' : i.fineWaived ? ' (Waived)' : ''}` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Study Materials ── */}
        <TabsContent value="materials">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full sm:max-w-xs">
                <Field label="Class">
                  <Select value={materialClassFilter || '__all__'} onValueChange={(v) => setMaterialClassFilter(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Every class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Every class</SelectItem>
                      {(classesQuery.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {canShareMaterial && (
                <Button onClick={openMaterialDialog}>
                  <Plus className="h-4 w-4" />
                  Share Material
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {materialsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !materialsQuery.data?.length ? (
                <EmptyState icon={FileText} label="No study material shared yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Shared by</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialsQuery.data.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium text-foreground">
                          <a href={m.fileUrl} target="_blank" rel="noreferrer" className="hover:underline">
                            {m.title}
                          </a>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{m.class?.name ?? 'Every class'}</TableCell>
                        <TableCell className="text-muted-foreground">{m.subject?.name ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{m.type}</TableCell>
                        <TableCell className="text-muted-foreground">{m.uploadedBy?.fullName}</TableCell>
                        <TableCell className="text-right">
                          {canShareMaterial && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteMaterial(m)}
                            >
                              <Trash2 className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>

      {/* Add book dialog */}
      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Book</DialogTitle>
            <DialogDescription>Add a title to the library catalog.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitBook} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select value={bookForm.schoolId} onValueChange={(v) => setBookForm((f) => ({ ...f, schoolId: v }))}>
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
            <Field label="Title" required>
              <Input value={bookForm.title} onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Author">
                <Input value={bookForm.author} onChange={(e) => setBookForm((f) => ({ ...f, author: e.target.value }))} />
              </Field>
              <Field label="ISBN">
                <Input value={bookForm.isbn} onChange={(e) => setBookForm((f) => ({ ...f, isbn: e.target.value }))} />
              </Field>
              <Field label="Category">
                <Input value={bookForm.category} onChange={(e) => setBookForm((f) => ({ ...f, category: e.target.value }))} />
              </Field>
              <Field label="Shelf location">
                <Input value={bookForm.shelfLocation} onChange={(e) => setBookForm((f) => ({ ...f, shelfLocation: e.target.value }))} />
              </Field>
            </div>
            <Field label="Total copies">
              <Input type="number" min={1} value={bookForm.totalCopies} onChange={(e) => setBookForm((f) => ({ ...f, totalCopies: e.target.value }))} />
            </Field>
            {bookError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{bookError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBookOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createBook.isPending}>
                Add Book
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Issue book dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Book</DialogTitle>
            <DialogDescription>Hand out a copy to a student or staff member.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitIssue} className="space-y-4">
            <Field label="Book" required>
              <Select value={issueForm.bookId} onValueChange={(v) => setIssueForm((f) => ({ ...f, bookId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select book" />
                </SelectTrigger>
                <SelectContent>
                  {(booksQuery.data ?? [])
                    .filter((b) => b.availableCopies > 0)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.title} ({b.availableCopies} available)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Borrower" required>
              <Select value={issueForm.borrowerId} onValueChange={(v) => setIssueForm((f) => ({ ...f, borrowerId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student or staff" />
                </SelectTrigger>
                <SelectContent>
                  {borrowerOptions.map((b) => (
                    <SelectItem key={b.userId} value={b.userId}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due date" required>
              <Input type="date" value={issueForm.dueDate} onChange={(e) => setIssueForm((f) => ({ ...f, dueDate: e.target.value }))} required />
            </Field>
            {issueError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{issueError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIssueOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={issueBook.isPending}>
                Issue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Share material dialog */}
      <Dialog open={materialOpen} onOpenChange={setMaterialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Study Material</DialogTitle>
            <DialogDescription>Paste a link to a document or video (Google Drive, YouTube, etc.).</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitMaterial} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select value={materialForm.schoolId} onValueChange={(v) => setMaterialForm((f) => ({ ...f, schoolId: v }))}>
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
            <Field label="Title" required>
              <Input value={materialForm.title} onChange={(e) => setMaterialForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            <Field label="Link" required>
              <Input
                type="url"
                value={materialForm.fileUrl}
                onChange={(e) => setMaterialForm((f) => ({ ...f, fileUrl: e.target.value }))}
                placeholder="https://drive.google.com/..."
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Class (optional)">
                <Select value={materialForm.classId || '__all__'} onValueChange={(v) => setMaterialForm((f) => ({ ...f, classId: v === '__all__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Every class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Every class</SelectItem>
                    {(classesQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Subject (optional)">
                <Select value={materialForm.subjectId || '__none__'} onValueChange={(v) => setMaterialForm((f) => ({ ...f, subjectId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="No subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No subject</SelectItem>
                    {(subjectsQuery.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Type">
              <Select value={materialForm.type} onValueChange={(v) => setMaterialForm((f) => ({ ...f, type: v as MaterialType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOCUMENT">Document</SelectItem>
                  <SelectItem value="VIDEO">Video</SelectItem>
                  <SelectItem value="LINK">Link</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {materialError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{materialError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMaterialOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createMaterial.isPending}>
                Share
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateBook}
        onOpenChange={(open) => !open && setDeactivateBook(null)}
        title="Deactivate book?"
        description={`This will mark "${deactivateBook?.title ?? ''}" as inactive in the catalog.`}
        confirmLabel="Deactivate"
        loading={deactivateBookMutation.isPending}
        onConfirm={() => deactivateBook && deactivateBookMutation.mutate(deactivateBook.id)}
      />

      <ConfirmDialog
        open={!!returnTarget}
        onOpenChange={(open) => !open && setReturnTarget(null)}
        title="Return book?"
        description={`Mark "${returnTarget?.book?.title ?? ''}" as returned. A fine is calculated automatically if it's overdue.`}
        confirmLabel="Return"
        loading={returnBook.isPending}
        onConfirm={() => returnTarget && returnBook.mutate(returnTarget.id)}
      />

      <ConfirmDialog
        open={!!lostTarget}
        onOpenChange={(open) => !open && setLostTarget(null)}
        title="Mark book as lost?"
        description={`This permanently removes one copy of "${lostTarget?.book?.title ?? ''}" from the catalog.`}
        confirmLabel="Mark Lost"
        destructive
        loading={markLost.isPending}
        onConfirm={() => lostTarget && markLost.mutate(lostTarget.id)}
      />

      <ConfirmDialog
        open={!!deleteMaterial}
        onOpenChange={(open) => !open && setDeleteMaterial(null)}
        title="Remove study material?"
        description={`This will remove "${deleteMaterial?.title ?? ''}" from the list.`}
        confirmLabel="Remove"
        destructive
        loading={removeMaterial.isPending}
        onConfirm={() => deleteMaterial && removeMaterial.mutate(deleteMaterial.id)}
      />
    </div>
  );
}
