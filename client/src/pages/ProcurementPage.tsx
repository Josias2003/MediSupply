import { formatRWF } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, ShoppingCart, Search, Truck, CheckCircle, Clock, Package, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft:            { label: "Draft",             color: "bg-gray-100 text-gray-700 border-gray-200",     icon: Clock },
  sent:             { label: "Sent",              color: "bg-blue-100 text-blue-700 border-blue-200",     icon: Truck },
  acknowledged:     { label: "Acknowledged",      color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: CheckCircle },
  partial_delivery: { label: "Partial Delivery",  color: "bg-amber-100 text-amber-700 border-amber-200",  icon: Package },
  delivered:        { label: "Delivered",         color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle },
  cancelled:        { label: "Cancelled",         color: "bg-red-100 text-red-700 border-red-200",        icon: Clock },
};

export default function ProcurementPage() {
  const { user } = useAuth();
  const { data: orders = [], isLoading, refetch } = trpc.purchaseOrders.list.useQuery(undefined, { refetchOnMount: "always", staleTime: 0 });
  const { data: suppliersData = [] } = trpc.suppliers.list.useQuery();

  const updateStatus = trpc.purchaseOrders.updateStatus.useMutation({
    onSuccess: (_, vars) => {
      const msg: Record<string, string> = { sent: "PO sent to supplier — they will be notified", acknowledged: "Marked as acknowledged", delivered: "Delivery confirmed", cancelled: "Order cancelled" };
      toast.success(msg[vars.status] || "Status updated");
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewItems, setViewItems] = useState<any[] | null>(null);
  const [viewPO, setViewPO] = useState<any>(null);

  const { data: poItemsData = [] } = trpc.purchaseOrders.getItems.useQuery(
    viewPO?.id ?? 0,
    { enabled: viewPO !== null }
  );

  const isProcurement = user?.role === "procurement_officer" || user?.role === "admin";
  const isSupplier = user?.role === "supplier";

  const filtered = (orders as any[]).filter((o: any) => {
    const ms = !search || o.poNumber?.toLowerCase().includes(search.toLowerCase()) || o.notes?.toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === "all" || o.status === statusFilter;
    return ms && mf;
  });

  const supplierMap = new Map((suppliersData as any[]).map((s: any) => [s.id, s.name]));

  const counts = (orders as any[]).reduce((acc: Record<string, number>, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Purchase Orders</h1>
        <p className="text-muted-foreground mt-1">{(orders as any[]).length} total orders across all statuses</p>
      </div>

      {/* Status Summary Row */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setStatusFilter("all")} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusFilter === "all" ? "bg-primary text-white border-primary" : "border-gray-200 text-muted-foreground hover:border-primary/50"}`}>
          All ({(orders as any[]).length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => counts[key] ? (
          <button key={key} onClick={() => setStatusFilter(key)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusFilter === key ? "bg-primary text-white border-primary" : `${cfg.color} hover:opacity-80`}`}>
            {cfg.label} ({counts[key]})
          </button>
        ) : null)}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by PO number or notes…" className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="space-y-3">
        {filtered.map((o: any) => {
          const cfg = STATUS_CONFIG[o.status] ?? { label: o.status, color: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock };
          const Icon = cfg.icon;
          const isExpanded = expandedId === o.id;
          const isOverdue = o.expectedDeliveryDate && new Date(o.expectedDeliveryDate) < new Date() && !["delivered","cancelled"].includes(o.status);

          return (
            <Card key={o.id} className={`p-4 ${isOverdue ? "border-orange-300" : ""}`}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold">{o.poNumber}</p>
                    <Badge className={`text-xs border ${cfg.color}`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                    {isOverdue && <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200">Overdue</Badge>}
                    {o.requisitionId && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">From requisition</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                    <span>Value: <strong className="text-foreground">{formatRWF(o.totalAmount)}</strong></span>
                    {o.supplierId && <span>Supplier: <strong className="text-foreground">{supplierMap.get(o.supplierId) || `#${o.supplierId}`}</strong></span>}
                    {o.expectedDeliveryDate && <span className={isOverdue ? "text-orange-600 font-medium" : ""}>Expected: {new Date(o.expectedDeliveryDate).toLocaleDateString("en-RW", { dateStyle: "medium" })}</span>}
                    {o.deliveryDate && <span className="text-green-600">Delivered: {new Date(o.deliveryDate).toLocaleDateString("en-RW", { dateStyle: "medium" })}</span>}
                    <span className="text-xs">Created {new Date(o.createdAt).toLocaleDateString()}</span>
                  </div>
                  {o.notes && isExpanded && <p className="text-xs text-muted-foreground mt-2 italic">"{o.notes}"</p>}
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {/* Procurement actions */}
                  {isProcurement && o.status === "draft" && (
                    <Button size="sm" variant="outline" className="gap-1 border-blue-300 text-blue-700" disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ poId: o.id, status: "sent" })}>
                      <Truck className="w-3 h-3" />Send to Supplier
                    </Button>
                  )}
                  {isProcurement && o.status === "partial_delivery" && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1" disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ poId: o.id, status: "delivered" })}>
                      <CheckCircle className="w-3 h-3" />Confirm Delivery
                    </Button>
                  )}
                  {/* Supplier actions (when supplier views via /procurement) */}
                  {isSupplier && o.status === "sent" && (
                    <Button size="sm" className="bg-green-600 text-white gap-1" disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ poId: o.id, status: "acknowledged" })}>
                      <CheckCircle className="w-3 h-3" />Confirm Order
                    </Button>
                  )}
                  {/* View line items */}
                  <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-muted-foreground"
                    onClick={() => { setViewPO(o); }}>
                    <Package className="w-3.5 h-3.5" />Items
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                    onClick={() => setExpandedId(isExpanded ? null : o.id)}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-40" />
            {search || statusFilter !== "all" ? "No orders match your filters" : "No purchase orders yet"}
          </Card>
        )}
      </div>

      {/* View PO Items Dialog */}
      <Dialog open={viewPO !== null} onOpenChange={open => !open && setViewPO(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Line Items — {viewPO?.poNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
            {poItemsData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No line items recorded</p>
            ) : (poItemsData as any[]).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded text-sm">
                <div>
                  <p className="font-medium">{item.supplyName ?? `Supply #${item.supplyId}`}</p>
                  <p className="text-xs text-muted-foreground">{item.supplyUnit} · Unit cost: {formatRWF(item.unitCost)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">× {item.quantity}</p>
                  {item.deliveredQuantity != null && item.deliveredQuantity < item.quantity && (
                    <p className="text-xs text-amber-600">{item.deliveredQuantity} delivered</p>
                  )}
                  <p className="text-xs text-muted-foreground">{formatRWF(Number(item.unitCost) * item.quantity)}</p>
                </div>
              </div>
            ))}
            {poItemsData.length > 0 && (
              <div className="flex justify-between pt-2 border-t text-sm font-semibold">
                <span>Order Total</span>
                <span>{formatRWF(viewPO?.totalAmount)}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewPO(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
