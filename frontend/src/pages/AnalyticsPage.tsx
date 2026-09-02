import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, Wallet, ClipboardCheck, BookOpenCheck, UsersRound, Search, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import type {
  FeeDefaultRiskReport,
  AttendanceAnomalyReport,
  ExamRiskReport,
  TeacherEfficiencyReport,
  LearningReport,
  StudentProfile,
  RiskLevel,
} from '@/types';

function EmptyState({ icon: Icon, label }: { icon: typeof TrendingDown; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

const RISK_VARIANT: Record<RiskLevel, 'destructive' | 'warning' | 'secondary'> = {
  HIGH: 'destructive',
  MEDIUM: 'warning',
  LOW: 'secondary',
};

function scoreVariant(score: number | null): 'destructive' | 'warning' | 'success' | 'secondary' {
  if (score === null) return 'secondary';
  if (score < 40) return 'destructive';
  if (score < 70) return 'warning';
  return 'success';
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Predictive Analytics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deterministic, explainable scoring computed from your own fee, attendance and exam data - not a black-box AI call.
        </p>
      </div>

      <Tabs defaultValue="fee-risk">
        <TabsList>
          <TabsTrigger value="fee-risk">Fee Default Risk</TabsTrigger>
          <TabsTrigger value="attendance">Attendance Anomalies</TabsTrigger>
          <TabsTrigger value="exam-risk">Exam Risk</TabsTrigger>
          <TabsTrigger value="teachers">Teacher Efficiency</TabsTrigger>
          <TabsTrigger value="learning-report">Learning Report</TabsTrigger>
        </TabsList>

        <TabsContent value="fee-risk">
          <FeeRiskTab />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceAnomaliesTab />
        </TabsContent>
        <TabsContent value="exam-risk">
          <ExamRiskTab />
        </TabsContent>
        <TabsContent value="teachers">
          <TeacherEfficiencyTab />
        </TabsContent>
        <TabsContent value="learning-report">
          <LearningReportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RefreshHeader({ title, onRefresh, isFetching }: { title: string; onRefresh: () => void; isFetching: boolean }) {
  return (
    <CardHeader className="flex-row items-center justify-between space-y-0">
      <p className="text-sm text-muted-foreground">{title}</p>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isFetching}>
        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </CardHeader>
  );
}

// ─────────────────────────── Fee Default Risk ───────────────────────────
function FeeRiskTab() {
  const query = useQuery({
    queryKey: ['analytics', 'fee-default-risk'],
    queryFn: () => api.get<FeeDefaultRiskReport>('/analytics/fee-default-risk'),
  });
  const data = query.data;

  return (
    <Card>
      <RefreshHeader title="Students most likely to miss upcoming fee payments, based on their last 6 months." onRefresh={() => query.refetch()} isFetching={query.isFetching} />
      <CardContent className="pt-0 space-y-4">
        {data && (
          <div className="grid grid-cols-3 gap-3 sm:max-w-md">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Flagged</p>
              <p className="text-lg font-semibold text-foreground">{data.studentsFlagged}</p>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs text-muted-foreground">High risk</p>
              <p className="text-lg font-semibold text-destructive">{data.highRiskCount}</p>
            </div>
            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3">
              <p className="text-xs text-muted-foreground">Medium risk</p>
              <p className="text-lg font-semibold text-amber-700">{data.mediumRiskCount}</p>
            </div>
          </div>
        )}
        {query.isLoading ? (
          <LoadingRows />
        ) : !data?.students.length ? (
          <EmptyState icon={Wallet} label="No students currently flagged for fee default risk" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Overdue invoices</TableHead>
                <TableHead>Overdue amount</TableHead>
                <TableHead>Consecutive unpaid</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.students.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell>
                    <p className="font-medium text-foreground">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">{s.admissionNo}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.className} {s.sectionName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.overdueInvoices}</TableCell>
                  <TableCell className="text-muted-foreground">Rs. {s.overdueAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{s.consecutiveUnpaidMonths} month(s)</TableCell>
                  <TableCell>
                    <Badge variant={RISK_VARIANT[s.riskLevel]}>
                      {s.riskLevel} ({s.riskScore})
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Attendance Anomalies ───────────────────────────
function AttendanceAnomaliesTab() {
  const query = useQuery({
    queryKey: ['analytics', 'attendance-anomalies'],
    queryFn: () => api.get<AttendanceAnomalyReport>('/analytics/attendance-anomalies'),
  });
  const data = query.data;

  return (
    <Card>
      <RefreshHeader
        title={`Sudden attendance changes in the last ${data?.windowDays.recent ?? 14} days vs. the prior ${data?.windowDays.baseline ?? 90}.`}
        onRefresh={() => query.refetch()}
        isFetching={query.isFetching}
      />
      <CardContent className="pt-0">
        {query.isLoading ? (
          <LoadingRows />
        ) : !data?.alerts.length ? (
          <EmptyState icon={ClipboardCheck} label="No unusual attendance patterns detected" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Recent absence rate</TableHead>
                <TableHead>Baseline</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.alerts.map((a) => (
                <TableRow key={a.studentId}>
                  <TableCell>
                    <p className="font-medium text-foreground">{a.fullName}</p>
                    <p className="text-xs text-muted-foreground">{a.admissionNo}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.className} {a.sectionName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.recentAbsentRatePct}%</TableCell>
                  <TableCell className="text-muted-foreground">{a.baselineAbsentRatePct}%</TableCell>
                  <TableCell className="text-muted-foreground">{a.reason}</TableCell>
                  <TableCell>
                    <Badge variant={RISK_VARIANT[a.severity]}>{a.severity}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Exam Risk ───────────────────────────
function ExamRiskTab() {
  const query = useQuery({
    queryKey: ['analytics', 'exam-risk'],
    queryFn: () => api.get<ExamRiskReport>('/analytics/exam-risk'),
  });
  const data = query.data;

  return (
    <Card>
      <RefreshHeader
        title={data?.latestExam ? `Based on "${data.latestExam.name}"${data.previousExam ? ` vs. "${data.previousExam.name}"` : ''}.` : 'No exam has been recorded yet.'}
        onRefresh={() => query.refetch()}
        isFetching={query.isFetching}
      />
      <CardContent className="pt-0">
        {query.isLoading ? (
          <LoadingRows />
        ) : !data?.students.length ? (
          <EmptyState icon={BookOpenCheck} label="No students currently flagged as at risk" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Latest score</TableHead>
                <TableHead>Previous score</TableHead>
                <TableHead>Failed subjects</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.students.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell>
                    <p className="font-medium text-foreground">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">{s.admissionNo}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.className} {s.sectionName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.latestScorePct}%</TableCell>
                  <TableCell className="text-muted-foreground">{s.previousScorePct !== null ? `${s.previousScorePct}%` : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{s.failedSubjects}</TableCell>
                  <TableCell>
                    <Badge variant={RISK_VARIANT[s.riskLevel]}>
                      {s.riskLevel} ({s.riskScore})
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Teacher Efficiency ───────────────────────────
function TeacherEfficiencyTab() {
  const query = useQuery({
    queryKey: ['analytics', 'teacher-efficiency'],
    queryFn: () => api.get<TeacherEfficiencyReport>('/analytics/teacher-efficiency'),
  });
  const data = query.data;

  return (
    <Card>
      <RefreshHeader
        title={data?.note ?? 'A coaching signal from recent exam results and attendance-marking consistency, not a ranking.'}
        onRefresh={() => query.refetch()}
        isFetching={query.isFetching}
      />
      <CardContent className="pt-0">
        {query.isLoading ? (
          <LoadingRows />
        ) : !data?.teachers.length ? (
          <EmptyState icon={UsersRound} label="No teacher-subject assignments found in the timetable yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Subjects / Sections</TableHead>
                <TableHead>Class teacher of</TableHead>
                <TableHead>Avg. score</TableHead>
                <TableHead>Pass rate</TableHead>
                <TableHead>Attendance marking</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.teachers.map((t) => (
                <TableRow key={t.teacherId}>
                  <TableCell>
                    <p className="font-medium text-foreground">{t.fullName}</p>
                    <p className="text-xs text-muted-foreground">{t.employeeId ?? '—'}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.subjectsTaught} subject(s) / {t.sectionsTaught} section(s)
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.classTeacherOf ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{t.avgScorePct !== null ? `${t.avgScorePct}%` : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{t.passRatePct !== null ? `${t.passRatePct}%` : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.attendanceMarkingRatePct !== null ? `${t.attendanceMarkingRatePct}%` : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={scoreVariant(t.efficiencyScore)}>{t.efficiencyScore !== null ? t.efficiencyScore : '—'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Learning Report ───────────────────────────
function LearningReportTab() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => api.get<StudentProfile[]>('/students'),
  });

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return (studentsQuery.data ?? [])
      .filter((s) => s.user.fullName.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, studentsQuery.data]);

  const reportQuery = useQuery({
    queryKey: ['analytics', 'learning-report', selectedId],
    queryFn: () => api.get<LearningReport>(`/analytics/learning-report/${selectedId}`),
    enabled: !!selectedId,
  });

  return (
    <Card>
      <CardHeader className="space-y-3">
        <p className="text-sm text-muted-foreground">A snapshot of one student's attendance, exam trend and fee status - auto-generated, no typing required.</p>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or admission no."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedId(null);
            }}
          />
          {matches.length > 0 && !selectedId && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-md">
              {matches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
                  onClick={() => {
                    setSelectedId(s.id);
                    setSearch(s.user.fullName);
                  }}
                >
                  <span className="font-medium text-foreground">{s.user.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.admissionNo} · {s.section?.class?.name} {s.section?.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!selectedId ? (
          <EmptyState icon={Search} label="Search for a student to generate their learning report" />
        ) : reportQuery.isLoading ? (
          <LoadingRows />
        ) : reportQuery.data ? (
          <LearningReportView report={reportQuery.data} />
        ) : (
          <EmptyState icon={Search} label="Could not load a report for this student" />
        )}
      </CardContent>
    </Card>
  );
}

function LearningReportView({ report }: { report: LearningReport }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{report.student.fullName}</h3>
        <p className="text-sm text-muted-foreground">
          {report.student.admissionNo} · {report.student.className} {report.student.sectionName}
        </p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">{report.summary}</div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Attendance (last {report.attendance.windowDays} days)</p>
          <p className="text-lg font-semibold text-foreground">{report.attendance.attendanceRatePct !== null ? `${report.attendance.attendanceRatePct}%` : 'N/A'}</p>
          <p className="text-xs text-muted-foreground">
            {report.attendance.absentCount} absent · {report.attendance.lateCount} late · {report.attendance.leaveCount} leave
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Latest exam score</p>
          <p className="text-lg font-semibold text-foreground">
            {report.examTrend.length ? `${report.examTrend[report.examTrend.length - 1].scorePct ?? '—'}%` : 'N/A'}
          </p>
          <p className="text-xs text-muted-foreground">{report.examTrend.length ? report.examTrend[report.examTrend.length - 1].examName : 'No exams yet'}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Fee dues (recent periods)</p>
          <p className="text-lg font-semibold text-foreground">Rs. {report.feeStatus.totalDueRecentPeriods.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{report.feeStatus.overdueInvoices} overdue invoice(s)</p>
        </div>
      </div>

      {report.examTrend.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">Exam trend</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Failed subjects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.examTrend.map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground">{e.examName}</TableCell>
                  <TableCell className="text-muted-foreground">{e.scorePct !== null ? `${e.scorePct}%` : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{e.failedSubjects}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
