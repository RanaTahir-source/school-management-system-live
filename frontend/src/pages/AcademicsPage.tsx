import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Layers, Pencil, Plus, Rows3, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
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
import { formatDate } from '@/lib/utils';
import type { School, ClassRecord, SectionRecord, AcademicYear, TeacherProfile } from '@/types';

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

function EmptyState({ icon: Icon, label }: { icon: typeof CalendarRange; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

export default function AcademicsPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools') });
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => api.get<AcademicYear[]>('/academic-years') });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassRecord[]>('/classes') });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: () => api.get<SectionRecord[]>('/sections') });
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: () => api.get<TeacherProfile[]>('/teachers') });

  // ---- Academic Year dialog ----
  const [yearOpen, setYearOpen] = useState(false);
  const [yearForm, setYearForm] = useState({ schoolId: '', name: '', startDate: '', endDate: '' });
  const [yearError, setYearError] = useState<string | null>(null);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [deleteYearTarget, setDeleteYearTarget] = useState<AcademicYear | null>(null);
  const createYear = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/academic-years', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setYearOpen(false);
      setYearForm({ schoolId: '', name: '', startDate: '', endDate: '' });
      setYearError(null);
    },
    onError: (err: unknown) => setYearError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateYear = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/academic-years/${editingYearId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setYearOpen(false);
      setEditingYearId(null);
      setYearForm({ schoolId: '', name: '', startDate: '', endDate: '' });
      setYearError(null);
    },
    onError: (err: unknown) => setYearError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deleteYear = useMutation({
    mutationFn: (id: string) => api.delete(`/academic-years/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setDeleteYearTarget(null);
    },
  });

  // ---- Class dialog ----
  const [classOpen, setClassOpen] = useState(false);
  const [classForm, setClassForm] = useState({ schoolId: '', branchId: '', name: '', order: '' });
  const [classError, setClassError] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [deleteClassTarget, setDeleteClassTarget] = useState<ClassRecord | null>(null);
  const createClass = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/classes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setClassOpen(false);
      setClassForm({ schoolId: '', branchId: '', name: '', order: '' });
      setClassError(null);
    },
    onError: (err: unknown) => setClassError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateClass = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/classes/${editingClassId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setClassOpen(false);
      setEditingClassId(null);
      setClassForm({ schoolId: '', branchId: '', name: '', order: '' });
      setClassError(null);
    },
    onError: (err: unknown) => setClassError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deleteClass = useMutation({
    mutationFn: (id: string) => api.delete(`/classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setDeleteClassTarget(null);
    },
  });

  // ---- Section dialog ----
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState({
    classId: '',
    academicYearId: '',
    name: '',
    capacity: '',
    classTeacherId: '',
  });
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<SectionRecord | null>(null);
  const createSection = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/sections', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      setSectionOpen(false);
      setSectionForm({ classId: '', academicYearId: '', name: '', capacity: '', classTeacherId: '' });
      setSectionError(null);
    },
    onError: (err: unknown) => setSectionError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateSection = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/sections/${editingSectionId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      setSectionOpen(false);
      setEditingSectionId(null);
      setSectionForm({ classId: '', academicYearId: '', name: '', capacity: '', classTeacherId: '' });
      setSectionError(null);
    },
    onError: (err: unknown) => setSectionError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deleteSection = useMutation({
    mutationFn: (id: string) => api.delete(`/sections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      setDeleteSectionTarget(null);
    },
  });

  const yearSchoolBranches = useMemo(() => {
    const school = schoolsQuery.data?.find((s) => s.id === (isUnrestricted ? classForm.schoolId : user?.schoolId));
    return school?.branches ?? [];
  }, [schoolsQuery.data, classForm.schoolId, isUnrestricted, user?.schoolId]);

  function openYearDialog() {
    setEditingYearId(null);
    setYearForm({ schoolId: isUnrestricted ? '' : user?.schoolId ?? '', name: '', startDate: '', endDate: '' });
    setYearError(null);
    setYearOpen(true);
  }
  function openEditYearDialog(year: AcademicYear) {
    setEditingYearId(year.id);
    setYearForm({
      schoolId: year.schoolId,
      name: year.name,
      startDate: year.startDate.slice(0, 10),
      endDate: year.endDate.slice(0, 10),
    });
    setYearError(null);
    setYearOpen(true);
  }
  function submitYear(e: FormEvent) {
    e.preventDefault();
    setYearError(null);
    const effectiveSchoolId = isUnrestricted ? yearForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !yearForm.name || !yearForm.startDate || !yearForm.endDate) {
      setYearError('Please fill all required fields.');
      return;
    }
    if (editingYearId) {
      updateYear.mutate({
        name: yearForm.name,
        startDate: yearForm.startDate,
        endDate: yearForm.endDate,
      });
    } else {
      createYear.mutate({
        schoolId: effectiveSchoolId,
        name: yearForm.name,
        startDate: yearForm.startDate,
        endDate: yearForm.endDate,
      });
    }
  }

  function openClassDialog() {
    setEditingClassId(null);
    setClassForm({ schoolId: isUnrestricted ? '' : user?.schoolId ?? '', branchId: '', name: '', order: '' });
    setClassError(null);
    setClassOpen(true);
  }
  function openEditClassDialog(c: ClassRecord) {
    setEditingClassId(c.id);
    setClassForm({ schoolId: c.schoolId, branchId: c.branchId, name: c.name, order: String(c.order ?? 0) });
    setClassError(null);
    setClassOpen(true);
  }
  function submitClass(e: FormEvent) {
    e.preventDefault();
    setClassError(null);
    if (editingClassId) {
      if (!classForm.name) {
        setClassError('Please fill all required fields.');
        return;
      }
      updateClass.mutate({
        name: classForm.name,
        order: classForm.order ? Number(classForm.order) : undefined,
      });
      return;
    }
    const effectiveSchoolId = isUnrestricted ? classForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !classForm.branchId || !classForm.name) {
      setClassError('Please fill all required fields.');
      return;
    }
    createClass.mutate({
      schoolId: effectiveSchoolId,
      branchId: classForm.branchId,
      name: classForm.name,
      order: classForm.order ? Number(classForm.order) : undefined,
    });
  }

  function openSectionDialog() {
    setEditingSectionId(null);
    setSectionForm({ classId: '', academicYearId: '', name: '', capacity: '', classTeacherId: '' });
    setSectionError(null);
    setSectionOpen(true);
  }
  function openEditSectionDialog(s: SectionRecord) {
    setEditingSectionId(s.id);
    setSectionForm({
      classId: s.classId,
      academicYearId: s.academicYear?.id ?? '',
      name: s.name,
      capacity: s.capacity !== null && s.capacity !== undefined ? String(s.capacity) : '',
      classTeacherId: s.classTeacher?.id ?? '',
    });
    setSectionError(null);
    setSectionOpen(true);
  }
  function submitSection(e: FormEvent) {
    e.preventDefault();
    setSectionError(null);
    if (editingSectionId) {
      if (!sectionForm.name) {
        setSectionError('Please fill all required fields.');
        return;
      }
      updateSection.mutate({
        name: sectionForm.name,
        capacity: sectionForm.capacity ? Number(sectionForm.capacity) : undefined,
        classTeacherId: sectionForm.classTeacherId || undefined,
      });
      return;
    }
    if (!sectionForm.classId || !sectionForm.academicYearId || !sectionForm.name) {
      setSectionError('Please fill all required fields.');
      return;
    }
    createSection.mutate({
      classId: sectionForm.classId,
      academicYearId: sectionForm.academicYearId,
      name: sectionForm.name,
      capacity: sectionForm.capacity ? Number(sectionForm.capacity) : undefined,
      classTeacherId: sectionForm.classTeacherId || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Academics</h2>
        <p className="mt-1 text-sm text-muted-foreground">Academic years, classes and sections</p>
      </div>

      <Tabs defaultValue="years">
        <TabsList>
          <TabsTrigger value="years">Academic Years</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
        </TabsList>

        <TabsContent value="years">
          <div className="mb-3 flex justify-end">
            {canManage && (
              <Button onClick={openYearDialog}>
                <Plus className="h-4 w-4" />
                Add Academic Year
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {yearsQuery.isLoading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !yearsQuery.data?.length ? (
                <EmptyState icon={CalendarRange} label="No academic years yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                      {canManage && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearsQuery.data.map((y) => (
                      <TableRow key={y.id}>
                        <TableCell className="font-medium text-foreground">{y.name}</TableCell>
                        <TableCell className="text-muted-foreground">{y.school?.name ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(y.startDate)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(y.endDate)}</TableCell>
                        <TableCell>
                          <Badge variant={y.isActive ? 'success' : 'secondary'}>
                            {y.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditYearDialog(y)}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Button>
                              {isUnrestricted && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeleteYearTarget(y)}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes">
          <div className="mb-3 flex justify-end">
            {canManage && (
              <Button onClick={openClassDialog}>
                <Plus className="h-4 w-4" />
                Add Class
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {classesQuery.isLoading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !classesQuery.data?.length ? (
                <EmptyState icon={Layers} label="No classes yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      {canManage && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classesQuery.data.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.school?.name ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{c.branch?.name ?? '—'}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{c.order}</TableCell>
                        <TableCell>
                          <Badge variant={c.isActive ? 'success' : 'secondary'}>
                            {c.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditClassDialog(c)}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Button>
                              {isUnrestricted && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeleteClassTarget(c)}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections">
          <div className="mb-3 flex justify-end">
            {canManage && (
              <Button onClick={openSectionDialog}>
                <Plus className="h-4 w-4" />
                Add Section
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              {sectionsQuery.isLoading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !sectionsQuery.data?.length ? (
                <EmptyState icon={Rows3} label="No sections yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Academic Year</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Class Teacher</TableHead>
                      <TableHead>Students</TableHead>
                      {canManage && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectionsQuery.data.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.class?.name ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{s.academicYear?.name ?? '—'}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{s.capacity ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{s.classTeacher?.fullName ?? '—'}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{s.students?.length ?? 0}</TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditSectionDialog(s)}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Button>
                              {isUnrestricted && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeleteSectionTarget(s)}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Academic Year dialog */}
      <Dialog
        open={yearOpen}
        onOpenChange={(open) => {
          setYearOpen(open);
          if (!open) setEditingYearId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingYearId ? 'Edit Academic Year' : 'Add Academic Year'}</DialogTitle>
            <DialogDescription>Define a school year with its start and end dates.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitYear} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select
                  value={yearForm.schoolId}
                  onValueChange={(v) => setYearForm((f) => ({ ...f, schoolId: v }))}
                  disabled={!!editingYearId}
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
            <Field label="Name" required>
              <Input
                value={yearForm.name}
                onChange={(e) => setYearForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 2026-2027"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date" required>
                <Input
                  type="date"
                  value={yearForm.startDate}
                  onChange={(e) => setYearForm((f) => ({ ...f, startDate: e.target.value }))}
                  required
                />
              </Field>
              <Field label="End date" required>
                <Input
                  type="date"
                  value={yearForm.endDate}
                  onChange={(e) => setYearForm((f) => ({ ...f, endDate: e.target.value }))}
                  required
                />
              </Field>
            </div>
            {yearError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {yearError}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setYearOpen(false);
                  setEditingYearId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingYearId ? updateYear.isPending : createYear.isPending}>
                {editingYearId ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteYearTarget}
        onOpenChange={(open) => !open && setDeleteYearTarget(null)}
        title="Delete academic year?"
        description={`This will permanently remove "${deleteYearTarget?.name}". Classes, sections, or records linked to this year may be affected.`}
        confirmLabel="Delete"
        loading={deleteYear.isPending}
        onConfirm={() => deleteYearTarget && deleteYear.mutate(deleteYearTarget.id)}
      />

      {/* Class dialog */}
      <Dialog
        open={classOpen}
        onOpenChange={(open) => {
          setClassOpen(open);
          if (!open) setEditingClassId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClassId ? 'Edit Class' : 'Add Class'}</DialogTitle>
            <DialogDescription>
              {editingClassId ? 'Update this class\'s name or display order.' : 'Create a class under a school branch.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitClass} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select
                  value={classForm.schoolId}
                  onValueChange={(v) => setClassForm((f) => ({ ...f, schoolId: v, branchId: '' }))}
                  disabled={!!editingClassId}
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
            <Field label="Branch" required>
              <Select
                value={classForm.branchId}
                onValueChange={(v) => setClassForm((f) => ({ ...f, branchId: v }))}
                disabled={!!editingClassId || !yearSchoolBranches.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {yearSchoolBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Class name" required>
              <Input
                value={classForm.name}
                onChange={(e) => setClassForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Class 4"
                required
              />
            </Field>
            <Field label="Display order">
              <Input
                type="number"
                value={classForm.order}
                onChange={(e) => setClassForm((f) => ({ ...f, order: e.target.value }))}
                placeholder="e.g. 6"
              />
            </Field>
            {classError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {classError}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setClassOpen(false);
                  setEditingClassId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingClassId ? updateClass.isPending : createClass.isPending}>
                {editingClassId ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteClassTarget}
        onOpenChange={(open) => !open && setDeleteClassTarget(null)}
        title="Delete this class?"
        description={`This will permanently remove "${deleteClassTarget?.name}". Sections under this class may be affected.`}
        confirmLabel="Delete"
        loading={deleteClass.isPending}
        onConfirm={() => deleteClassTarget && deleteClass.mutate(deleteClassTarget.id)}
      />

      {/* Section dialog */}
      <Dialog
        open={sectionOpen}
        onOpenChange={(open) => {
          setSectionOpen(open);
          if (!open) setEditingSectionId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSectionId ? 'Edit Section' : 'Add Section'}</DialogTitle>
            <DialogDescription>
              {editingSectionId
                ? "Update this section's name, capacity, or class teacher."
                : 'Create a section under a class for a given academic year.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitSection} className="space-y-4">
            <Field label="Class" required>
              <Select
                value={sectionForm.classId}
                onValueChange={(v) => setSectionForm((f) => ({ ...f, classId: v }))}
                disabled={!!editingSectionId}
              >
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
            </Field>
            <Field label="Academic year" required>
              <Select
                value={sectionForm.academicYearId}
                onValueChange={(v) => setSectionForm((f) => ({ ...f, academicYearId: v }))}
                disabled={!!editingSectionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {(yearsQuery.data ?? []).map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Section name" required>
              <Input
                value={sectionForm.name}
                onChange={(e) => setSectionForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. A"
                required
              />
            </Field>
            <Field label="Capacity">
              <Input
                type="number"
                value={sectionForm.capacity}
                onChange={(e) => setSectionForm((f) => ({ ...f, capacity: e.target.value }))}
                placeholder="e.g. 30"
              />
            </Field>
            <Field label="Class teacher">
              <Select
                value={sectionForm.classTeacherId}
                onValueChange={(v) => setSectionForm((f) => ({ ...f, classTeacherId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {(teachersQuery.data ?? []).map((t) => (
                    <SelectItem key={t.user.id} value={t.user.id}>
                      {t.user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {sectionError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {sectionError}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSectionOpen(false);
                  setEditingSectionId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingSectionId ? updateSection.isPending : createSection.isPending}>
                {editingSectionId ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteSectionTarget}
        onOpenChange={(open) => !open && setDeleteSectionTarget(null)}
        title="Delete this section?"
        description={`This will permanently remove "${deleteSectionTarget?.name}". Students enrolled in this section may be affected.`}
        confirmLabel="Delete"
        loading={deleteSection.isPending}
        onConfirm={() => deleteSectionTarget && deleteSection.mutate(deleteSectionTarget.id)}
      />
    </div>
  );
}
