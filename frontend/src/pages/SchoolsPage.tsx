import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { School } from '@/types';

export default function SchoolsPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canCreateSchool = hasRole('DIRECTOR', 'ADMIN');
  const canCreateBranch = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');

  const [schoolDialogOpen, setSchoolDialogOpen] = useState(false);
  const [schoolForm, setSchoolForm] = useState({ name: '', code: '', address: '', phone: '' });
  const [schoolError, setSchoolError] = useState<string | null>(null);

  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({ schoolId: '', name: '', genderScope: '' });
  const [branchError, setBranchError] = useState<string | null>(null);

  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
  });

  const createSchoolMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/schools', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      setSchoolDialogOpen(false);
      setSchoolForm({ name: '', code: '', address: '', phone: '' });
      setSchoolError(null);
    },
    onError: (err: unknown) => {
      setSchoolError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/branches', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      setBranchDialogOpen(false);
      setBranchForm({ schoolId: '', name: '', genderScope: '' });
      setBranchError(null);
    },
    onError: (err: unknown) => {
      setBranchError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong');
    },
  });

  function openBranchDialog(schoolId?: string) {
    setBranchForm({ schoolId: schoolId ?? '', name: '', genderScope: '' });
    setBranchError(null);
    setBranchDialogOpen(true);
  }

  function handleSchoolSubmit(e: FormEvent) {
    e.preventDefault();
    setSchoolError(null);
    if (!schoolForm.name || !schoolForm.code) {
      setSchoolError('Name and code are required.');
      return;
    }
    createSchoolMutation.mutate({
      name: schoolForm.name,
      code: schoolForm.code,
      address: schoolForm.address || undefined,
      phone: schoolForm.phone || undefined,
    });
  }

  function handleBranchSubmit(e: FormEvent) {
    e.preventDefault();
    setBranchError(null);
    if (!branchForm.schoolId || !branchForm.name) {
      setBranchError('School and branch name are required.');
      return;
    }
    createBranchMutation.mutate({
      schoolId: branchForm.schoolId,
      name: branchForm.name,
      genderScope: branchForm.genderScope || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Schools &amp; Branches</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {schoolsQuery.data?.length ?? 0} school{schoolsQuery.data?.length === 1 ? '' : 's'} under your account
          </p>
        </div>
        <div className="flex gap-2">
          {canCreateBranch && (
            <Button variant="outline" onClick={() => openBranchDialog()}>
              <Plus className="h-4 w-4" />
              Add Branch
            </Button>
          )}
          {canCreateSchool && (
            <Button onClick={() => setSchoolDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add School
            </Button>
          )}
        </div>
      </div>

      {schoolsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !schoolsQuery.data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium text-foreground">No schools yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {schoolsQuery.data.map((school) => (
            <Card key={school.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{school.name}</CardTitle>
                  <CardDescription className="mt-1">Code: {school.code}</CardDescription>
                </div>
                <Badge variant={school.isActive ? 'success' : 'secondary'}>
                  {school.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                {school.address && <p className="text-sm text-muted-foreground">{school.address}</p>}
                <div className="mt-3 space-y-1.5">
                  {school.branches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No branches yet.</p>
                  ) : (
                    school.branches.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm text-foreground">{b.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {b.genderScope}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
                {canCreateBranch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 -ml-2"
                    onClick={() => openBranchDialog(school.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add branch to this school
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add School dialog */}
      <Dialog open={schoolDialogOpen} onOpenChange={setSchoolDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add School</DialogTitle>
            <DialogDescription>Create a new campus/school under your account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSchoolSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={schoolForm.name}
                onChange={(e) => setSchoolForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                value={schoolForm.code}
                onChange={(e) => setSchoolForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. JND"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={schoolForm.address}
                onChange={(e) => setSchoolForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={schoolForm.phone}
                onChange={(e) => setSchoolForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            {schoolError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {schoolError}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSchoolDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createSchoolMutation.isPending}>
                Create School
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Branch dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Branch</DialogTitle>
            <DialogDescription>Create a new branch/campus under a school.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBranchSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                School <span className="text-destructive">*</span>
              </Label>
              <Select
                value={branchForm.schoolId}
                onValueChange={(v) => setBranchForm((f) => ({ ...f, schoolId: v }))}
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
            <div className="space-y-1.5">
              <Label>
                Branch name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={branchForm.name}
                onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Boys Campus"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gender scope</Label>
              <Select
                value={branchForm.genderScope}
                onValueChange={(v) => setBranchForm((f) => ({ ...f, genderScope: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOYS">Boys</SelectItem>
                  <SelectItem value="GIRLS">Girls</SelectItem>
                  <SelectItem value="MIXED">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {branchError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {branchError}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBranchDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createBranchMutation.isPending}>
                Create Branch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
