/**
 * ProcurementDashboard
 *
 * Responsibilities:
 *  - Review & approve/reject submitted requisitions (chat with pharmacist per req)
 *  - Convert approved requisitions to Purchase Orders
 *  - Send POs to suppliers, track delivery
 *  - Chat with supplier on any PO
 *
 * NOT procurement's job: inventory, budgets, AI forecasting details, financial records
 */
import { formatRWF } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, ShoppingCart, Clock, Plus, Eye, CheckCircle, XCircle,
  FileText, Truck, Package, Trash2, MessageSquare, ChevronDown, ChevronUp
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ChatPanel from "@/components/ChatPanel";

const REQ_STATUS_COLOR: Record<string, string> = {
  draft:           "bg-gray-100 text-gray-700",
  submitted:       "bg-amber-100 text-amber-700",
  approved:        "bg-green-100 text-green-700",
  rejected:        "bg-red-100 text-red-700",
  converted_to_po: "bg-purple-100 text-purple-700",
};
const PO_STATUS_COLOR: Record<string, string> = {
  draft:            "bg-gray-100 text-gray-700",
  sent:             "bg-blue-100 text-blue-700",
  acknowledged:     "bg-indigo-100 text-indigo-700",
  partial_delivery: "bg-amber-100 text-amber-700",
  delivered:        "bg-green-100 text-green-700",
  cancelled:        "bg-red-100 text-red-700",
};

type POItem = { supplyId: string; quantity: string; unitCost: string };

export default function ProcurementDashboard() {
  const utils = trpc.useUtils();

  const { data: orders = [], isLoading, refetch: refetchOrders } = trpc.purchaseOrders.list.useQuery();
  const { data: requisitions = [] } = trpc.requisitions.list.useQuery();
  const { data: supplies = [] } = trpc.inventory.list.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();

  const approveMut = trpc.requisitions.approve.useMutation({
    onSuccess: () => { toast.success("Requisition approved — pharmacist notified"); utils.requisitions.list.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const rejectMut = trpc.requisitions.reject.useMutation({
    onSuccess: () => { toast.success("Requisition rejected"); utils.requisitions.list.invalidate(); setShowReject(false); setViewReqId(null); },
    onError: e => toast.error(e.message),
  });
  const createPoMut = trpc.purchaseOrders.create.useMutation({
    onSuccess: () => {
      toast.success("Purchase Order created — go to Orders tab to send it to the supplier");
      refetchOrders(); utils.purchaseOrders.list.invalidate(); utils.requisitions.list.invalidate();
      setShowCreatePO(false); resetPOForm(); setTab("orders");
    },
    onError: e => toast.error(e.message),
  });
  const updateStatus = trpc.purchaseOrders.updateStatus.useMutation({
    onSuccess: () => { toast.success("Order status updated"); refetchOrders(); utils.purchaseOrders.list.invalidate(); },
    onError: e => toast.error(e.message),
  });

  const [tab, setTab]     = useState<"requisitions" | "orders">("requisitions");
  const [viewReqId, setViewReqId]   = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [fromReqId, setFromReqId]   = useState<number | null>(null);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poNotes, setPoNotes]       = useState("");
  const [poDeliveryDate, setPoDeliveryDate] = useState("");
  const [poItems, setPoItems]       = useState<POItem[]>([{ supplyId: "", quantity: "", unitCost: "" }]);
  const [expandedPO, setExpandedPO] = useState<number | null>(null);
  const [chatReqId, setChatReqId]   = useState<number | null>(null);
  const [chatPoId, setChatPoId]     = useState<number | null>(null);

  const { data: viewReqItems = [] } = trpc.requisitions.getItems.useQuery(
    { requisitionId: viewReqId! }, { enabled: viewReqId !== null }
  );
  const { data: expandedPoItems = [] } = trpc.purchaseOrders.getItems.useQuery(
    expandedPO ?? 0, { enabled: expandedPO !== null }
  );
  const viewReq = viewReqId !== null ? (requisitions as any[]).find((r: any) => r.id === viewReqId) : null;

  const resetPOForm = () => { setFromReqId(null); setPoSupplierId(""); setPoNotes(""); setPoDeliveryDate(""); setPoItems([{ supplyId: "", quantity: "", unitCost: "" }]); };

  const openPOFromReq = (req: any, items: any[]) => {
    setFromReqId(req.id);
    setPoItems(items.length > 0
      ? items.map((it: any) => ({ supplyId: String(it.supplyId), quantity: String(it.quantity), unitCost: it.currentUnitCost || "0" }))
      : [{ supplyId: "", quantity: "", unitCost: "" }]);
    setShowCreatePO(true);
  };

  const handleCreatePO = () => {
    const valid = poItems.filter(i => i.supplyId && Number(i.quantity) > 0);
    if (!valid.length) return toast.error("Add at least one item with a quantity");
    if (!poSupplierId) return toast.error("Select a supplier");
    createPoMut.mutate({
      supplierId: Number(poSupplierId),
      requisitionId: fromReqId ?? undefined,
      items: valid.map(i => ({ supplyId: Number(i.supplyId), quantity: Number(i.quantity), unitCost: i.unitCost || "0" })),
      expectedDeliveryDate: poDeliveryDate ? new Date(poDeliveryDate) : undefined,
      notes: poNotes || undefined,
      sendImmediately: false,
    });
  };

  const submittedReqs = (requisitions as any[]).filter((r: any) => r.status === "submitted");
  const approvedReqs  = (requisitions as any[]).filter((r: any) => r.status === "approved");
  const allReqs       = (requisitions as any[]);
  const activeOrders  = (orders as any[]).filter((o: any) => !["delivered","cancelled"].includes(o.status));
  const allOrders     = (orders as any[]);

  // Chat panels
  if (chatReqId !== null) {
    const req = (requisitions as any[]).find((r: any) => r.id === chatReqId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setChatReqId(null)}>← Back</Button>
          <div><p className="font-semibold">{req?.requisitionNumber}</p><p className="text-xs text-muted-foreground">Pharmacist ↔ Procurement</p></div>
        </div>
        <div style={{ height: 520 }}>
          <ChatPanel entityType="requisition" entityId={chatReqId} entityLabel={req?.requisitionNumber} />
        </div>
      </div>
    );
  }
  if (chatPoId !== null) {
    const po = (orders as any[]).find((o: any) => o.id === chatPoId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setChatPoId(null)}>← Back</Button>
          <div><p className="font-semibold">{po?.poNumber}</p><p className="text-xs text-muted-foreground">Procurement ↔ Supplier</p></div>
        </div>
        <div style={{ height: 520 }}>
          <ChatPanel entityType="purchase_order" entityId={chatPoId} entityLabel={po?.poNumber} />
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Procurement</h1>
          <p className="text-muted-foreground mt-1">Requisitions, purchase orders, and supplier coordination</p>
        </div>
        <Button onClick={() => setShowCreatePO(true)} className="gap-2"><Plus className="w-4 h-4" />New Purchase Order</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pending Approval",  value: submittedReqs.length,  color: "text-amber-600",  bg: "bg-amber-50" },
          { label: "Ready for PO",      value: approvedReqs.length,   color: "text-green-600",  bg: "bg-green-50" },
          { label: "Active Orders",     value: activeOrders.length,   color: "text-blue-600",   bg: "bg-blue-50" },
          { label: "Total Orders",      value: allOrders.length,      color: "text-gray-600",   bg: "bg-gray-50" },
        ].map((s, i) => (
          <Card key={i} className={`p-3 ${s.bg}`}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: "requisitions", label: `Requisitions ${submittedReqs.length > 0 ? `(${submittedReqs.length} pending)` : ""}` },
          { key: "orders",       label: "Purchase Orders" },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── REQUISITIONS TAB ── */}
      {tab === "requisitions" && (
        <div className="space-y-3">
          {/* Pending approval banner */}
          {submittedReqs.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-amber-800 font-medium">{submittedReqs.length} requisition{submittedReqs.length > 1 ? "s" : ""} awaiting your approval</span>
            </div>
          )}

          {allReqs.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground"><FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />No requisitions yet</Card>
          ) : allReqs.map((req: any) => (
            <Card key={req.id} className={`p-4 ${req.status === "submitted" ? "border-amber-200 bg-amber-50/30" : ""}`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-semibold">{req.requisitionNumber}</p>
                    <Badge className={`text-xs capitalize ${REQ_STATUS_COLOR[req.status]}`}>{req.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(req.createdAt).toLocaleDateString()}
                    {req.totalAmount && Number(req.totalAmount) > 0 && ` · Est. ${formatRWF(Number(req.totalAmount))}`}
                    {req.notes && ` · "${req.notes}"`}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-wrap shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground"
                    onClick={() => setChatReqId(req.id)}>
                    <MessageSquare className="w-3.5 h-3.5" />Chat
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2"
                    onClick={() => setViewReqId(req.id)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  {req.status === "submitted" && (
                    <>
                      <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white gap-1"
                        disabled={approveMut.isPending}
                        onClick={() => approveMut.mutate({ requisitionId: req.id })}>
                        <CheckCircle className="w-3 h-3" />Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-200 gap-1"
                        onClick={() => { setViewReqId(req.id); setShowReject(true); }}>
                        <XCircle className="w-3 h-3" />Reject
                      </Button>
                    </>
                  )}
                  {req.status === "approved" && (
                    <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => { setViewReqId(req.id); openPOFromReq(req, []); }}>
                      <Plus className="w-3 h-3" />Create PO
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── ORDERS TAB ── */}
      {tab === "orders" && (
        <div className="space-y-3">
          {allOrders.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground"><ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />No orders yet</Card>
          ) : allOrders.map((o: any) => {
            const isExp = expandedPO === o.id;
            const isOverdue = o.expectedDeliveryDate && new Date(o.expectedDeliveryDate) < new Date() && !["delivered","cancelled"].includes(o.status);
            return (
              <Card key={o.id} className={isOverdue ? "border-orange-300" : ""}>
                <div className="flex items-center justify-between p-4 flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold">{o.poNumber}</p>
                      <Badge className={`text-xs ${PO_STATUS_COLOR[o.status]}`}>{o.status.replace(/_/g, " ")}</Badge>
                      {isOverdue && <Badge className="text-xs bg-orange-100 text-orange-700">Overdue</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatRWF(o.totalAmount)}
                      {o.expectedDeliveryDate && ` · Due ${new Date(o.expectedDeliveryDate).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground"
                      onClick={() => setChatPoId(o.id)}>
                      <MessageSquare className="w-3.5 h-3.5" />Chat
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground"
                      onClick={() => setExpandedPO(isExp ? null : o.id)}>
                      <Package className="w-3.5 h-3.5" />Items
                      {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                    {o.status === "draft" && (
                      <Button size="sm" variant="outline" className="h-8 gap-1 border-blue-300 text-blue-700"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ poId: o.id, status: "sent" })}>
                        <Truck className="w-3 h-3" />Send to Supplier
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded line items */}
                {isExp && (
                  <div className="border-t px-4 py-3 bg-muted/20 space-y-2">
                    {expandedPoItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">No line items recorded</p>
                    ) : (expandedPoItems as any[]).map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                        <div>
                          <span className="font-medium">{item.supplyName}</span>
                          <span className="text-muted-foreground text-xs ml-1">({item.supplyUnit})</span>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <span className="font-semibold">× {item.quantity}</span>
                          {item.deliveredQuantity != null && item.deliveredQuantity < item.quantity && (
                            <span className="text-xs text-amber-600">{item.deliveredQuantity} delivered</span>
                          )}
                          <span className="text-xs text-muted-foreground">{formatRWF(Number(item.unitCost) * item.quantity)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold pt-1">
                      <span>Order Total</span><span>{formatRWF(o.totalAmount)}</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── VIEW REQUISITION DIALOG ── */}
      <Dialog open={viewReqId !== null && !showReject} onOpenChange={open => !open && setViewReqId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Requisition — {viewReq?.requisitionNumber}</DialogTitle></DialogHeader>
          {viewReq && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Status: </span>
                  <Badge className={`text-xs ml-1 ${REQ_STATUS_COLOR[viewReq.status]}`}>{viewReq.status.replace(/_/g, " ")}</Badge>
                </div>
                <div><span className="text-muted-foreground">Date: </span>{new Date(viewReq.createdAt).toLocaleDateString()}</div>
                {viewReq.totalAmount && Number(viewReq.totalAmount) > 0 && (
                  <div><span className="text-muted-foreground">Est. Total: </span><strong>{formatRWF(Number(viewReq.totalAmount))}</strong></div>
                )}
                {viewReq.approvalDate && <div><span className="text-muted-foreground">Approved: </span>{new Date(viewReq.approvalDate).toLocaleDateString()}</div>}
              </div>
              {viewReq.notes && <div className="text-sm bg-muted rounded p-2"><span className="text-muted-foreground">Notes: </span>{viewReq.notes}</div>}
              {viewReq.rejectionReason && <div className="text-sm bg-red-50 text-red-700 rounded p-2 border border-red-200"><span className="font-medium">Rejected: </span>{viewReq.rejectionReason}</div>}

              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2"><Package className="w-4 h-4 text-muted-foreground" />Requested Items</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {(viewReqItems as any[]).map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between text-sm border rounded p-2 bg-muted/20">
                      <div>
                        <span className="font-medium">{it.supplyName ?? `Supply #${it.supplyId}`}</span>
                        <span className="text-muted-foreground text-xs ml-1">({it.supplyUnit})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">× {it.quantity}</span>
                        {it.estimatedUnitCost && <span className="text-muted-foreground text-xs">{formatRWF(Number(it.estimatedUnitCost))}/unit</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                {viewReq.status === "submitted" && (
                  <>
                    <Button className="gap-1 bg-green-600 hover:bg-green-700" disabled={approveMut.isPending}
                      onClick={() => { approveMut.mutate({ requisitionId: viewReq.id }); setViewReqId(null); }}>
                      <CheckCircle className="w-4 h-4" />Approve
                    </Button>
                    <Button variant="outline" className="gap-1 text-red-600 border-red-200" onClick={() => setShowReject(true)}>
                      <XCircle className="w-4 h-4" />Reject
                    </Button>
                  </>
                )}
                {viewReq.status === "approved" && (
                  <Button className="gap-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => { openPOFromReq(viewReq, viewReqItems as any[]); setViewReqId(null); }}>
                    <Plus className="w-4 h-4" />Create Purchase Order
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewReqId(null)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── REJECT DIALOG ── */}
      <Dialog open={showReject} onOpenChange={open => { if (!open) { setShowReject(false); setRejectReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Requisition — {viewReq?.requisitionNumber}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">The pharmacist will be notified with this reason.</p>
            <Textarea rows={3} placeholder="Reason for rejection…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowReject(false); setRejectReason(""); }}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 gap-1" disabled={rejectMut.isPending}
              onClick={() => { if (viewReqId) rejectMut.mutate({ requisitionId: viewReqId, reason: rejectReason }); }}>
              <XCircle className="w-4 h-4" />Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE PO DIALOG ── */}
      <Dialog open={showCreatePO} onOpenChange={open => { if (!open) { setShowCreatePO(false); resetPOForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{fromReqId ? `Create PO from Requisition #${fromReqId}` : "New Purchase Order"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Supplier *</label>
                <Select value={poSupplierId} onValueChange={setPoSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {(suppliers as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Expected Delivery Date</label>
                <Input type="date" value={poDeliveryDate} onChange={e => setPoDeliveryDate(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium block mb-1">Notes</label>
                <Input placeholder="Special instructions for supplier…" value={poNotes} onChange={e => setPoNotes(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Line Items *</label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => setPoItems(p => [...p, { supplyId: "", quantity: "", unitCost: "" }])}>
                  <Plus className="w-3 h-3" />Add Item
                </Button>
              </div>
              {poItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded p-2 bg-muted/10">
                  <div className="col-span-5">
                    <label className="text-xs text-muted-foreground mb-1 block">Supply *</label>
                    <Select value={item.supplyId} onValueChange={v => {
                      const s = (supplies as any[]).find((x: any) => String(x.id) === v);
                      setPoItems(p => p.map((x, j) => j === i ? { ...x, supplyId: v, unitCost: x.unitCost || String(s?.unitCost || "") } : x));
                    }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {(supplies as any[]).map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name} <span className="text-muted-foreground text-xs">({s.currentStock} {s.unit})</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground mb-1 block">Qty *</label>
                    <Input type="number" min="1" className="h-8 text-sm" value={item.quantity}
                      onChange={e => setPoItems(p => p.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground mb-1 block">Unit Cost (RWF)</label>
                    <Input type="number" className="h-8 text-sm" value={item.unitCost}
                      onChange={e => setPoItems(p => p.map((x, j) => j === i ? { ...x, unitCost: e.target.value } : x))} />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {poItems.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500"
                        onClick={() => setPoItems(p => p.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {/* Order total */}
              {poItems.some(i => i.quantity && i.unitCost) && (
                <div className="flex justify-end">
                  <div className="text-sm bg-muted rounded px-4 py-2">
                    Total: <strong>{formatRWF(poItems.reduce((s, i) => s + Number(i.unitCost || 0) * Number(i.quantity || 0), 0))}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowCreatePO(false); resetPOForm(); }}>Cancel</Button>
            <Button disabled={createPoMut.isPending} onClick={handleCreatePO}>
              {createPoMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Creating…</> : "Create Purchase Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
