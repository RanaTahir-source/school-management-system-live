import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bus, Pencil, Plus, Route as RouteIcon, Trash2, User as UserIcon, UserRoundCog } from 'lucide-react';
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
import type { School, StudentProfile, Driver, Vehicle, TransportRoute, RouteStop, StudentTransportAssignment } from '@/types';

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

function EmptyState({ icon: Icon, label }: { icon: typeof Bus; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

const driverForm0 = { schoolId: '', fullName: '', phone: '', cnic: '', licenseNo: '', address: '' };
const vehicleForm0 = { schoolId: '', registrationNo: '', vehicleType: '', make: '', capacity: '', driverId: '' };
const routeForm0 = { schoolId: '', name: '', monthlyFare: '', vehicleId: '' };
const stopForm0 = { routeId: '', name: '', pickupTime: '' };

export default function TransportPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');
  const canManage = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');
  const canDelete = hasRole('DIRECTOR', 'ADMIN');
  const isStudent = hasRole('STUDENT');

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: () => api.get<School[]>('/schools') });

  // ─────────────────────────── Drivers tab ───────────────────────────
  const driversQuery = useQuery({ queryKey: ['transport', 'drivers'], queryFn: () => api.get<Driver[]>('/transport/drivers') });
  const [driverOpen, setDriverOpen] = useState(false);
  const [driverForm, setDriverForm] = useState(driverForm0);
  const [driverError, setDriverError] = useState<string | null>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [deactivateDriver, setDeactivateDriver] = useState<Driver | null>(null);

  const createDriver = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/transport/drivers', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'drivers'] });
      setDriverOpen(false);
      setDriverForm(driverForm0);
      setDriverError(null);
    },
    onError: (err: unknown) => setDriverError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateDriver = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/transport/drivers/${editingDriverId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'drivers'] });
      setDriverOpen(false);
      setEditingDriverId(null);
      setDriverForm(driverForm0);
      setDriverError(null);
    },
    onError: (err: unknown) => setDriverError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deactivateDriverMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transport/drivers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'drivers'] });
      setDeactivateDriver(null);
    },
  });

  function openDriverDialog() {
    setEditingDriverId(null);
    setDriverForm({ ...driverForm0, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setDriverError(null);
    setDriverOpen(true);
  }
  function openEditDriverDialog(d: Driver) {
    setEditingDriverId(d.id);
    setDriverForm({
      schoolId: d.schoolId,
      fullName: d.fullName,
      phone: d.phone ?? '',
      cnic: d.cnic ?? '',
      licenseNo: d.licenseNo ?? '',
      address: d.address ?? '',
    });
    setDriverError(null);
    setDriverOpen(true);
  }
  function submitDriver(e: FormEvent) {
    e.preventDefault();
    setDriverError(null);
    if (editingDriverId) {
      if (!driverForm.fullName) {
        setDriverError('Please fill all required fields.');
        return;
      }
      updateDriver.mutate({
        fullName: driverForm.fullName,
        phone: driverForm.phone || undefined,
        cnic: driverForm.cnic || undefined,
        licenseNo: driverForm.licenseNo || undefined,
        address: driverForm.address || undefined,
      });
      return;
    }
    const effectiveSchoolId = isUnrestricted ? driverForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !driverForm.fullName) {
      setDriverError('Please fill all required fields.');
      return;
    }
    createDriver.mutate({
      schoolId: effectiveSchoolId,
      fullName: driverForm.fullName,
      phone: driverForm.phone || undefined,
      cnic: driverForm.cnic || undefined,
      licenseNo: driverForm.licenseNo || undefined,
      address: driverForm.address || undefined,
    });
  }

  // ─────────────────────────── Vehicles tab ───────────────────────────
  const vehiclesQuery = useQuery({ queryKey: ['transport', 'vehicles'], queryFn: () => api.get<Vehicle[]>('/transport/vehicles') });
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(vehicleForm0);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [deactivateVehicle, setDeactivateVehicle] = useState<Vehicle | null>(null);

  const createVehicle = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/transport/vehicles', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'vehicles'] });
      setVehicleOpen(false);
      setVehicleForm(vehicleForm0);
      setVehicleError(null);
    },
    onError: (err: unknown) => setVehicleError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateVehicle = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/transport/vehicles/${editingVehicleId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'vehicles'] });
      setVehicleOpen(false);
      setEditingVehicleId(null);
      setVehicleForm(vehicleForm0);
      setVehicleError(null);
    },
    onError: (err: unknown) => setVehicleError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deactivateVehicleMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transport/vehicles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'vehicles'] });
      setDeactivateVehicle(null);
    },
  });

  function openVehicleDialog() {
    setEditingVehicleId(null);
    setVehicleForm({ ...vehicleForm0, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setVehicleError(null);
    setVehicleOpen(true);
  }
  function openEditVehicleDialog(v: Vehicle) {
    setEditingVehicleId(v.id);
    setVehicleForm({
      schoolId: v.schoolId,
      registrationNo: v.registrationNo,
      vehicleType: v.vehicleType ?? '',
      make: v.make ?? '',
      capacity: v.capacity !== null && v.capacity !== undefined ? String(v.capacity) : '',
      driverId: v.driverId ?? '',
    });
    setVehicleError(null);
    setVehicleOpen(true);
  }
  function submitVehicle(e: FormEvent) {
    e.preventDefault();
    setVehicleError(null);
    if (editingVehicleId) {
      if (!vehicleForm.registrationNo) {
        setVehicleError('Please fill all required fields.');
        return;
      }
      updateVehicle.mutate({
        registrationNo: vehicleForm.registrationNo,
        vehicleType: vehicleForm.vehicleType || undefined,
        make: vehicleForm.make || undefined,
        capacity: vehicleForm.capacity ? Number(vehicleForm.capacity) : undefined,
        driverId: vehicleForm.driverId || undefined,
      });
      return;
    }
    const effectiveSchoolId = isUnrestricted ? vehicleForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !vehicleForm.registrationNo) {
      setVehicleError('Please fill all required fields.');
      return;
    }
    createVehicle.mutate({
      schoolId: effectiveSchoolId,
      registrationNo: vehicleForm.registrationNo,
      vehicleType: vehicleForm.vehicleType || undefined,
      make: vehicleForm.make || undefined,
      capacity: vehicleForm.capacity ? Number(vehicleForm.capacity) : undefined,
      driverId: vehicleForm.driverId || undefined,
    });
  }

  // ─────────────────────────── Routes tab ───────────────────────────
  const routesQuery = useQuery({ queryKey: ['transport', 'routes'], queryFn: () => api.get<TransportRoute[]>('/transport/routes') });
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => api.get<StudentProfile[]>('/students'),
    enabled: canManage,
  });

  const [routeOpen, setRouteOpen] = useState(false);
  const [routeForm, setRouteForm] = useState(routeForm0);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [deactivateRoute, setDeactivateRoute] = useState<TransportRoute | null>(null);

  const createRoute = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/transport/routes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'routes'] });
      setRouteOpen(false);
      setRouteForm(routeForm0);
      setRouteError(null);
    },
    onError: (err: unknown) => setRouteError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateRoute = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/transport/routes/${editingRouteId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'routes'] });
      setRouteOpen(false);
      setEditingRouteId(null);
      setRouteForm(routeForm0);
      setRouteError(null);
    },
    onError: (err: unknown) => setRouteError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const deactivateRouteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transport/routes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'routes'] });
      setDeactivateRoute(null);
    },
  });

  function openRouteDialog() {
    setEditingRouteId(null);
    setRouteForm({ ...routeForm0, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setRouteError(null);
    setRouteOpen(true);
  }
  function openEditRouteDialog(route: TransportRoute) {
    setEditingRouteId(route.id);
    setRouteForm({
      schoolId: route.schoolId,
      name: route.name,
      monthlyFare: route.monthlyFare ?? '',
      vehicleId: route.vehicleId ?? '',
    });
    setRouteError(null);
    setRouteOpen(true);
  }
  function submitRoute(e: FormEvent) {
    e.preventDefault();
    setRouteError(null);
    if (editingRouteId) {
      if (!routeForm.name) {
        setRouteError('Please fill all required fields.');
        return;
      }
      updateRoute.mutate({
        name: routeForm.name,
        monthlyFare: routeForm.monthlyFare ? Number(routeForm.monthlyFare) : undefined,
        vehicleId: routeForm.vehicleId || undefined,
      });
      return;
    }
    const effectiveSchoolId = isUnrestricted ? routeForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId || !routeForm.name) {
      setRouteError('Please fill all required fields.');
      return;
    }
    createRoute.mutate({
      schoolId: effectiveSchoolId,
      name: routeForm.name,
      monthlyFare: routeForm.monthlyFare ? Number(routeForm.monthlyFare) : undefined,
      vehicleId: routeForm.vehicleId || undefined,
    });
  }

  // Stops
  const [stopOpen, setStopOpen] = useState(false);
  const [stopForm, setStopForm] = useState(stopForm0);
  const [stopError, setStopError] = useState<string | null>(null);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [deleteStop, setDeleteStop] = useState<{ id: string; name: string } | null>(null);

  const createStop = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/transport/route-stops', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'routes'] });
      setStopOpen(false);
      setStopForm(stopForm0);
      setStopError(null);
    },
    onError: (err: unknown) => setStopError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const updateStop = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/transport/route-stops/${editingStopId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'routes'] });
      setStopOpen(false);
      setEditingStopId(null);
      setStopForm(stopForm0);
      setStopError(null);
    },
    onError: (err: unknown) => setStopError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });
  const removeStop = useMutation({
    mutationFn: (id: string) => api.delete(`/transport/route-stops/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'routes'] });
      setDeleteStop(null);
    },
  });

  function openStopDialog(routeId: string) {
    setEditingStopId(null);
    setStopForm({ ...stopForm0, routeId });
    setStopError(null);
    setStopOpen(true);
  }
  function openEditStopDialog(stop: RouteStop) {
    setEditingStopId(stop.id);
    setStopForm({ routeId: stop.routeId, name: stop.name, pickupTime: stop.pickupTime ?? '' });
    setStopError(null);
    setStopOpen(true);
  }
  function submitStop(e: FormEvent) {
    e.preventDefault();
    setStopError(null);
    if (!stopForm.name) {
      setStopError('Please enter a stop name.');
      return;
    }
    if (editingStopId) {
      updateStop.mutate({
        name: stopForm.name,
        pickupTime: stopForm.pickupTime || undefined,
      });
      return;
    }
    createStop.mutate({
      routeId: stopForm.routeId,
      name: stopForm.name,
      pickupTime: stopForm.pickupTime || undefined,
    });
  }

  // Assign student to stop
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ studentId: '', routeStopId: '' });
  const [assignError, setAssignError] = useState<string | null>(null);

  const assignStudent = useMutation({
    mutationFn: ({ studentId, routeStopId }: { studentId: string; routeStopId: string | null }) =>
      api.patch(`/transport/students/${studentId}`, { routeStopId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'routes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setAssignOpen(false);
      setAssignForm({ studentId: '', routeStopId: '' });
      setAssignError(null);
    },
    onError: (err: unknown) => setAssignError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function openAssignDialog() {
    setAssignForm({ studentId: '', routeStopId: '' });
    setAssignError(null);
    setAssignOpen(true);
  }
  function submitAssign(e: FormEvent) {
    e.preventDefault();
    setAssignError(null);
    if (!assignForm.studentId || !assignForm.routeStopId) {
      setAssignError('Please select a student and a pickup stop.');
      return;
    }
    assignStudent.mutate({ studentId: assignForm.studentId, routeStopId: assignForm.routeStopId });
  }

  const allStops = (routesQuery.data ?? []).flatMap((r) => r.stops.map((s) => ({ ...s, routeName: r.name })));

  // ─────────────────────────── My Transport tab ───────────────────────────
  const myTransportQuery = useQuery({
    queryKey: ['transport', 'me'],
    queryFn: () => api.get<StudentTransportAssignment>('/transport/students/me'),
    enabled: isStudent,
    retry: false,
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Transport</h2>
        <p className="mt-1 text-sm text-muted-foreground">Vehicles, drivers, pickup routes, and student allocation.</p>
      </div>

      <Tabs defaultValue={isStudent && !canManage ? 'mine' : 'routes'}>
        <TabsList>
          {canManage && <TabsTrigger value="vehicles">Vehicles</TabsTrigger>}
          {canManage && <TabsTrigger value="drivers">Drivers</TabsTrigger>}
          <TabsTrigger value="routes">Routes</TabsTrigger>
          {isStudent && <TabsTrigger value="mine">My Transport</TabsTrigger>}
        </TabsList>

        {/* ── Vehicles ── */}
        {canManage && (
          <TabsContent value="vehicles">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div />
                <Button onClick={openVehicleDialog}>
                  <Plus className="h-4 w-4" />
                  Add Vehicle
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {vehiclesQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !vehiclesQuery.data?.length ? (
                  <EmptyState icon={Bus} label="No vehicles added yet" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Registration No.</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Status</TableHead>
                        {canManage && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehiclesQuery.data.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium text-foreground">{v.registrationNo}</TableCell>
                          <TableCell className="text-muted-foreground">{v.vehicleType ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{v.capacity ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{v.driver?.fullName ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={v.isActive ? 'success' : 'secondary'}>{v.isActive ? 'Active' : 'Inactive'}</Badge>
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditVehicleDialog(v)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {canDelete && v.isActive && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => setDeactivateVehicle(v)}
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
        )}

        {/* ── Drivers ── */}
        {canManage && (
          <TabsContent value="drivers">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div />
                <Button onClick={openDriverDialog}>
                  <Plus className="h-4 w-4" />
                  Add Driver
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {driversQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : !driversQuery.data?.length ? (
                  <EmptyState icon={UserRoundCog} label="No drivers added yet" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>License No.</TableHead>
                        <TableHead>Status</TableHead>
                        {canManage && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {driversQuery.data.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium text-foreground">{d.fullName}</TableCell>
                          <TableCell className="text-muted-foreground">{d.phone ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{d.licenseNo ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={d.isActive ? 'success' : 'secondary'}>{d.isActive ? 'Active' : 'Inactive'}</Badge>
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditDriverDialog(d)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {canDelete && d.isActive && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => setDeactivateDriver(d)}
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
        )}

        {/* ── Routes ── */}
        <TabsContent value="routes">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div />
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={openAssignDialog}>
                    <UserIcon className="h-4 w-4" />
                    Assign Student
                  </Button>
                  <Button onClick={openRouteDialog}>
                    <Plus className="h-4 w-4" />
                    Add Route
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {routesQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : !routesQuery.data?.length ? (
                <EmptyState icon={RouteIcon} label="No routes added yet" />
              ) : (
                routesQuery.data.map((route) => (
                  <div key={route.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{route.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {route.vehicle ? `${route.vehicle.registrationNo} (${route.vehicle.vehicleType ?? 'Vehicle'})` : 'No vehicle assigned'}
                          {route.monthlyFare ? ` · Rs. ${route.monthlyFare}/month` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={route.isActive ? 'success' : 'secondary'}>{route.isActive ? 'Active' : 'Inactive'}</Badge>
                        {canManage && (
                          <Button variant="ghost" size="sm" onClick={() => openStopDialog(route.id)}>
                            <Plus className="h-4 w-4" />
                            Add Stop
                          </Button>
                        )}
                        {canManage && (
                          <Button variant="ghost" size="sm" onClick={() => openEditRouteDialog(route)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && route.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeactivateRoute(route)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {route.stops.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                        {route.stops.map((stop) => (
                          <div key={stop.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="text-foreground">
                              {stop.name}
                              {stop.pickupTime && <span className="text-muted-foreground"> · {stop.pickupTime}</span>}
                              {!!stop.students?.length && (
                                <span className="text-muted-foreground"> · {stop.students.length} student(s)</span>
                              )}
                            </span>
                            {canManage && (
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-7" onClick={() => openEditStopDialog(stop)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeleteStop({ id: stop.id, name: stop.name })}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── My Transport ── */}
        {isStudent && (
          <TabsContent value="mine">
            <Card>
              <CardContent className="pt-6">
                {myTransportQuery.isLoading ? (
                  <Skeleton className="h-11 w-full" />
                ) : !myTransportQuery.data ? (
                  <EmptyState icon={Bus} label="You are not assigned to a transport route yet" />
                ) : (
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Route: </span>
                      <span className="font-medium text-foreground">{myTransportQuery.data.route.name}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Pickup stop: </span>
                      <span className="font-medium text-foreground">{myTransportQuery.data.name}</span>
                    </p>
                    {myTransportQuery.data.pickupTime && (
                      <p>
                        <span className="text-muted-foreground">Pickup time: </span>
                        <span className="font-medium text-foreground">{myTransportQuery.data.pickupTime}</span>
                      </p>
                    )}
                    {myTransportQuery.data.route.vehicle && (
                      <p>
                        <span className="text-muted-foreground">Vehicle: </span>
                        <span className="font-medium text-foreground">{myTransportQuery.data.route.vehicle.registrationNo}</span>
                      </p>
                    )}
                    {myTransportQuery.data.route.monthlyFare && (
                      <p>
                        <span className="text-muted-foreground">Monthly fare: </span>
                        <span className="font-medium text-foreground">Rs. {myTransportQuery.data.route.monthlyFare}</span>
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Add/Edit driver dialog */}
      <Dialog
        open={driverOpen}
        onOpenChange={(open) => {
          setDriverOpen(open);
          if (!open) setEditingDriverId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDriverId ? 'Edit Driver' : 'Add Driver'}</DialogTitle>
            <DialogDescription>
              {editingDriverId
                ? "Update this driver's contact details."
                : "Drivers don't need a login account - just contact details for reference."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitDriver} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select
                  value={driverForm.schoolId}
                  onValueChange={(v) => setDriverForm((f) => ({ ...f, schoolId: v }))}
                  disabled={!!editingDriverId}
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
            <Field label="Full name" required>
              <Input value={driverForm.fullName} onChange={(e) => setDriverForm((f) => ({ ...f, fullName: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone">
                <Input value={driverForm.phone} onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
              <Field label="CNIC">
                <Input value={driverForm.cnic} onChange={(e) => setDriverForm((f) => ({ ...f, cnic: e.target.value }))} />
              </Field>
              <Field label="License No.">
                <Input value={driverForm.licenseNo} onChange={(e) => setDriverForm((f) => ({ ...f, licenseNo: e.target.value }))} />
              </Field>
              <Field label="Address">
                <Input value={driverForm.address} onChange={(e) => setDriverForm((f) => ({ ...f, address: e.target.value }))} />
              </Field>
            </div>
            {driverError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{driverError}</div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDriverOpen(false);
                  setEditingDriverId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingDriverId ? updateDriver.isPending : createDriver.isPending}>
                {editingDriverId ? 'Save Changes' : 'Add Driver'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit vehicle dialog */}
      <Dialog
        open={vehicleOpen}
        onOpenChange={(open) => {
          setVehicleOpen(open);
          if (!open) setEditingVehicleId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVehicleId ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
            <DialogDescription>
              {editingVehicleId
                ? "Update this vehicle's details."
                : 'Register a van, bus, or coaster used for student transport.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitVehicle} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select
                  value={vehicleForm.schoolId}
                  onValueChange={(v) => setVehicleForm((f) => ({ ...f, schoolId: v }))}
                  disabled={!!editingVehicleId}
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
            <Field label="Registration No." required>
              <Input value={vehicleForm.registrationNo} onChange={(e) => setVehicleForm((f) => ({ ...f, registrationNo: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <Input placeholder="Van, Bus, Coaster..." value={vehicleForm.vehicleType} onChange={(e) => setVehicleForm((f) => ({ ...f, vehicleType: e.target.value }))} />
              </Field>
              <Field label="Make">
                <Input value={vehicleForm.make} onChange={(e) => setVehicleForm((f) => ({ ...f, make: e.target.value }))} />
              </Field>
              <Field label="Capacity">
                <Input type="number" min={1} value={vehicleForm.capacity} onChange={(e) => setVehicleForm((f) => ({ ...f, capacity: e.target.value }))} />
              </Field>
              <Field label="Driver (optional)">
                <Select value={vehicleForm.driverId || '__none__'} onValueChange={(v) => setVehicleForm((f) => ({ ...f, driverId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="No driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No driver</SelectItem>
                    {(driversQuery.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {vehicleError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{vehicleError}</div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setVehicleOpen(false);
                  setEditingVehicleId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingVehicleId ? updateVehicle.isPending : createVehicle.isPending}>
                {editingVehicleId ? 'Save Changes' : 'Add Vehicle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit route dialog */}
      <Dialog
        open={routeOpen}
        onOpenChange={(open) => {
          setRouteOpen(open);
          if (!open) setEditingRouteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRouteId ? 'Edit Route' : 'Add Route'}</DialogTitle>
            <DialogDescription>
              {editingRouteId ? "Update this route's name, fare, or assigned vehicle." : 'Create a pickup route, then add stops to it.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRoute} className="space-y-4">
            {isUnrestricted && (
              <Field label="School" required>
                <Select
                  value={routeForm.schoolId}
                  onValueChange={(v) => setRouteForm((f) => ({ ...f, schoolId: v }))}
                  disabled={!!editingRouteId}
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
            <Field label="Route name" required>
              <Input placeholder="e.g. Route 1 - City Center" value={routeForm.name} onChange={(e) => setRouteForm((f) => ({ ...f, name: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Monthly fare (Rs.)">
                <Input type="number" min={0} value={routeForm.monthlyFare} onChange={(e) => setRouteForm((f) => ({ ...f, monthlyFare: e.target.value }))} />
              </Field>
              <Field label="Vehicle (optional)">
                <Select value={routeForm.vehicleId || '__none__'} onValueChange={(v) => setRouteForm((f) => ({ ...f, vehicleId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="No vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No vehicle</SelectItem>
                    {(vehiclesQuery.data ?? []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.registrationNo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {routeError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{routeError}</div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRouteOpen(false);
                  setEditingRouteId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingRouteId ? updateRoute.isPending : createRoute.isPending}>
                {editingRouteId ? 'Save Changes' : 'Add Route'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit stop dialog */}
      <Dialog
        open={stopOpen}
        onOpenChange={(open) => {
          setStopOpen(open);
          if (!open) setEditingStopId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStopId ? 'Edit Pickup Stop' : 'Add Pickup Stop'}</DialogTitle>
            <DialogDescription>
              {editingStopId ? "Update this stop's name or pickup time." : 'Add a boarding point to this route.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitStop} className="space-y-4">
            <Field label="Stop name" required>
              <Input value={stopForm.name} onChange={(e) => setStopForm((f) => ({ ...f, name: e.target.value }))} required />
            </Field>
            <Field label="Pickup time">
              <Input placeholder="e.g. 07:15 AM" value={stopForm.pickupTime} onChange={(e) => setStopForm((f) => ({ ...f, pickupTime: e.target.value }))} />
            </Field>
            {stopError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{stopError}</div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStopOpen(false);
                  setEditingStopId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingStopId ? updateStop.isPending : createStop.isPending}>
                {editingStopId ? 'Save Changes' : 'Add Stop'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign student dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Student to a Pickup Stop</DialogTitle>
            <DialogDescription>Enroll a student in school transport.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAssign} className="space-y-4">
            <Field label="Student" required>
              <Select value={assignForm.studentId} onValueChange={(v) => setAssignForm((f) => ({ ...f, studentId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {(studentsQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.user.fullName} — {s.admissionNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pickup stop" required>
              <Select value={assignForm.routeStopId} onValueChange={(v) => setAssignForm((f) => ({ ...f, routeStopId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stop" />
                </SelectTrigger>
                <SelectContent>
                  {allStops.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.routeName} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {assignError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{assignError}</div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={assignStudent.isPending}>
                Assign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateVehicle}
        onOpenChange={(open) => !open && setDeactivateVehicle(null)}
        title="Deactivate vehicle?"
        description={`This will mark "${deactivateVehicle?.registrationNo ?? ''}" as inactive.`}
        confirmLabel="Deactivate"
        loading={deactivateVehicleMutation.isPending}
        onConfirm={() => deactivateVehicle && deactivateVehicleMutation.mutate(deactivateVehicle.id)}
      />
      <ConfirmDialog
        open={!!deactivateDriver}
        onOpenChange={(open) => !open && setDeactivateDriver(null)}
        title="Deactivate driver?"
        description={`This will mark "${deactivateDriver?.fullName ?? ''}" as inactive.`}
        confirmLabel="Deactivate"
        loading={deactivateDriverMutation.isPending}
        onConfirm={() => deactivateDriver && deactivateDriverMutation.mutate(deactivateDriver.id)}
      />
      <ConfirmDialog
        open={!!deactivateRoute}
        onOpenChange={(open) => !open && setDeactivateRoute(null)}
        title="Deactivate route?"
        description={`This will mark "${deactivateRoute?.name ?? ''}" as inactive.`}
        confirmLabel="Deactivate"
        loading={deactivateRouteMutation.isPending}
        onConfirm={() => deactivateRoute && deactivateRouteMutation.mutate(deactivateRoute.id)}
      />
      <ConfirmDialog
        open={!!deleteStop}
        onOpenChange={(open) => !open && setDeleteStop(null)}
        title="Remove pickup stop?"
        description={`This will remove "${deleteStop?.name ?? ''}" and unassign any students on it.`}
        confirmLabel="Remove"
        destructive
        loading={removeStop.isPending}
        onConfirm={() => deleteStop && removeStop.mutate(deleteStop.id)}
      />
    </div>
  );
}
