import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Users, Plus, UserCheck, UserX, Link, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLE_COLOR: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  pharmacist: "bg-blue-100 text-blue-700",
  procurement_officer: "bg-purple-100 text-purple-700",
  supplier: "bg-orange-100 text-orange-700",
  accountant: "bg-green-100 text-green-700",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  pharmacist: "Pharmacist",
  procurement_officer: "Procurement Officer",
  supplier: "Supplier",
  accountant: "Accountant",
};

export default function UserManagementPage() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.userManagement.list.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();

  const createUser = trpc.userManagement.create.useMutation({
    onSuccess: () => { toast.success("User created successfully"); utils.userManagement.list.invalidate(); setShowCreate(false); resetForm(); },
    onError: e => toast.error(e.message),
  });
  const updateRole = trpc.userManagement.updateRole.useMutation({
    onSuccess: () => { toast.success("Role updated"); utils.userManagement.list.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const toggleActive = trpc.userManagement.toggleActive.useMutation({
    onSuccess: () => { toast.success("Status updated"); utils.userManagement.list.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const linkUser = trpc.suppliers.linkUser.useMutation({
    onSuccess: () => { toast.success("Supplier account linked"); utils.userManagement.list.invalidate(); utils.suppliers.list.invalidate(); setShowLink(false); },
    onError: e => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkForm, setLinkForm] = useState({ supplierId: "", userId: "" });
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "pharmacist" as string, supplierId: "" });

  const resetForm = () => setForm({ email: "", password: "", name: "", role: "pharmacist", supplierId: "" });

  // Find linked supplier name for a user
  const getLinkedSupplier = (user: any) => {
    if (user.role !== "supplier" || !user.supplierId) return null;
    return (suppliers as any[]).find((s: any) => s.id === user.supplierId);
  };

  // Supplier users without a linked system user
  const unlinkedSuppliers = (suppliers as any[]).filter((s: any) =>
    !s.userId && !(users as any[]).some((u: any) => u.supplierId === s.id)
  );

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  const supplierUsers = (users as any[]).filter((u: any) => u.role === "supplier");
  const unlinkedSupplierUsers = supplierUsers.filter((u: any) => !u.supplierId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="w-7 h-7 text-primary" />User Management</h1>
          <p className="text-muted-foreground mt-1">{(users as any[]).length} registered users</p>
        </div>
        <div className="flex gap-2">
          {unlinkedSupplierUsers.length > 0 && (
            <Button variant="outline" onClick={() => setShowLink(true)} className="gap-2 border-orange-300 text-orange-700">
              <Link className="w-4 h-4" /> Link Supplier Accounts ({unlinkedSupplierUsers.length})
            </Button>
          )}
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create User
          </Button>
        </div>
      </div>

      {/* Alert: unlinked supplier users */}
      {unlinkedSupplierUsers.length > 0 && (
        <Card className="p-4 border-orange-200 bg-orange-50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-orange-800 text-sm">Supplier accounts not linked to a supplier company</p>
            <p className="text-xs text-orange-700 mt-1">
              {unlinkedSupplierUsers.map((u: any) => u.name).join(", ")} — click "Link Supplier Accounts" to connect them.
            </p>
          </div>
        </Card>
      )}

      {/* Users list */}
      <div className="space-y-3">
        {(users as any[]).map((u: any) => {
          const linked = getLinkedSupplier(u);
          return (
            <Card key={u.id} className="p-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold">{u.name}</p>
                    <Badge className={`text-xs ${ROLE_COLOR[u.role] || "bg-gray-100 text-gray-700"}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </Badge>
                    {!u.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                    {u.role === "supplier" && !linked && (
                      <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">No supplier linked</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                  {linked && (
                    <p className="text-xs text-orange-700 mt-0.5 flex items-center gap-1">
                      <Link className="w-3 h-3" /> Linked to: <span className="font-medium">{linked.name}</span>
                    </p>
                  )}
                  {u.lastLogin && (
                    <p className="text-xs text-muted-foreground mt-0.5">Last login: {new Date(u.lastLogin).toLocaleString()}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <Select value={u.role} onValueChange={v => updateRole.mutate({ userId: u.id, role: v as any })}>
                    <SelectTrigger className="h-8 text-xs w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline"
                    className={u.isActive ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}
                    onClick={() => toggleActive.mutate({ userId: u.id, isActive: !u.isActive })}>
                    {u.isActive
                      ? <><UserX className="w-3 h-3 mr-1" />Deactivate</>
                      : <><UserCheck className="w-3 h-3 mr-1" />Activate</>}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {(users as any[]).length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            No users yet
          </Card>
        )}
      </div>

      {/* CREATE USER DIALOG */}
      <Dialog open={showCreate} onOpenChange={open => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <label className="text-sm font-medium">Full Name *</label>
              <Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Dr. Jane Doe" />
            </div>
            <div>
              <label className="text-sm font-medium">Email *</label>
              <Input className="mt-1" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="user@hospital.rw" />
            </div>
            <div>
              <label className="text-sm font-medium">Password *</label>
              <Input className="mt-1" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min. 8 characters" />
            </div>
            <div>
              <label className="text-sm font-medium">Role *</label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v, supplierId: "" }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show supplier picker when role = supplier */}
            {form.role === "supplier" && (
              <div>
                <label className="text-sm font-medium">Link to Supplier Company</label>
                <p className="text-xs text-muted-foreground mb-1">
                  Select the supplier company this user belongs to. This gives them access to that company's purchase orders.
                </p>
                <Select value={form.supplierId} onValueChange={v => setForm(p => ({ ...p, supplierId: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select supplier company (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers as any[]).map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} {s.userId ? "· (already has user)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(suppliers as any[]).length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">No supplier companies yet. Add one in the Suppliers page first.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button
              disabled={createUser.isPending}
              onClick={() => {
                if (!form.name || !form.email || !form.password) return toast.error("Fill all required fields");
                createUser.mutate({
                  name: form.name,
                  email: form.email,
                  password: form.password,
                  role: form.role as any,
                  supplierId: form.supplierId ? Number(form.supplierId) : undefined,
                });
              }}>
              {createUser.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Creating...</> : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LINK SUPPLIER DIALOG */}
      <Dialog open={showLink} onOpenChange={setShowLink}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Supplier User to Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Connect a supplier user account to a supplier company so they can see and act on purchase orders sent to that company.
            </p>
            <div>
              <label className="text-sm font-medium">Supplier User</label>
              <Select value={linkForm.userId} onValueChange={v => setLinkForm(p => ({ ...p, userId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select supplier user" /></SelectTrigger>
                <SelectContent>
                  {(users as any[])
                    .filter((u: any) => u.role === "supplier" && !u.supplierId)
                    .map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.email})</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Supplier Company</label>
              <Select value={linkForm.supplierId} onValueChange={v => setLinkForm(p => ({ ...p, supplierId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select supplier company" /></SelectTrigger>
                <SelectContent>
                  {(suppliers as any[]).map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} {s.userId ? "· (already linked)" : "· available"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowLink(false)}>Cancel</Button>
            <Button
              disabled={linkUser.isPending || !linkForm.supplierId || !linkForm.userId}
              onClick={() => linkUser.mutate({ supplierId: Number(linkForm.supplierId), userId: Number(linkForm.userId) })}>
              {linkUser.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Linking...</> : "Link Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
