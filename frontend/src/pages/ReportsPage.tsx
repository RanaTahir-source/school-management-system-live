import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, TrendingUp, UserPlus, Users, UsersRound } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import type {
  School,
  ClassRecord,
  AcademicYear,
  AdmissionsReport,
  StudentDirectoryRow,
  StaffDirectoryRow,
  PerformanceTrend,
} from '@/types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 inline-block">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgoIso() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { user, hasRole } = useAuth();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools') });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: () => api.get<ClassRecord[]>('/classes') });
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => api.get<AcademicYear[]>('/academic-years') });

  const [schoolId, setSchoolId] = useState('');
  const effectiveSchoolId = isUnrestricted ? schoolId : user?.schoolId ?? '';
  const classOptions = useMemo(
    () => (classesQuery.data ?? []).filter((c) => !effectiveSchoolId || c.schoolId === effectiveSchoolId),
    [classesQuery.data, effectiveSchoolId],
  );

  // ─────────────────────── Admissions tab ───────────────────────
  const [admFrom, setAdmFrom] = useState(monthAgoIso());
  const [admTo, setAdmTo] = useState(todayIso());
  const [admClassId, setAdmClassId] = useState('');

  const admissionsQuery = useQuery({
    queryKey: ['reports', 'admissions', effectiveSchoolId, admFrom, admTo, admClassId],
    queryFn: () =>
      api.get<AdmissionsReport>('/reports/admissions', {
        schoolId: effectiveSchoolId || undefined,
        from: admFrom,
        to: admTo,
        classId: admClassId || undefined,
      }),
    enabled: !!admFrom && !!admTo,
  });

  function downloadAdmissionsCsv() {
    const params = new URLSearchParams();
    if (effectiveSchoolId) params.set('schoolId', effectiveSchoolId);
    params.set('from', admFrom);
    params.set('to', admTo);
    if (admClassId) params.set('classId', admClassId);
    api.downloadBlob(`/reports/admissions.csv?${params.toString()}`, 'admissions-report.csv');
  }

  // ─────────────────────── Student directory tab ───────────────────────
  const [studClassId, setStudClassId] = useState('');
  const studentsQuery = useQuery({
    queryKey: ['reports', 'students', effectiveSchoolId, studClassId],
    queryFn: () =>
      api.get<StudentDirectoryRow[]>('/reports/students', {
        schoolId: effectiveSchoolId || undefined,
        classId: studClassId || undefined,
      }),
  });

  function downloadStudentsCsv() {
    const params = new URLSearchParams();
    if (effectiveSchoolId) params.set('schoolId', effectiveSchoolId);
    if (studClassId) params.set('classId', studClassId);
    api.downloadBlob(`/reports/students.csv?${params.toString()}`, 'student-directory.csv');
  }

  // ─────────────────────── Staff directory tab ───────────────────────
  const staffQuery = useQuery({
    queryKey: ['reports', 'staff', effectiveSchoolId],
    queryFn: () => api.get<StaffDirectoryRow[]>('/reports/staff', { schoolId: effectiveSchoolId || undefined }),
  });

  function downloadStaffCsv() {
    const params = new URLSearchParams();
    if (effectiveSchoolId) params.set('schoolId', effectiveSchoolId);
    api.downloadBlob(`/reports/staff.csv?${params.toString()}`, 'staff-directory.csv');
  }

  // ─────────────────────── Performance trend tab ───────────────────────
  const [trendClassId, setTrendClassId] = useState('');
  const [trendYearId, setTrendYearId] = useState('');
  const trendYearOptions = useMemo(
    () => (yearsQuery.data ?? []).filter((y) => !effectiveSchoolId || y.schoolId === effectiveSchoolId),
    [yearsQuery.data, effectiveSchoolId],
  );
  const trendQuery = useQuery({
    queryKey: ['reports', 'performance-trend', trendClassId, trendYearId],
    queryFn: () => api.get<PerformanceTrend>('/reports/performance-trend', { classId: trendClassId, academicYearId: trendYearId }),
    enabled: !!trendClassId && !!trendYearId,
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Reports</h2>
        <p className="mt-1 text-sm text-muted-foreground">Admissions, directories, and cross-exam performance — export any of these to CSV/Excel.</p>
      </div>

      {isUnrestricted && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-4 p-4">
            <Field label="School">
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Every school" />
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
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="admissions">
        <TabsList>
          <TabsTrigger value="admissions">Admissions</TabsTrigger>
          <TabsTrigger value="students">Student Directory</TabsTrigger>
          <TabsTrigger value="staff">Staff Directory</TabsTrigger>
          <TabsTrigger value="performance">Performance Trend</TabsTrigger>
        </TabsList>

        {/* ── Admissions ── */}
        <TabsContent value="admissions">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:max-w-xl">
                <Field label="From">
                  <Input type="date" value={admFrom} onChange={(e) => setAdmFrom(e.target.value)} />
                </Field>
                <Field label="To">
                  <Input type="date" value={admTo} onChange={(e) => setAdmTo(e.target.value)} />
                </Field>
                <Field label="Class (optional)">
                  <Select value={admClassId || '__all__'} onValueChange={(v) => setAdmClassId(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Every class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Every class</SelectItem>
                      {classOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Button variant="outline" onClick={downloadAdmissionsCsv} disabled={!admissionsQuery.data?.students.length}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {admissionsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !admissionsQuery.data?.students.length ? (
                <EmptyState icon={UserPlus} label="No admissions in this period" />
              ) : (
                // Summary only - the per-student list is what "Export CSV"
                // above is for; showing it inline as well made this tab feel
                // like a raw data dump rather than a report.
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  <div className="col-span-2 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-4 sm:col-span-1 lg:col-span-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Total Admissions</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                        {admissionsQuery.data.totalAdmissions}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <UserPlus className="h-5 w-5" />
                    </div>
                  </div>
                  {admissionsQuery.data.byClass.map((c) => (
                    <div key={c.className} className="rounded-lg border border-border p-3.5">
                      <p className="truncate text-xs font-medium text-muted-foreground">{c.className}</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{c.count}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Student directory ── */}
        <TabsContent value="students">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              <Field label="Class (optional)">
                <Select value={studClassId || '__all__'} onValueChange={(v) => setStudClassId(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Every class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Every class</SelectItem>
                    {classOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button variant="outline" onClick={downloadStudentsCsv} disabled={!studentsQuery.data?.length}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {studentsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !studentsQuery.data?.length ? (
                <EmptyState icon={Users} label="No students found" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission No</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Guardian</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsQuery.data.map((s) => (
                      <TableRow key={s.admissionNo}>
                        <TableCell className="tabular-nums text-muted-foreground">{s.admissionNo}</TableCell>
                        <TableCell className="font-medium text-foreground">{s.fullName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.className} {s.sectionName !== '—' && `— ${s.sectionName}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.phone ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{s.guardianName ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === 'Active' ? 'success' : 'secondary'}>{s.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Staff directory ── */}
        <TabsContent value="staff">
          <Card>
            <CardHeader className="flex-row items-center justify-end space-y-0">
              <Button variant="outline" onClick={downloadStaffCsv} disabled={!staffQuery.data?.length}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {staffQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !staffQuery.data?.length ? (
                <EmptyState icon={UsersRound} label="No staff found" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Joining Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffQuery.data.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-foreground">{s.fullName}</TableCell>
                        <TableCell className="text-muted-foreground">{s.category}</TableCell>
                        <TableCell className="text-muted-foreground">{s.designation}</TableCell>
                        <TableCell className="text-muted-foreground">{s.phone ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{s.joiningDate ? formatDate(s.joiningDate) : '—'}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === 'Active' ? 'success' : 'secondary'}>{s.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Performance trend ── */}
        <TabsContent value="performance">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
                <Field label="Academic Year">
                  <Select value={trendYearId} onValueChange={setTrendYearId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {trendYearOptions.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Class">
                  <Select value={trendClassId} onValueChange={setTrendClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {!trendClassId || !trendYearId ? (
                <EmptyState icon={TrendingUp} label="Select an academic year and class to see the trend" />
              ) : trendQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !trendQuery.data?.trend.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No exams found for this class and year.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exam</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Class Average</TableHead>
                      <TableHead>Papers Evaluated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trendQuery.data.trend.map((t) => (
                      <TableRow key={t.examId}>
                        <TableCell className="font-medium text-foreground">{t.examName}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(t.startDate)}</TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {t.percentage != null ? `${t.percentage}%` : '—'}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{t.papersEvaluated}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
