import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  GraduationCap,
  Layers,
  MapPin,
  UserCheck,
  UserMinus,
  UsersRound,
  CalendarClock,
  Wallet,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Branch, School, StudentProfile, TeacherProfile } from '@/types';
import { cn, formatCurrency, formatDate, roleLabel } from '@/lib/utils';

type FinanceDashboardSummary = {
  schools: { schoolId: string; schoolName: string; income: number; expense: number; netBalance: number }[];
  combined: { income: number; expense: number; netBalance: number };
};

type ClassRecord = { id: string; name: string; isActive: boolean };

type BranchSummary = {
  branches: {
    branchId: string;
    branchName: string;
    schoolId: string;
    schoolName: string;
    genderScope: 'BOYS' | 'GIRLS' | 'MIXED';
    students: number;
    teachers: number;
    staff: number;
    classes: number;
  }[];
  combined: { students: number; teachers: number; staff: number; classes: number };
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

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const canViewFinance = hasRole('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL');

  const financeQuery = useQuery({
    queryKey: ['finance', 'dashboard-summary'],
    queryFn: () => api.get<FinanceDashboardSummary>('/finance/dashboard-summary'),
    enabled: canViewFinance,
  });

  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
  });
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => api.get<StudentProfile[]>('/students'),
  });
  const teachersQuery = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.get<TeacherProfile[]>('/teachers'),
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassRecord[]>('/classes'),
  });

  const branchSummaryQuery = useQuery({
    queryKey: ['reports', 'branch-summary'],
    queryFn: () => api.get<BranchSummary>('/reports/branch-summary'),
  });

  const primarySchoolId = user?.schoolId ?? schoolsQuery.data?.[0]?.id;

  const attendanceQuery = useQuery({
    queryKey: ['attendance-school-report', primarySchoolId, today],
    queryFn: () =>
      api.get<SchoolReport>('/attendance/school-report', { schoolId: primarySchoolId, date: today }),
    enabled: !!primarySchoolId,
    retry: false,
  });

  const branchCount = useMemo(
    () => (schoolsQuery.data ?? []).reduce((sum, s) => sum + (s.branches?.length ?? 0), 0),
    [schoolsQuery.data],
  );

  const kpis = [
    {
      label: 'Schools',
      value: schoolsQuery.data?.length,
      icon: Building2,
      loading: schoolsQuery.isLoading,
    },
    {
      label: 'Branches',
      value: branchCount,
      icon: MapPin,
      loading: schoolsQuery.isLoading,
    },
    {
      label: 'Students',
      value: studentsQuery.data?.length,
      icon: GraduationCap,
      loading: studentsQuery.isLoading,
    },
    {
      label: 'Teachers',
      value: teachersQuery.data?.length,
      icon: UsersRound,
      loading: teachersQuery.isLoading,
    },
    {
      label: 'Classes',
      value: classesQuery.data?.length,
      icon: Layers,
      loading: classesQuery.isLoading,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {roleLabel(user?.roles[0] ?? '')} overview &middot; {formatDate(new Date())}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                {kpi.loading ? (
                  <Skeleton className="mt-2 h-7 w-10" />
                ) : (
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {kpi.value ?? 0}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <kpi.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(branchSummaryQuery.data?.branches.length ?? 0) > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Students &amp; Teachers by Branch
            </CardTitle>
            <CardDescription>Enrollment broken down per campus - not just one combined total</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {branchSummaryQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {branchSummaryQuery.data!.branches.map((b) => (
                  <div key={b.branchId} className="rounded-lg border border-border p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{b.branchName}</p>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {b.genderScope === 'MIXED' ? 'Co-ed' : b.genderScope === 'BOYS' ? 'Boys' : 'Girls'}
                      </Badge>
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-semibold tabular-nums text-foreground">{b.students}</p>
                        <p className="text-[11px] text-muted-foreground">Students</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold tabular-nums text-foreground">{b.teachers}</p>
                        <p className="text-[11px] text-muted-foreground">Teachers</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold tabular-nums text-foreground">{b.classes}</p>
                        <p className="text-[11px] text-muted-foreground">Classes</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 sm:col-span-2 lg:col-span-1">
                  <p className="text-sm font-medium text-foreground">All Branches Combined</p>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold tabular-nums text-primary">
                        {branchSummaryQuery.data!.combined.students}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Students</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold tabular-nums text-primary">
                        {branchSummaryQuery.data!.combined.teachers}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Teachers</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold tabular-nums text-primary">
                        {branchSummaryQuery.data!.combined.classes}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Classes</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canViewFinance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Finance Overview
            </CardTitle>
            <CardDescription>Lifetime income, expense and net balance - combined and per campus</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {financeQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !financeQuery.data ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No finance data available yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FinanceStat label="Combined Income" value={financeQuery.data.combined.income} icon={TrendingUp} tone="success" />
                  <FinanceStat label="Combined Expense" value={financeQuery.data.combined.expense} icon={TrendingDown} tone="destructive" />
                  <FinanceStat
                    label="Combined Net Balance"
                    value={financeQuery.data.combined.netBalance}
                    icon={Wallet}
                    tone={financeQuery.data.combined.netBalance >= 0 ? 'success' : 'destructive'}
                    emphasize
                  />
                </div>

                {financeQuery.data.schools.length > 1 && (
                  <div className="border-t border-border pt-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">By Campus</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {financeQuery.data.schools.map((s) => (
                        <div key={s.schoolId} className="rounded-lg border border-border p-3.5">
                          <p className="text-sm font-medium text-foreground">{s.schoolName}</p>
                          <div className="mt-2 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Income</span>
                              <span className="font-medium tabular-nums text-success">{formatCurrency(s.income)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Expense</span>
                              <span className="font-medium tabular-nums text-destructive">{formatCurrency(s.expense)}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-border pt-1">
                              <span className="text-muted-foreground">Net Balance</span>
                              <span className={cn('font-semibold tabular-nums', s.netBalance >= 0 ? 'text-success' : 'text-destructive')}>
                                {formatCurrency(s.netBalance)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Today's attendance snapshot */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                Today's Attendance
              </CardTitle>
              <CardDescription className="mt-1">
                {attendanceQuery.data?.schoolName ?? 'Whole-school snapshot'} &middot; {formatDate(today)}
              </CardDescription>
            </div>
            {attendanceQuery.data?.attendancePct != null && (
              <Badge variant={attendanceQuery.data.attendancePct >= 80 ? 'success' : 'warning'}>
                {attendanceQuery.data.attendancePct}% present
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {attendanceQuery.isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !primarySchoolId || attendanceQuery.isError ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No attendance data available yet.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatBlock
                    label="Present"
                    value={attendanceQuery.data!.attendance.present}
                    icon={UserCheck}
                    tone="success"
                  />
                  <StatBlock
                    label="Absent"
                    value={attendanceQuery.data!.attendance.absent}
                    icon={UserMinus}
                    tone="destructive"
                  />
                  <StatBlock label="Late" value={attendanceQuery.data!.attendance.late} tone="warning" />
                  <StatBlock label="On Leave" value={attendanceQuery.data!.attendance.leave} tone="default" />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
                  <span>
                    Total strength:{' '}
                    <span className="font-medium text-foreground">
                      {attendanceQuery.data!.strength.total}
                    </span>
                  </span>
                  <span>
                    Boys:{' '}
                    <span className="font-medium text-foreground">{attendanceQuery.data!.strength.boys}</span>
                  </span>
                  <span>
                    Girls:{' '}
                    <span className="font-medium text-foreground">{attendanceQuery.data!.strength.girls}</span>
                  </span>
                  <span>
                    Unmarked:{' '}
                    <span className="font-medium text-foreground">
                      {attendanceQuery.data!.attendance.unmarked}
                    </span>
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Schools & branches */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Schools &amp; Branches</CardTitle>
            <CardDescription>Campuses under your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {schoolsQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : schoolsQuery.data?.length ? (
              schoolsQuery.data.map((school) => (
                <div
                  key={school.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3.5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{school.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {school.branches.length} branch{school.branches.length === 1 ? '' : 'es'} &middot; {school.code}
                    </p>
                  </div>
                  <Badge variant={school.isActive ? 'success' : 'secondary'}>
                    {school.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No schools found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FinanceStat({
  label,
  value,
  icon: Icon,
  tone = 'default',
  emphasize = false,
}: {
  label: string;
  value: number;
  icon?: typeof Wallet;
  tone?: 'success' | 'destructive' | 'warning' | 'default';
  emphasize?: boolean;
}) {
  const toneClasses: Record<string, string> = {
    success: 'bg-success/10 text-success',
    destructive: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/15 text-amber-700',
    default: 'bg-secondary text-secondary-foreground',
  };
  const textToneClasses: Record<string, string> = {
    success: 'text-success',
    destructive: 'text-destructive',
    warning: 'text-amber-700',
    default: 'text-foreground',
  };

  return (
    <div className={cn('rounded-lg border p-4', emphasize ? 'border-primary/30 bg-primary/5' : 'border-border')}>
      <div className="flex items-center gap-2">
        {Icon && (
          <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', toneClasses[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={cn('mt-2 text-xl font-semibold tabular-nums', textToneClasses[tone])}>{formatCurrency(value)}</p>
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
