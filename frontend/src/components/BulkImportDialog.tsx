import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import type { School, BulkImportSummary } from '@/types';

type Kind = 'students' | 'teachers';

// Shared Bulk Import dialog for both Students and Teachers - download an
// .xlsx template, fill it in offline, upload it back. Reused as-is by both
// StudentsPage and TeachersPage so the flow (and the row-by-row results
// table) looks and behaves identically everywhere it appears.
export function BulkImportDialog({
  kind,
  open,
  onOpenChange,
  onImported,
}: {
  kind: Kind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const { user, hasRole } = useAuth();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');
  const label = kind === 'students' ? 'Students' : 'Teachers';

  const [schoolId, setSchoolId] = useState(isUnrestricted ? '' : user?.schoolId ?? '');
  const [branchId, setBranchId] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BulkImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
    enabled: open,
  });

  const branches = useMemo(() => {
    const effectiveSchoolId = isUnrestricted ? schoolId : user?.schoolId;
    return schoolsQuery.data?.find((s) => s.id === effectiveSchoolId)?.branches ?? [];
  }, [schoolsQuery.data, schoolId, isUnrestricted, user?.schoolId]);

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const effectiveSchoolId = isUnrestricted ? schoolId : user?.schoolId;
      const formData = new FormData();
      formData.append('file', file);
      const qs = `schoolId=${encodeURIComponent(effectiveSchoolId ?? '')}&branchId=${encodeURIComponent(branchId)}`;
      return api.upload<BulkImportSummary>(`/${kind}/bulk-import?${qs}`, formData);
    },
    onSuccess: (data) => {
      setSummary(data);
      setError(null);
      if (data.created > 0) onImported();
    },
    onError: (err: unknown) => {
      setSummary(null);
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  function reset() {
    setSchoolId(isUnrestricted ? '' : user?.schoolId ?? '');
    setBranchId('');
    setFileName(null);
    setError(null);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function downloadTemplate() {
    api.downloadBlob(`/${kind}/bulk-import/template`, `${kind}-import-template.xlsx`);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileName(file?.name ?? null);
    setSummary(null);
    setError(null);
  }

  function handleImport() {
    const effectiveSchoolId = isUnrestricted ? schoolId : user?.schoolId;
    if (!effectiveSchoolId) return setError('Please select a school.');
    if (!branchId) return setError('Please select a branch.');
    const file = fileInputRef.current?.files?.[0];
    if (!file) return setError('Please choose the filled-in .xlsx file to upload.');
    setError(null);
    importMutation.mutate(file);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Bulk Import {label}</DialogTitle>
          <DialogDescription>
            Download the template, fill in one row per {kind === 'students' ? 'student' : 'teacher'}, then upload it
            back. Each row is created independently - if one row has a problem, the rest still import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Step 1 — Download the template</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    An .xlsx file with the correct column headers and one example row.
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4" />
                Template
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isUnrestricted && (
              <div>
                <Label className="mb-1.5 inline-block">
                  School <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={schoolId}
                  onValueChange={(v) => {
                    setSchoolId(v);
                    setBranchId('');
                  }}
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
              </div>
            )}
            <div>
              <Label className="mb-1.5 inline-block">
                Branch <span className="text-destructive">*</span>
              </Label>
              <Select value={branchId} onValueChange={setBranchId} disabled={!branches.length}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 inline-block">
              Step 2 — Upload the filled-in file <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>
            {fileName && <p className="mt-1 text-xs text-muted-foreground">Selected: {fileName}</p>}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {summary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="success">{summary.created} created</Badge>
                {summary.failed > 0 && <Badge variant="destructive">{summary.failed} failed</Badge>}
                <span className="text-sm text-muted-foreground">of {summary.total} rows</span>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.results.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell className="tabular-nums text-muted-foreground">{r.row}</TableCell>
                        <TableCell className="text-muted-foreground">{r.identifier ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {r.status === 'created' ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                            )}
                            <span className={r.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                              {r.message}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {summary ? 'Close' : 'Cancel'}
          </Button>
          <Button type="button" onClick={handleImport} loading={importMutation.isPending}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
