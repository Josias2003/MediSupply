import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Building2, Plus, Search, Star, Phone, Mail, MapPin, Link, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SuppliersPage() {
  const utils = trpc.useUtils();
  const { data: suppliers = [], isLoading } = trpc.suppliers.list.useQuery();
  const { data: allUsers = [] } = trpc.userManagement.list.useQuery();

  const createSupplier = trpc.suppliers.create.useMutation({
    onSuccess: () => { toast.success("Supplier added"); utils.suppliers.list.invalidate(); utils.userManagement.list.invalidate(); setShowCreate(false); resetForm(); },
    onError: e => toast.error(e.message),
  });
  const linkUser = trpc.suppliers.linkUser.useMutation({
    onSuccess: () => { toast.success("User account linked to supplier"); utils.suppliers.list.invalidate(); utils.userManagement.list.invalidate(); setLinkSupplierId(null); },
    onError: e => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [linkSupplierId, setLinkSupplierId] = useState<number | null>(null);
  const [linkUserId, setLinkUserId] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", contactPerson: "", phone: "",
    address: "", city: "", country: "Rwanda", paymentTerms: "", userId: "",
  });

  const resetForm = () => setForm({ name: "", email: "", contactPerson: "", phone: "", address: "", city: "", country: "Rwanda", paymentTerms: "", userId: "" });

  const filtered = (suppliers as any[]).filter((s: any) =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.city || "").toLowerCase().includes(search.toLowerCase())
  );

  // Supplier-role users available to link
  const supplierUsers = (allUsers as any[]).filter((u: any) => u.role === "supplier");

  // Get linked user name for a supplier
  const getLinkedUser = (supplier: any) => {
    if (!supplier.userId) return null;
    return supplierUsers.find((u: any) => u.id === supplier.userId);
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Building2 className="w-7 h-7 text-primary" />Supplier Management</h1>
          <p className="text-muted-foreground mt-1">{(suppliers as any[]).length} registered supplier companies</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Supplier
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name, email, city..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((s: any) => {
          const linkedUser = getLinkedUser(s);
          return (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-lg">{s.name}</p>
                  {s.contactPerson && <p className="text-sm text-muted-foreground">{s.contactPerson}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(star => (
                    <Star key={star} className={`w-3.5 h-3.5 ${Number(s.rating || 0) >= star ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
                  ))}
                </div>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                {s.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 shrink-0" />{s.email}</div>}
                {s.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 shrink-0" />{s.phone}</div>}
                {s.city && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 shrink-0" />{s.city}{s.country ? `, ${s.country}` : ""}</div>}
                {s.paymentTerms && <div className="flex items-center gap-2"><span className="text-xs">💳</span>Payment: {s.paymentTerms}</div>}
              </div>

              {/* Linked user account */}
              <div className="mt-3 pt-3 border-t">
                {linkedUser ? (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>System user: <span className="font-medium">{linkedUser.name}</span> ({linkedUser.email})</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-orange-600">No system user linked</span>
                    {supplierUsers.length > 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-orange-300 text-orange-700"
                        onClick={() => { setLinkSupplierId(s.id); setLinkUserId(""); }}>
                        <Link className="w-3 h-3" /> Link User
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Badge variant={s.isActive ? "secondary" : "destructive"} className="text-xs">
                  {s.isActive ? "Active" : "Inactive"}
                </Badge>
                {s.totalOrders > 0 && <span className="text-xs text-muted-foreground">{s.totalOrders} orders</span>}
                {s.averageDeliveryDays && <span className="text-xs text-muted-foreground">~{s.averageDeliveryDays}d delivery</span>}
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="col-span-2 p-12 text-center text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            No suppliers found
          </Card>
        )}
      </div>

      {/* ADD SUPPLIER DIALOG */}
      <Dialog open={showCreate} onOpenChange={open => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add New Supplier Company</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Company Name *</label>
                <Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Rwanda Medical Supplies Ltd" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Email *</label>
                <Input className="mt-1" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="contact@supplier.rw" />
              </div>
              <div>
                <label className="text-sm font-medium">Contact Person</label>
                <Input className="mt-1" value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input className="mt-1" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+250 7XX XXX XXX" />
              </div>
              <div>
                <label className="text-sm font-medium">City</label>
                <Input className="mt-1" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Kigali" />
              </div>
              <div>
                <label className="text-sm font-medium">Country</label>
                <Input className="mt-1" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Payment Terms</label>
                <Input className="mt-1" placeholder="e.g. Net 30" value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))} />
              </div>
            </div>

            {/* Optional: link to existing supplier user at creation time */}
            {supplierUsers.length > 0 && (
              <div>
                <label className="text-sm font-medium">Link to System User (optional)</label>
                <p className="text-xs text-muted-foreground mb-1">
                  If a supplier user account already exists for this company, link them now so they can access their purchase orders.
                </p>
                <Select value={form.userId} onValueChange={v => setForm(p => ({ ...p, userId: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select supplier user account (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No user yet —</SelectItem>
                    {supplierUsers.filter((u: any) => !u.supplierId).map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button
              disabled={createSupplier.isPending}
              onClick={() => {
                if (!form.name || !form.email) return toast.error("Company name and email are required");
                createSupplier.mutate({
                  name: form.name,
                  email: form.email,
                  contactPerson: form.contactPerson || undefined,
                  phone: form.phone || undefined,
                  city: form.city || undefined,
                  country: form.country || undefined,
                  paymentTerms: form.paymentTerms || undefined,
                  userId: form.userId && form.userId !== "none" ? Number(form.userId) : undefined,
                });
              }}>
              {createSupplier.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Adding...</> : "Add Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LINK USER DIALOG */}
      <Dialog open={linkSupplierId !== null} onOpenChange={open => !open && setLinkSupplierId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link User Account to Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Select the supplier user account that belongs to <strong>{(suppliers as any[]).find((s: any) => s.id === linkSupplierId)?.name}</strong>.
              They will gain access to all purchase orders for this company.
            </p>
            <Select value={linkUserId} onValueChange={setLinkUserId}>
              <SelectTrigger><SelectValue placeholder="Select supplier user" /></SelectTrigger>
              <SelectContent>
                {supplierUsers.filter((u: any) => !u.supplierId).map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLinkSupplierId(null)}>Cancel</Button>
            <Button
              disabled={!linkUserId || linkUser.isPending}
              onClick={() => { if (linkSupplierId && linkUserId) linkUser.mutate({ supplierId: linkSupplierId, userId: Number(linkUserId) }); }}>
              {linkUser.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Linking...</> : "Link Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
