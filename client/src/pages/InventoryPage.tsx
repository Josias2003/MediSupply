import { formatRWF } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Search, AlertTriangle, Clock, Package, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const EMPTY_FORM = {
  code: "", name: "", category: "", unit: "",
  currentStock: "0", reorderPoint: "", reorderQuantity: "", unitCost: "",
  supplierId: "", expiryDate: "", batchNumber: "", storageLocation: "", description: "",
};

const CATEGORIES = [
  "Analgesic","Antibiotic","Antimalarial","IV Fluids","Cardiovascular",
  "Diabetes","Haematology","Vitamins","Consumables","Dermatology",
  "Respiratory","Gastroenterology","Rehydration","Other",
];

export default function InventoryPage() {
  const { data: supplies = [], isLoading, refetch } = trpc.inventory.list.useQuery();
  const { data: expiring = [] } = trpc.inventory.getExpiring.useQuery({ daysThreshold: 30 });
  const { data: supplierList = [] } = trpc.suppliers.list.useQuery();

  const createMutation = trpc.inventory.create.useMutation({
    onSuccess: () => { toast.success("Supply registered successfully"); refetch(); setShowCreate(false); setForm(EMPTY_FORM); },
    onError: e => toast.error(e.message),
  });
  const updateMutation = trpc.inventory.update.useMutation({
    onSuccess: () => { toast.success("Supply updated"); refetch(); setEditItem(null); },
    onError: e => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const categories = [...new Set([...CATEGORIES, ...supplies.map((s: any) => s.category)])];
  const expiringIds = new Set(expiring.map((e: any) => e.id));

  const filtered = supplies.filter((s: any) => {
    const ms = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase());
    const mc = filterCat === "all" || s.category === filterCat;
    const mst = filterStatus === "all" ||
      (filterStatus === "low" && s.currentStock <= s.reorderPoint) ||
      (filterStatus === "ok" && s.currentStock > s.reorderPoint) ||
      (filterStatus === "expiring" && expiringIds.has(s.id));
    return ms && mc && mst;
  });

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditForm({
      name: item.name ?? "",
      category: item.category ?? "",
      unit: item.unit ?? "",
      currentStock: String(item.currentStock ?? 0),
      reorderPoint: String(item.reorderPoint ?? 0),
      reorderQuantity: String(item.reorderQuantity ?? 0),
      unitCost: String(item.unitCost ?? ""),
      supplierId: item.supplierId ? String(item.supplierId) : "",
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split("T")[0] : "",
      batchNumber: item.batchNumber ?? "",
      storageLocation: item.storageLocation ?? "",
      description: item.description ?? "",
    });
  };

  const handleCreate = () => {
    if (!form.code || !form.name || !form.category || !form.unit || !form.unitCost)
      return toast.error("Code, Name, Category, Unit and Unit Cost are required");
    createMutation.mutate({
      code: form.code.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      unit: form.unit.trim(),
      currentStock: parseInt(form.currentStock) || 0,
      reorderPoint: parseInt(form.reorderPoint) || 0,
      reorderQuantity: parseInt(form.reorderQuantity) || 0,
      unitCost: form.unitCost.trim(),
      supplierId: form.supplierId ? parseInt(form.supplierId) : undefined,
      expiryDate: form.expiryDate ? new Date(form.expiryDate) : undefined,
      batchNumber: form.batchNumber || undefined,
      storageLocation: form.storageLocation || undefined,
      description: form.description || undefined,
    });
  };

  const handleUpdate = () => {
    if (!editItem) return;
    const data: any = {};
    if (editForm.name) data.name = editForm.name;
    if (editForm.category) data.category = editForm.category;
    if (editForm.unit) data.unit = editForm.unit;
    if (editForm.currentStock !== "") data.currentStock = parseInt(editForm.currentStock);
    if (editForm.reorderPoint !== "") data.reorderPoint = parseInt(editForm.reorderPoint);
    if (editForm.reorderQuantity !== "") data.reorderQuantity = parseInt(editForm.reorderQuantity);
    if (editForm.unitCost) data.unitCost = editForm.unitCost.trim();
    data.supplierId = editForm.supplierId ? parseInt(editForm.supplierId) : null;
    data.expiryDate = editForm.expiryDate ? new Date(editForm.expiryDate) : null;
    data.batchNumber = editForm.batchNumber || undefined;
    data.storageLocation = editForm.storageLocation || undefined;
    data.description = editForm.description || undefined;
    updateMutation.mutate({ id: editItem.id, data });
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">
            {supplies.length} items · {(supplies as any[]).filter((s: any) => s.currentStock <= s.reorderPoint).length} low stock · {expiring.length} expiring soon
          </p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Supply
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, code, category..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {[...new Set(supplies.map((s: any) => s.category))].map((c: any) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="ok">In Stock</SelectItem>
            <SelectItem value="expiring">Expiring</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterCat !== "all" || filterStatus !== "all") && (
          <Button variant="outline" onClick={() => { setSearch(""); setFilterCat("all"); setFilterStatus("all"); }}>Clear</Button>
        )}
      </div>

      {/* Items List */}
      <div className="grid gap-3">
        {filtered.map((item: any) => {
          const isLow = item.currentStock <= item.reorderPoint;
          const isExp = expiringIds.has(item.id);
          const isExpanded = expandedId === item.id;
          return (
            <Card key={item.id} className={`p-4 ${isLow ? "border-l-4 border-l-red-500" : isExp ? "border-l-4 border-l-orange-500" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold">{item.name}</p>
                    <Badge variant="outline" className="text-xs">{item.code}</Badge>
                    <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                    {isLow && <Badge variant="destructive" className="text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Low Stock</Badge>}
                    {isExp && <Badge className="bg-orange-100 text-orange-700 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />Expiring</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-sm text-muted-foreground">
                    <span>Stock: <strong className={isLow ? "text-red-600" : "text-green-600"}>{item.currentStock} {item.unit}</strong></span>
                    <span>Reorder at: {item.reorderPoint}</span>
                    <span>Unit Cost: {formatRWF(item.unitCost)}</span>
                    {item.batchNumber && <span>Batch: {item.batchNumber}</span>}
                    {item.storageLocation && <span>Location: {item.storageLocation}</span>}
                    {item.expiryDate && <span className={isExp ? "text-orange-600 font-medium" : ""}>Expires: {new Date(item.expiryDate).toLocaleDateString()}</span>}
                  </div>
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Reorder Qty: <strong className="text-foreground">{item.reorderQuantity}</strong></span>
                      <span className="text-muted-foreground">Unit: <strong className="text-foreground">{item.unit}</strong></span>
                      {item.supplierId && <span className="text-muted-foreground">Supplier ID: <strong className="text-foreground">#{item.supplierId}</strong></span>}
                      {item.description && <span className="col-span-2 text-muted-foreground">Notes: <span className="text-foreground">{item.description}</span></span>}
                      <span className="text-muted-foreground text-xs col-span-3">Added: {new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-2xl font-bold">{item.currentStock}</p>
                    <p className="text-xs text-muted-foreground">{item.unit}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEdit(item)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            No inventory items match your filters
          </Card>
        )}
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Register New Medical Supply</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Code *</label>
              <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="MED-021" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Aspirin 500mg" /></div>

            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Category *</label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Unit *</label>
              <Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="tablets / bags / vials" /></div>

            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Opening Stock</label>
              <Input type="number" min="0" value={form.currentStock} onChange={e => setForm(p => ({ ...p, currentStock: e.target.value }))} placeholder="0" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Unit Cost (RWF) *</label>
              <Input type="number" step="1" min="0" value={form.unitCost} onChange={e => setForm(p => ({ ...p, unitCost: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="0" /></div>

            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Reorder Point</label>
              <Input type="number" min="0" value={form.reorderPoint} onChange={e => setForm(p => ({ ...p, reorderPoint: e.target.value }))} placeholder="50" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Reorder Quantity</label>
              <Input type="number" min="0" value={form.reorderQuantity} onChange={e => setForm(p => ({ ...p, reorderQuantity: e.target.value }))} placeholder="200" /></div>

            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Primary Supplier</label>
              <Select value={form.supplierId} onValueChange={v => setForm(p => ({ ...p, supplierId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {(supplierList as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Expiry Date</label>
              <Input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} /></div>

            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Batch Number</label>
              <Input value={form.batchNumber} onChange={e => setForm(p => ({ ...p, batchNumber: e.target.value }))} placeholder="B2026-001" /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Storage Location</label>
              <Input value={form.storageLocation} onChange={e => setForm(p => ({ ...p, storageLocation: e.target.value }))} placeholder="Shelf A1" /></div>

            <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground mb-1 block">Description / Notes</label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Additional notes..." /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Saving...</> : "Add Supply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={editItem !== null} onOpenChange={open => !open && setEditItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supply — {editItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <Input value={editForm.name ?? ""} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <Select value={editForm.category} onValueChange={v => setEditForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select></div>

            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Unit</label>
              <Input value={editForm.unit ?? ""} onChange={e => setEditForm(p => ({ ...p, unit: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Current Stock</label>
              <Input type="number" min="0" value={editForm.currentStock ?? ""} onChange={e => setEditForm(p => ({ ...p, currentStock: e.target.value }))} /></div>

            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Unit Cost (RWF)</label>
              <Input type="number" step="1" min="0" value={editForm.unitCost ?? ""} onChange={e => setEditForm(p => ({ ...p, unitCost: e.target.value.replace(/[^0-9]/g, '') }))} /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Reorder Point</label>
              <Input type="number" min="0" value={editForm.reorderPoint ?? ""} onChange={e => setEditForm(p => ({ ...p, reorderPoint: e.target.value }))} /></div>

            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Reorder Quantity</label>
              <Input type="number" min="0" value={editForm.reorderQuantity ?? ""} onChange={e => setEditForm(p => ({ ...p, reorderQuantity: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Primary Supplier</label>
              <Select value={editForm.supplierId ?? ""} onValueChange={v => setEditForm(p => ({ ...p, supplierId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {(supplierList as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select></div>

            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Expiry Date</label>
              <Input type="date" value={editForm.expiryDate ?? ""} onChange={e => setEditForm(p => ({ ...p, expiryDate: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Batch Number</label>
              <Input value={editForm.batchNumber ?? ""} onChange={e => setEditForm(p => ({ ...p, batchNumber: e.target.value }))} /></div>

            <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Storage Location</label>
              <Input value={editForm.storageLocation ?? ""} onChange={e => setEditForm(p => ({ ...p, storageLocation: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground mb-1 block">Description / Notes</label>
              <Input value={editForm.description ?? ""} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
