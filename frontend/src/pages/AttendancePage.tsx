import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Download, Eye, Save, UserCheck, UserMinus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn, formatDate } from '@/lib/utils';
import type { School, SectionRecord } from '@/types';

const STATUS_OPTIONS = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const;
type Status = (typeof STATUS_OPTIONS)[number];

type MarkSheetRow = {
  studentId: string;
  admissionNo: string;
  fullName: string;
  status: Status | null;
  remarks: string | null;
  recordId: string | null;
};

type SchoolReport = {
  schoolId: string;
  schoolName: string;
  date: string;
  strength: { total: number; boys: number; girls: number; unspecified: number };
  attendance: { present: number; absent: number; late: number; leave: number; unmarked: number };
  attendancePct: number | null;
  byClass: {
    className: string;
    sectionName: string;
    strength: number;
    boys: number;
    girls: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
  }[];
};

const statusStyles: Record<Status, string> = {
  PRESENT: 'bg-success/10 text-success border-success/20',
  ABSENT: 'bg-destructive/10 text-destructive border-destructive/20',
  LATE: 'bg-warning/15 text-amber-700 border-warning/30',
  LEAVE: 'bg-secondary text-secondary-foreground border-border',
};

export default function AttendancePage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canSeeReport = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(today);
  const [draft, setDraft] = useState<Record<string, Status>>({});
  const [markError, setMarkError] = useState<string | null>(null);

  const [reportSchoolId, setReportSchoolId] = useState(user?.schoolId ?? '');
  const [reportDate, setReportDate] = useState(today);

  const thisMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [registerSectionId, setRegisterSectionId] = useState('');
  const [registerMonth, setRegisterMonth] = useState(thisMonth);

  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get<SectionRecord[]>('/sections'),
  });
  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
    enabled: canSeeReport,
  });

  const markSheetQuery = useQuery({
    queryKey: ['attendance', 'sheet', sectionId, date],
    queryFn: () => api.get<MarkSheetRow[]>('/attendance', { sectionId, date }),
    enabled: !!sectionId && !!date,
  });

  const reportQuery = useQuery({
    queryKey: ['attendance', 'report', reportSchoolId, reportDate],
    queryFn: () => api.get<SchoolReport>('/attendance/school-report', { schoolId: reportSchoolId, date: reportDate }),
    enabled: canSeeReport && !!reportSchoolId && !!reportDate,
  });

  const markMutation = useMutation({
    mutationFn: (entries: { studentId: string; status: Status }[]) =>
      api.post('/attendance/mark', { sectionId, date, entries }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'sheet', sectionId, date] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'report'] });
      setDraft({});
      setMarkError(null);
    },
    onError: (err: unknown) => {
      setMarkError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  function setStatus(studentId: string, status: Status) {
    setDraft((d) => ({ ...d, [studentId]: status }));
  }

  function handleSave() {
    const rows = markSheetQuery.data ?? [];
    const entries = rows
      .map((r) => ({ studentId: r.studentId, status: draft[r.studentId] ?? r.status }))
      .filter((e): e is { studentId: string; status: Status } => !!e.status);
    if (!entries.length) {
      setMarkError('Mark at least one student before saving.');
      return;
    }
    markMutation.mutate(entries);
  }

  const hasUnsaved = Object.keys(draft).length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Attendance</h2>
        <p className="mt-1 text-sm text-muted-foreground">Mark daily attendance and review school-wide reports</p>
      </div>

      <Tabs defaultValue="mark">
        <TabsList>
          <TabsTrigger value="mark">Take Attendance</TabsTrigger>
          {canSeeReport && <TabsTrigger value="report">Daily Report</TabsTrigger>}
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>

        <TabsContent value="mark">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
                <div className="space-y-1.5">
                  <Label>Section</Label>
                  <Select value={sectionId} onValueChange={setSectionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sectionsQuery.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.class?.name} / {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} />
                </div>
              </div>
              {sectionId && (
                <Button onClick={handleSave} loading={markMutation.isPending} disabled={!hasUnsaved}>
                  <Save className="h-4 w-4" />
                  Save Attendance
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {!sectionId ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ClipboardCheck className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Select a section and date to begin</p>
                </div>
              ) : markSheetQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !markSheetQuery.data?.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No students enrolled in this section.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Admission No</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {markSheetQuery.data.map((row) => {
                        const current = draft[row.studentId] ?? row.status;
                        return (
                          <TableRow key={row.studentId}>
                            <TableCell className="tabular-nums text-muted-foreground">{row.admissionNo}</TableCell>
                            <TableCell className="font-medium text-foreground">{row.fullName}</TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1.5">
                                {STATUS_OPTIONS.map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setStatus(row.studentId, opt)}
                                    className={cn(
                                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                                      current === opt
                                        ? statusStyles[opt]
                                        : 'border-border text-muted-foreground hover:bg-secondary',
                                    )}
                                  >
                                    {opt.charAt(0) + opt.slice(1).toLowerCase()}
                                  </button>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {markError && (
                    <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {markError}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canSeeReport && (
          <TabsContent value="report">
            <Card>
              <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
                  <div className="space-y-1.5">
                    <Label>School</Label>
                    <Select value={reportSchoolId} onValueChange={setReportSchoolId}>
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
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} max={today} />
                  </div>
                </div>
                {reportQuery.data?.attendancePct != null && (
                  <Badge variant={reportQuery.data.attendancePct >= 80 ? 'success' : 'warning'}>
                    {reportQuery.data.attendancePct}% present
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {!reportSchoolId ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Select a school to view its report.</p>
                ) : reportQuery.isLoading ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : reportQuery.data ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <StatBlock label="Present" value={reportQuery.data.attendance.present} icon={UserCheck} tone="success" />
                      <StatBlock label="Absent" value={reportQuery.data.attendance.absent} icon={UserMinus} tone="destructive" />
                      <StatBlock label="Late" value={reportQuery.data.attendance.late} tone="warning" />
                      <StatBlock label="On Leave" value={reportQuery.data.attendance.leave} tone="default" />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
                      <span>Total strength: <span className="font-medium text-foreground">{reportQuery.data.strength.total}</span></span>
                      <span>Boys: <span className="font-medium text-foreground">{reportQuery.data.strength.boys}</span></span>
                      <span>Girls: <span className="font-medium text-foreground">{reportQuery.data.strength.girls}</span></span>
                      <span>Unmarked: <span className="font-medium text-foreground">{reportQuery.data.attendance.unmarked}</span></span>
                    </div>

                    {reportQuery.data.byClass.length > 0 && (
                      <div className="mt-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Class / Section</TableHead>
                              <TableHead>Strength</TableHead>
                              <TableHead>Present</TableHead>
                              <TableHead>Absent</TableHead>
                              <TableHead>Late</TableHead>
                              <TableHead>Leave</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reportQuery.data.byClass.map((row, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium text-foreground">
                                  {row.className} / {row.sectionName}
                                </TableCell>
                                <TableCell className="tabular-nums text-muted-foreground">{row.strength}</TableCell>
                                <TableCell className="tabular-nums text-muted-foreground">{row.present}</TableCell>
                                <TableCell className="tabular-nums text-muted-foreground">{row.absent}</TableCell>
                                <TableCell className="tabular-nums text-muted-foreground">{row.late}</TableCell>
                                <TableCell className="tabular-nums text-muted-foreground">{row.leave}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">No data available.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="register">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
                <div className="space-y-1.5">
                  <Label>Section</Label>
                  <Select value={registerSectionId} onValueChange={setRegisterSectionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sectionsQuery.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.class?.name} / {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Month</Label>
                  <Input type="month" value={registerMonth} onChange={(e) => setRegisterMonth(e.target.value)} max={thisMonth} />
                </div>
              </div>
              {registerSectionId && registerMonth && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const [y, m] = registerMonth.split('-');
                      api.openBlob(`/attendance/register/pdf?sectionId=${registerSectionId}&year=${y}&month=${Number(m)}`);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button
                    onClick={() => {
                      const [y, m] = registerMonth.split('-');
                      api.downloadBlob(
                        `/attendance/register/pdf?sectionId=${registerSectionId}&year=${y}&month=${Number(m)}`,
                        `attendance-register-${y}-${m}.pdf`,
                      );
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {!registerSectionId ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ClipboardCheck className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Select a section and month to generate the register</p>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Click View to open the printable monthly attendance register in a new tab, or Download to save it.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBlock({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon?: typeof UserCheck;
  tone?: 'success' | 'destructive' | 'warning' | 'default';
}) {
  const toneClasses: Record<string, string> = {
    success: 'bg-success/10 text-success',
    destructive: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/15 text-amber-700',
    default: 'bg-secondary text-secondary-foreground',
  };
  return (
    <div className="rounded-lg border border-border p-3.5">
      <div className="flex items-center gap-2">
        {Icon && (
          <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', toneClasses[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
