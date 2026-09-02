import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Boxes, Package, Pencil, Plus, Settings2, Trash2, Wrench } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
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
import { formatCurrency, formatDate } from '@/lib/utils';
import type {
  School,
  StudentProfile,
  InventoryItem,
  InventoryTransaction,
  InventoryTransactionType,
  InventoryProfitLossReport,
  Asset,
  AssetCondition,
  StaffUser,
} from '@/types';

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
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

export default function InventoryPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Inventory & Assets</h2>
        <p className="mt-1 text-sm text-muted-foreground">School shop stock, POS sales, and fixed asset tracking.</p>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory & POS</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <InventoryTab />
        </TabsContent>
        <TabsContent value="assets">
          <AssetsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// INVENTORY & POS
// ─────────────────────────────────────────────────────────────────────────

type ItemForm = {
  schoolId: string;
  branchId: string;
  name: string;
  category: string;
  sku: string;
  unit: string;
  costPrice: string;
  sellPrice: string;
  openingQuantity: string;
  reorderLevel: string;
};

const EMPTY_ITEM_FORM: ItemForm = {
  schoolId: '',
  branchId: '',
  name: '',
  category: '',
  sku: '',
  unit: 'pcs',
  costPrice: '',
  sellPrice: '',
  openingQuantity: '',
  reorderLevel: '',
};

function InventoryTab() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM_FORM);
  const [itemError, setItemError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [txnTarget, setTxnTarget] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  const itemsQuery = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => api.get<InventoryItem[]>('/inventory/items'),
  });
  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
    enabled: itemOpen,
  });

  const plQuery = useQuery({
    queryKey: ['inventory-pl'],
    queryFn: () => api.get<InventoryProfitLossReport>('/inventory/reports/profit-loss'),
  });

  const schoolBranches = schoolsQuery.data?.find((s) => s.id === (isUnrestricted ? itemForm.schoolId : user?.schoolId))?.branches ?? [];

  const createItemMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/inventory/items', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setItemOpen(false);
      setItemForm(EMPTY_ITEM_FORM);
      setItemError(null);
    },
    onError: (err: unknown) => setItemError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const updateItemMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/inventory/items/${editingItemId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setItemOpen(false);
      setEditingItemId(null);
      setItemForm(EMPTY_ITEM_FORM);
      setItemError(null);
    },
    onError: (err: unknown) => setItemError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setDeleteTarget(null);
    },
  });

  function openAddItem() {
    setEditingItemId(null);
    setItemForm({ ...EMPTY_ITEM_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setItemError(null);
    setItemOpen(true);
  }

  function openEditItem(item: InventoryItem) {
    setEditingItemId(item.id);
    setItemForm({
      schoolId: item.schoolId,
      branchId: item.branchId ?? '',
      name: item.name,
      category: item.category ?? '',
      sku: item.sku ?? '',
      unit: item.unit,
      costPrice: item.costPrice ?? '',
      sellPrice: item.sellPrice ?? '',
      openingQuantity: '',
      reorderLevel: item.reorderLevel != null ? String(item.reorderLevel) : '',
    });
    setItemError(null);
    setItemOpen(true);
  }

  function handleItemSubmit(e: FormEvent) {
    e.preventDefault();
    setItemError(null);
    if (!itemForm.name.trim()) return setItemError('Please enter an item name.');

    if (editingItemId) {
      updateItemMutation.mutate({
        name: itemForm.name,
        category: itemForm.category || undefined,
        sku: itemForm.sku || undefined,
        unit: itemForm.unit || 'pcs',
        costPrice: itemForm.costPrice ? Number(itemForm.costPrice) : undefined,
        sellPrice: itemForm.sellPrice ? Number(itemForm.sellPrice) : undefined,
        reorderLevel: itemForm.reorderLevel ? Number(itemForm.reorderLevel) : undefined,
      });
      return;
    }

    const effectiveSchoolId = isUnrestricted ? itemForm.schoolId : user?.schoolId;
    if (!effectiveSchoolId) return setItemError('Please select a school.');

    createItemMutation.mutate({
      schoolId: effectiveSchoolId,
      branchId: itemForm.branchId || undefined,
      name: itemForm.name,
      category: itemForm.category || undefined,
      sku: itemForm.sku || undefined,
      unit: itemForm.unit || 'pcs',
      costPrice: itemForm.costPrice ? Number(itemForm.costPrice) : undefined,
      sellPrice: itemForm.sellPrice ? Number(itemForm.sellPrice) : undefined,
      openingQuantity: itemForm.openingQuantity ? Number(itemForm.openingQuantity) : undefined,
      reorderLevel: itemForm.reorderLevel ? Number(itemForm.reorderLevel) : undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Revenue (all time)</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(plQuery.data?.totalRevenue ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Cost of Goods Sold</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(plQuery.data?.totalCost ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Profit</p>
            <p className="mt-1 text-lg font-semibold text-success">{formatCurrency(plQuery.data?.totalProfit ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={openAddItem}>
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {itemsQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !itemsQuery.data?.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Boxes className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No inventory items yet</p>
              <p className="text-sm text-muted-foreground">Add uniforms, stationery, or books sold at the school shop.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Cost / Sell Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsQuery.data.map((item) => {
                  const lowStock = item.reorderLevel != null && item.quantityOnHand <= item.reorderLevel;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-medium text-foreground">{item.name}</span>
                        {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.category ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums text-foreground">{item.quantityOnHand} {item.unit}</span>
                          {lowStock && (
                            <Badge variant="warning">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Low
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatCurrency(Number(item.costPrice))} / {formatCurrency(Number(item.sellPrice))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setTxnTarget(item)}>
                            <Settings2 className="h-4 w-4" />
                            Stock
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={itemOpen}
        onOpenChange={(o) => {
          setItemOpen(o);
          if (!o) setEditingItemId(null);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editingItemId ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
            <DialogDescription>An item sold at the school shop (uniform, stationery, book, etc.).</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleItemSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <Input value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} required />
              </Field>
              <Field label="Category">
                <Input value={itemForm.category} onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Uniform" />
              </Field>
              {isUnrestricted && (
                <Field label="School" required>
                  <Select
                    value={itemForm.schoolId}
                    onValueChange={(v) => setItemForm((f) => ({ ...f, schoolId: v, branchId: '' }))}
                    disabled={!!editingItemId}
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
              <Field label="Branch">
                <Select
                  value={itemForm.branchId || '__none__'}
                  onValueChange={(v) => setItemForm((f) => ({ ...f, branchId: v === '__none__' ? '' : v }))}
                  disabled={!!editingItemId || !schoolBranches.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All branches</SelectItem>
                    {schoolBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Unit">
                <Input value={itemForm.unit} onChange={(e) => setItemForm((f) => ({ ...f, unit: e.target.value }))} />
              </Field>
              <Field label="SKU / code">
                <Input value={itemForm.sku} onChange={(e) => setItemForm((f) => ({ ...f, sku: e.target.value }))} />
              </Field>
              <Field label="Cost price (Rs.)">
                <Input type="number" min={0} value={itemForm.costPrice} onChange={(e) => setItemForm((f) => ({ ...f, costPrice: e.target.value }))} />
              </Field>
              <Field label="Sell price (Rs.)">
                <Input type="number" min={0} value={itemForm.sellPrice} onChange={(e) => setItemForm((f) => ({ ...f, sellPrice: e.target.value }))} />
              </Field>
              {!editingItemId && (
                <Field label="Opening stock quantity">
                  <Input type="number" min={0} value={itemForm.openingQuantity} onChange={(e) => setItemForm((f) => ({ ...f, openingQuantity: e.target.value }))} />
                </Field>
              )}
              <Field label="Reorder level (low-stock alert)">
                <Input type="number" min={0} value={itemForm.reorderLevel} onChange={(e) => setItemForm((f) => ({ ...f, reorderLevel: e.target.value }))} />
              </Field>
            </div>
            {editingItemId && (
              <p className="text-xs text-muted-foreground">
                Stock quantity isn&apos;t edited here — use the Stock button to record a purchase, sale, or adjustment.
              </p>
            )}

            {itemError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{itemError}</div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setItemOpen(false);
                  setEditingItemId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingItemId ? updateItemMutation.isPending : createItemMutation.isPending}>
                {editingItemId ? 'Save Changes' : 'Add Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {txnTarget && (
        <StockTransactionDialog
          item={txnTarget}
          open={!!txnTarget}
          onOpenChange={(open) => !open && setTxnTarget(null)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-pl'] });
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove inventory item?"
        description={`This will deactivate "${deleteTarget?.name}". Past transactions are kept.`}
        confirmLabel="Remove"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function StockTransactionDialog({
  item,
  open,
  onOpenChange,
  onDone,
}: {
  item: InventoryItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [type, setType] = useState<InventoryTransactionType>('SALE');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('DECREASE');
  const [studentId, setStudentId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => api.get<StudentProfile[]>('/students'),
    enabled: type === 'SALE',
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/inventory/transactions', {
        itemId: item.id,
        type,
        quantity: Number(quantity),
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
        direction: type === 'ADJUSTMENT' ? direction : undefined,
        studentId: type === 'SALE' && studentId ? studentId : undefined,
        note: note || undefined,
      }),
    onSuccess: () => {
      onDone();
      onOpenChange(false);
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!Number(quantity) || Number(quantity) < 1) return setError('Please enter a valid quantity.');
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name} - Stock Movement</DialogTitle>
          <DialogDescription>Current stock: {item.quantityOnHand} {item.unit}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Type">
            <Select value={type} onValueChange={(v) => setType(v as InventoryTransactionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SALE">Sale (POS)</SelectItem>
                <SelectItem value="PURCHASE">Purchase (stock in)</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {type === 'ADJUSTMENT' && (
            <Field label="Direction">
              <Select value={direction} onValueChange={(v) => setDirection(v as 'INCREASE' | 'DECREASE')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DECREASE">Decrease (damage/loss)</SelectItem>
                  <SelectItem value="INCREASE">Increase (recount found more)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity" required>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </Field>
            <Field label="Unit price (Rs.)">
              <Input
                type="number"
                min={0}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder={type === 'SALE' ? String(item.sellPrice) : String(item.costPrice)}
              />
            </Field>
          </div>
          {type === 'SALE' && (
            <Field label="Sold to (optional)">
              <Select value={studentId || '__none__'} onValueChange={(v) => setStudentId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Not linked to a student" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not linked to a student</SelectItem>
                  {(studentsQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.user.fullName} — {s.admissionNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Note">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {type === 'SALE' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
              Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ASSETS
// ─────────────────────────────────────────────────────────────────────────

const CONDITION_BADGE: Record<AssetCondition, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  NEW: 'success',
  GOOD: 'default',
  FAIR: 'warning',
  POOR: 'warning',
  DAMAGED: 'destructive',
};

type AssetForm = {
  schoolId: string;
  branchId: string;
  name: string;
  category: string;
  assetTag: string;
  purchaseDate: string;
  purchaseCost: string;
  condition: AssetCondition;
  location: string;
  assignedToId: string;
  warrantyExpiryDate: string;
  notes: string;
};

const EMPTY_ASSET_FORM: AssetForm = {
  schoolId: '',
  branchId: '',
  name: '',
  category: '',
  assetTag: '',
  purchaseDate: '',
  purchaseCost: '',
  condition: 'GOOD',
  location: '',
  assignedToId: '',
  warrantyExpiryDate: '',
  notes: '',
};

function AssetsTab() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isUnrestricted = hasRole('DIRECTOR', 'ADMIN');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AssetForm>(EMPTY_ASSET_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);

  const assetsQuery = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.get<Asset[]>('/assets'),
  });
  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: () => api.get<School[]>('/schools'),
    enabled: formOpen,
  });
  const staffQuery = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => api.get<StaffUser[]>('/users'),
    enabled: formOpen,
  });

  const schoolBranches = schoolsQuery.data?.find((s) => s.id === (isUnrestricted ? form.schoolId : user?.schoolId))?.branches ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/assets', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setFormOpen(false);
      setForm(EMPTY_ASSET_FORM);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/assets/${editingAssetId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setFormOpen(false);
      setEditingAssetId(null);
      setForm(EMPTY_ASSET_FORM);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setDeleteTarget(null);
    },
  });

  function openAdd() {
    setEditingAssetId(null);
    setForm({ ...EMPTY_ASSET_FORM, schoolId: isUnrestricted ? '' : user?.schoolId ?? '' });
    setFormError(null);
    setFormOpen(true);
  }

  function openEditAsset(asset: Asset) {
    setEditingAssetId(asset.id);
    setForm({
      schoolId: asset.schoolId,
      branchId: asset.branchId ?? '',
      name: asset.name,
      category: asset.category ?? '',
      assetTag: asset.assetTag ?? '',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : '',
      purchaseCost: asset.purchaseCost ?? '',
      condition: asset.condition,
      location: asset.location ?? '',
      assignedToId: asset.assignedTo?.id ?? '',
      warrantyExpiryDate: asset.warrantyExpiryDate ? asset.warrantyExpiryDate.slice(0, 10) : '',
      notes: asset.notes ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) return setFormError('Please enter an asset name.');

    if (editingAssetId) {
      updateMutation.mutate({
        name: form.name,
        category: form.category || undefined,
        assetTag: form.assetTag || undefined,
        purchaseDate: form.purchaseDate || undefined,
        purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
        condition: form.condition,
        location: form.location || undefined,
        assignedToId: form.assignedToId || undefined,
        warrantyExpiryDate: form.warrantyExpiryDate || undefined,
        notes: form.notes || undefined,
      });
      return;
    }

    const effectiveSchoolId = isUnrestricted ? form.schoolId : user?.schoolId;
    if (!effectiveSchoolId) return setFormError('Please select a school.');

    createMutation.mutate({
      schoolId: effectiveSchoolId,
      branchId: form.branchId || undefined,
      name: form.name,
      category: form.category || undefined,
      assetTag: form.assetTag || undefined,
      purchaseDate: form.purchaseDate || undefined,
      purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
      condition: form.condition,
      location: form.location || undefined,
      assignedToId: form.assignedToId || undefined,
      warrantyExpiryDate: form.warrantyExpiryDate || undefined,
      notes: form.notes || undefined,
    });
  }

  const detail = useMemo(() => assetsQuery.data?.find((a) => a.id === detailId) ?? null, [assetsQuery.data, detailId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Asset
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {assetsQuery.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !assetsQuery.data?.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Package className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No assets tracked yet</p>
              <p className="text-sm text-muted-foreground">Add furniture, computers, and other fixed assets here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetsQuery.data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{a.name}</span>
                      {a.assetTag && <p className="text-xs text-muted-foreground">Tag: {a.assetTag}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.category ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={CONDITION_BADGE[a.condition]}>{a.condition}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.location ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{a.assignedTo?.fullName ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(a.id)}>
                          <Wrench className="h-4 w-4" />
                          Details
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditAsset(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingAssetId(null);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editingAssetId ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
            <DialogDescription>Furniture, electronics, lab equipment, or any other fixed asset.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </Field>
              <Field label="Category">
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Furniture" />
              </Field>
              {isUnrestricted && (
                <Field label="School" required>
                  <Select
                    value={form.schoolId}
                    onValueChange={(v) => setForm((f) => ({ ...f, schoolId: v, branchId: '' }))}
                    disabled={!!editingAssetId}
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
              <Field label="Branch">
                <Select
                  value={form.branchId || '__none__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, branchId: v === '__none__' ? '' : v }))}
                  disabled={!!editingAssetId || !schoolBranches.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
                    {schoolBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Asset tag / code">
                <Input value={form.assetTag} onChange={(e) => setForm((f) => ({ ...f, assetTag: e.target.value }))} />
              </Field>
              <Field label="Condition">
                <Select value={form.condition} onValueChange={(v) => setForm((f) => ({ ...f, condition: v as AssetCondition }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="GOOD">Good</SelectItem>
                    <SelectItem value="FAIR">Fair</SelectItem>
                    <SelectItem value="POOR">Poor</SelectItem>
                    <SelectItem value="DAMAGED">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Purchase date">
                <Input type="date" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
              </Field>
              <Field label="Purchase cost (Rs.)">
                <Input type="number" min={0} value={form.purchaseCost} onChange={(e) => setForm((f) => ({ ...f, purchaseCost: e.target.value }))} />
              </Field>
              <Field label="Location">
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Computer Lab" />
              </Field>
              <Field label="Assigned to (staff)">
                <Select value={form.assignedToId || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, assignedToId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Not assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not assigned</SelectItem>
                    {(staffQuery.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Warranty expiry">
                <Input type="date" value={form.warrantyExpiryDate} onChange={(e) => setForm((f) => ({ ...f, warrantyExpiryDate: e.target.value }))} />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
              </Field>
            </div>

            {formError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormOpen(false);
                  setEditingAssetId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editingAssetId ? updateMutation.isPending : createMutation.isPending}>
                {editingAssetId ? 'Save Changes' : 'Add Asset'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {detail && (
        <AssetDetailDialog
          asset={detail}
          open={!!detail}
          onOpenChange={(open) => !open && setDetailId(null)}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ['assets'] })}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete asset?"
        description={`This will permanently remove "${deleteTarget?.name}" from records.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function AssetDetailDialog({
  asset,
  open,
  onOpenChange,
  onChanged,
}: {
  asset: Asset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logDescription, setLogDescription] = useState('');
  const [logCost, setLogCost] = useState('');

  const addLogMutation = useMutation({
    mutationFn: () =>
      api.post(`/assets/${asset.id}/maintenance-logs`, {
        date: logDate,
        description: logDescription,
        cost: logCost ? Number(logCost) : undefined,
      }),
    onSuccess: () => {
      onChanged();
      setLogDescription('');
      setLogCost('');
    },
  });

  const disposeMutation = useMutation({
    mutationFn: () => api.patch(`/assets/${asset.id}`, { isDisposed: true }),
    onSuccess: () => {
      onChanged();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{asset.name}</DialogTitle>
          <DialogDescription>
            {asset.category ?? 'Asset'} {asset.assetTag ? `· Tag: ${asset.assetTag}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Purchase Cost</p>
              <p className="mt-1 font-medium text-foreground">{asset.purchaseCost ? formatCurrency(Number(asset.purchaseCost)) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Purchase Date</p>
              <p className="mt-1 font-medium text-foreground">{asset.purchaseDate ? formatDate(asset.purchaseDate) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Warranty Until</p>
              <p className="mt-1 font-medium text-foreground">{asset.warrantyExpiryDate ? formatDate(asset.warrantyExpiryDate) : '—'}</p>
            </div>
          </div>
          {asset.notes && <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">{asset.notes}</div>}

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Maintenance history</p>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
              {asset.maintenanceLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No maintenance logged yet.</p>
              ) : (
                asset.maintenanceLogs.map((log) => (
                  <div key={log.id} className="border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0">
                    <div className="flex justify-between">
                      <span className="text-foreground">{log.description}</span>
                      {log.cost && <span className="text-muted-foreground">{formatCurrency(Number(log.cost))}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(log.date)}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
                <Input type="number" placeholder="Cost (optional)" value={logCost} onChange={(e) => setLogCost(e.target.value)} />
              </div>
              <Textarea
                placeholder="What was done..."
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                rows={2}
              />
              <Button
                type="button"
                size="sm"
                disabled={!logDescription.trim()}
                loading={addLogMutation.isPending}
                onClick={() => addLogMutation.mutate()}
              >
                Add Maintenance Log
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          {!asset.isDisposed && (
            <Button type="button" variant="outline" className="text-destructive" loading={disposeMutation.isPending} onClick={() => disposeMutation.mutate()}>
              Mark Disposed
            </Button>
          )}
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
