import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup, ScrollText, Download, ChevronLeft, ChevronRight, SlidersHorizontal, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import type { BackupLog, BackupStatus, AuditLogPage, School, SchoolSettings, GradeBand } from '@/types';

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 inline-block">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, label }: { icon: typeof DatabaseBackup; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const BACKUP_STATUS_VARIANT: Record<BackupStatus, 'warning' | 'success' | 'destructive'> = {
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  FAILED: 'destructive',
};

export default function AdminToolsPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canBackup = hasRole('DIRECTOR');
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  // ─────────────────────────── Backups tab ───────────────────────────
  const backupsQuery = useQuery({
    queryKey: ['admin', 'backups'],
    queryFn: () => api.get<BackupLog[]>('/admin/backups'),
    enabled: canBackup,
  });

  const createBackup = useMutation({
    mutationFn: () => api.post<BackupLog>('/admin/backups'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] }),
  });

  function downloadBackup(b: BackupLog) {
    api.downloadBlob(`/admin/backups/${b.id}/download`, b.fileKey ?? `${b.id}.json`);
  }

  // ─────────────────────────── Audit Log tab ───────────────────────────
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [page, setPage] = useState(1);

  const actionsQuery = useQuery({ queryKey: ['admin', 'audit-actions'], queryFn: () => api.get<string[]>('/admin/audit-logs/actions') });

  const auditQuery = useQuery({
    queryKey: ['admin', 'audit-logs', actionFilter, entityFilter, fromFilter, toFilter, page],
    queryFn: () =>
      api.get<AuditLogPage>('/admin/audit-logs', {
        action: actionFilter || undefined,
        entity: entityFilter || undefined,
        from: fromFilter || undefined,
        to: toFilter || undefined,
        page,
        pageSize: 50,
      }),
  });

  function resetFilters() {
    setActionFilter('');
    setEntityFilter('');
    setFromFilter('');
    setToFilter('');
    setPage(1);
  }

  // ─────────────────────────── Settings tab ───────────────────────────
  const [settingsSchoolId, setSettingsSchoolId] = useState(isUnrestricted ? '' : user?.schoolId ?? '');
  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools'), enabled: isUnrestricted });

  const settingsQuery = useQuery({
    queryKey: ['settings', settingsSchoolId],
    queryFn: () => api.get<SchoolSettings>(`/settings/${settingsSchoolId}`),
    enabled: !!settingsSchoolId,
  });

  const [settingsForm, setSettingsForm] = useState<{
    gradingScale: GradeBand[];
    weekendDays: number[];
    lateFeePercent: string;
    attendanceLateAfter: string;
    smsNotificationsEnabled: boolean;
    emailNotificationsEnabled: boolean;
    bankName: string;
    bankAccountTitle: string;
    bankAccountNumber: string;
    jazzCashNumber: string;
    easyPaisaNumber: string;
  }>({
    gradingScale: [],
    weekendDays: [],
    lateFeePercent: '',
    attendanceLateAfter: '',
    smsNotificationsEnabled: false,
    emailNotificationsEnabled: false,
    bankName: '',
    bankAccountTitle: '',
    bankAccountNumber: '',
    jazzCashNumber: '',
    easyPaisaNumber: '',
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettingsForm({
      gradingScale: settingsQuery.data.gradingScale ?? [],
      weekendDays: settingsQuery.data.weekendDays ?? [],
      lateFeePercent: settingsQuery.data.lateFeePercent ?? '',
      attendanceLateAfter: settingsQuery.data.attendanceLateAfter ?? '',
      smsNotificationsEnabled: settingsQuery.data.smsNotificationsEnabled,
      emailNotificationsEnabled: settingsQuery.data.emailNotificationsEnabled,
      bankName: settingsQuery.data.bankName ?? '',
      bankAccountTitle: settingsQuery.data.bankAccountTitle ?? '',
      bankAccountNumber: settingsQuery.data.bankAccountNumber ?? '',
      jazzCashNumber: settingsQuery.data.jazzCashNumber ?? '',
      easyPaisaNumber: settingsQuery.data.easyPaisaNumber ?? '',
    });
  }, [settingsQuery.data]);

  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const saveSettings = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put<SchoolSettings>(`/settings/${settingsSchoolId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', settingsSchoolId] });
      setSettingsError(null);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    },
    onError: (err: unknown) => setSettingsError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function submitSettings() {
    setSettingsError(null);
    saveSettings.mutate({
      gradingScale: settingsForm.gradingScale,
      weekendDays: settingsForm.weekendDays,
      lateFeePercent: settingsForm.lateFeePercent ? Number(settingsForm.lateFeePercent) : undefined,
      attendanceLateAfter: settingsForm.attendanceLateAfter || undefined,
      smsNotificationsEnabled: settingsForm.smsNotificationsEnabled,
      emailNotificationsEnabled: settingsForm.emailNotificationsEnabled,
      bankName: settingsForm.bankName.trim() || undefined,
      bankAccountTitle: settingsForm.bankAccountTitle.trim() || undefined,
      bankAccountNumber: settingsForm.bankAccountNumber.trim() || undefined,
      jazzCashNumber: settingsForm.jazzCashNumber.trim() || undefined,
      easyPaisaNumber: settingsForm.easyPaisaNumber.trim() || undefined,
    });
  }

  function toggleWeekendDay(day: number) {
    setSettingsForm((f) => ({
      ...f,
      weekendDays: f.weekendDays.includes(day) ? f.weekendDays.filter((d) => d !== day) : [...f.weekendDays, day],
    }));
  }

  function updateGradeBand(index: number, patch: Partial<GradeBand>) {
    setSettingsForm((f) => ({
      ...f,
      gradingScale: f.gradingScale.map((g, i) => (i === index ? { ...g, ...patch } : g)),
    }));
  }

  function addGradeBand() {
    setSettingsForm((f) => ({ ...f, gradingScale: [...f.gradingScale, { grade: '', minPercent: 0, maxPercent: 0 }] }));
  }

  function removeGradeBand(index: number) {
    setSettingsForm((f) => ({ ...f, gradingScale: f.gradingScale.filter((_, i) => i !== index) }));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Admin Tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">Database backups and a searchable log of who did what.</p>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          {canBackup && <TabsTrigger value="backups">Backups</TabsTrigger>}
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ── Backups ── */}
        {canBackup && (
          <TabsContent value="backups">
            <Card>
              <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Downloadable JSON export of every table, for offline safekeeping. For actual disaster recovery, use your
                  database host's point-in-time restore.
                </p>
                <Button onClick={() => createBackup.mutate()} loading={createBackup.isPending}>
                  <DatabaseBackup className="h-4 w-4" />
                  Create Backup
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {backupsQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !backupsQuery.data?.length ? (
                  <EmptyState icon={DatabaseBackup} label="No backups yet" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Triggered By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tables</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backupsQuery.data.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="text-muted-foreground">{formatDate(b.createdAt, { hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell className="text-muted-foreground">{b.triggeredBy?.fullName ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={BACKUP_STATUS_VARIANT[b.status]}>{b.status.replace('_', ' ')}</Badge>
                            {b.status === 'FAILED' && b.errorMessage && (
                              <p className="mt-1 text-xs text-destructive">{b.errorMessage}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{b.tableCount ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{b.recordCount ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{formatBytes(b.fileSizeBytes)}</TableCell>
                          <TableCell className="text-right">
                            {b.status === 'COMPLETED' && (
                              <Button variant="ghost" size="sm" onClick={() => downloadBackup(b)}>
                                <Download className="h-4 w-4" />
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
        )}

        {/* ── Audit Log ── */}
        <TabsContent value="audit">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-44">
                  <Field label="Action">
                    <Select
                      value={actionFilter || '__all__'}
                      onValueChange={(v) => {
                        setActionFilter(v === '__all__' ? '' : v);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Every action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Every action</SelectItem>
                        {(actionsQuery.data ?? []).map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="w-40">
                  <Field label="Entity">
                    <Input
                      value={entityFilter}
                      onChange={(e) => {
                        setEntityFilter(e.target.value);
                        setPage(1);
                      }}
                      placeholder="e.g. Student"
                    />
                  </Field>
                </div>
                <div className="w-36">
                  <Field label="From">
                    <Input
                      type="date"
                      value={fromFilter}
                      onChange={(e) => {
                        setFromFilter(e.target.value);
                        setPage(1);
                      }}
                    />
                  </Field>
                </div>
                <div className="w-36">
                  <Field label="To">
                    <Input
                      type="date"
                      value={toFilter}
                      onChange={(e) => {
                        setToFilter(e.target.value);
                        setPage(1);
                      }}
                    />
                  </Field>
                </div>
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {auditQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !auditQuery.data?.items.length ? (
                <EmptyState icon={ScrollText} label="No matching audit log entries" />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditQuery.data.items.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground">{formatDate(log.createdAt, { hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell className="text-foreground">{log.user?.fullName ?? 'System'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{log.action}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {log.entity ?? '—'}
                            {log.entityId && <span className="ml-1 text-xs">#{log.entityId.slice(0, 8)}</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{log.school?.name ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{log.ipAddress ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Page {auditQuery.data.page} of {auditQuery.data.totalPages} — {auditQuery.data.total} entries
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= auditQuery.data.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settings ── */}
        <TabsContent value="settings">
          <Card>
            <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row sm:items-end sm:justify-between">
              {isUnrestricted ? (
                <div className="w-full sm:max-w-xs">
                  <Field label="School">
                    <Select value={settingsSchoolId} onValueChange={setSettingsSchoolId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a school" />
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
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">School-wide policy settings.</p>
              )}
              {settingsSchoolId && (
                <Button onClick={submitSettings} loading={saveSettings.isPending}>
                  {settingsSaved ? 'Saved' : 'Save Settings'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              {isUnrestricted && !settingsSchoolId ? (
                <EmptyState icon={SlidersHorizontal} label="Choose a school to view its settings" />
              ) : settingsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Label>Grading Scale</Label>
                      <Button variant="outline" size="sm" onClick={addGradeBand}>
                        <Plus className="h-4 w-4" />
                        Add Grade
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {settingsForm.gradingScale.map((band, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            placeholder="Grade (e.g. A+)"
                            className="w-28"
                            value={band.grade}
                            onChange={(e) => updateGradeBand(i, { grade: e.target.value })}
                          />
                          <Input
                            type="number"
                            placeholder="Min %"
                            className="w-24"
                            value={band.minPercent}
                            onChange={(e) => updateGradeBand(i, { minPercent: Number(e.target.value) })}
                          />
                          <span className="text-sm text-muted-foreground">to</span>
                          <Input
                            type="number"
                            placeholder="Max %"
                            className="w-24"
                            value={band.maxPercent}
                            onChange={(e) => updateGradeBand(i, { maxPercent: Number(e.target.value) })}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removeGradeBand(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {!settingsForm.gradingScale.length && (
                        <p className="text-sm text-muted-foreground">No grade bands yet — add one above.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 inline-block">Weekend Days</Label>
                    <div className="flex flex-wrap gap-3">
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <label key={d} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <input type="checkbox" checked={settingsForm.weekendDays.includes(d)} onChange={() => toggleWeekendDay(d)} />
                          {DAY_NAMES[d]}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Fee late fee (%)">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={settingsForm.lateFeePercent}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, lateFeePercent: e.target.value }))}
                      />
                    </Field>
                    <Field label="Attendance counted late after">
                      <Input
                        type="time"
                        value={settingsForm.attendanceLateAfter}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, attendanceLateAfter: e.target.value }))}
                      />
                    </Field>
                  </div>

                  <div>
                    <Label className="mb-2 inline-block">Fee Collection Accounts</Label>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Shown as a QR code on printed fee receipts so parents can pay via any of these channels. Leave blank to
                      skip a channel.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Bank name">
                        <Input
                          placeholder="e.g. HBL, Meezan Bank"
                          value={settingsForm.bankName}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, bankName: e.target.value }))}
                        />
                      </Field>
                      <Field label="Account title">
                        <Input
                          placeholder="e.g. Your School System"
                          value={settingsForm.bankAccountTitle}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, bankAccountTitle: e.target.value }))}
                        />
                      </Field>
                      <Field label="Account number / IBAN">
                        <Input
                          placeholder="PKxx XXXX XXXX XXXX XXXX XXXX"
                          value={settingsForm.bankAccountNumber}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
                        />
                      </Field>
                      <Field label="JazzCash number">
                        <Input
                          placeholder="03XXXXXXXXX"
                          value={settingsForm.jazzCashNumber}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, jazzCashNumber: e.target.value }))}
                        />
                      </Field>
                      <Field label="EasyPaisa number">
                        <Input
                          placeholder="03XXXXXXXXX"
                          value={settingsForm.easyPaisaNumber}
                          onChange={(e) => setSettingsForm((f) => ({ ...f, easyPaisaNumber: e.target.value }))}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={settingsForm.smsNotificationsEnabled}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, smsNotificationsEnabled: e.target.checked }))}
                      />
                      SMS notifications enabled
                    </label>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={settingsForm.emailNotificationsEnabled}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, emailNotificationsEnabled: e.target.checked }))}
                      />
                      Email notifications enabled
                    </label>
                  </div>

                  {settingsError && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{settingsError}</div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
