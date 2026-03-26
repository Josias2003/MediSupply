/**
 * SupplierDashboard
 *
 * Workflow the supplier sees:
 *   sent → Confirm or Decline (with reason)
 *   acknowledged / partial_delivery → Mark Delivered (supplier side done)
 *   delivered → awaiting pharmacist receipt confirmation (locked, can chat)
 *   receipt confirmed → Submit Invoice (shows INV number only, not item names)
 *   cancelled → read-only
 *
 * Chat is available on every active PO (supplier ↔ procurement).
 */
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Truck, CheckCircle, Package, DollarSign, Bell, XCircle, MessageSquare, Clock, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatRWF } from "@/lib/utils";
import ChatPanel from "@/components/ChatPanel";

const STATUS_COLOR: Record<string, string> = {
  sent:             "bg-blue-100 text-blue-700 border-blue-200",
  acknowledged:     "bg-indigo-100 text-indigo-700 border-indigo-200",
  partial_delivery: "bg-amber-100 text-amber-700 border-amber-200",
  delivered:        "bg-green-100 text-green-700 border-green-200",
  cancelled:        "bg-red-100 text-red-700 border-red-200",
};

export default function SupplierDashboard() {
  const { data: myOrders = [], isLoading, refetch } = trpc.supplierPortal.getMyOrders.useQuery();
  const { data: notifList = [] } = trpc.notifications.list.useQuery();

  const confirmOrder   = trpc.supplierPortal.confirmOrder.useMutation({
    onSuccess: () => { toast.success("Order confirmed — procurement has been notified"); refetch(); },
    onError: e => toast.error(e.message),
  });
  const updateDelivery = trpc.supplierPortal.updateDeliveryStatus.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.status === "delivered"
        ? "Delivery marked — waiting for pharmacist to confirm receipt before you can invoice"
        : "Delivery update sent to procurement");
      refetch();
    },
    onError: e => toast.error(e.message),
  });
  const submitInvoice = trpc.supplierPortal.submitInvoice.useMutation({
    onSuccess: (data) => {
      toast.success(`Invoice ${data.invoiceNumber} submitted — accountant notified`);
      refetch();
      setShowInvoice(false);
      resetInvoice();
    },
    onError: e => toast.error(e.message),
  });

  const [tab, setTab]           = useState<"orders" | "notifications">("orders");
  const [chatPoId, setChatPoId] = useState<number | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [selectedPO, setSelectedPO]   = useState<any>(null);
  const [declineNotes, setDeclineNotes] = useState("");
  const [invAmount, setInvAmount]     = useState("");
  const [invDueDate, setInvDueDate]   = useState("");
  const [invNotes, setInvNotes]       = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState<Record<number, string>>({});

  // Per-PO receipt status
  const receiptForSelected = trpc.deliveryReceipts.getByPO.useQuery(
    selectedPO?.id ?? 0,
    { enabled: selectedPO !== null && ["partial_delivery", "delivered"].includes(selectedPO.status) }
  );
  const poItemsForSelected = trpc.purchaseOrders.getItems.useQuery(
    selectedPO?.id ?? 0,
    { enabled: selectedPO !== null && ["partial_delivery", "delivered"].includes(selectedPO.status) }
  );

  const resetInvoice = () => { setSelectedPO(null); setInvAmount(""); setInvDueDate(""); setInvNotes(""); };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  const newOrders    = (myOrders as any[]).filter((o: any) => o.status === "sent");
  const activeOrders = (myOrders as any[]).filter((o: any) => o.status === "acknowledged");
  const deliveredPOs = (myOrders as any[]).filter((o: any) => ["partial_delivery", "delivered"].includes(o.status));
  const unread       = (notifList as any[]).filter((n: any) => !n.isRead).length;
  const confirmedReceiptValue = (() => {
    const receiptItems = (receiptForSelected.data?.items as any[]) || [];
    const poItems = (poItemsForSelected.data as any[]) || [];
    return receiptItems.reduce((sum: number, item: any) => {
      const poItem = poItems.find((poIt: any) => poIt.supplyId === item.supplyId);
      return sum + (Number(item.receivedQuantity || 0) * Number(poItem?.unitCost || 0));
    }, 0);
  })();

  // Chat panel — attached to a specific PO
  if (chatPoId !== null) {
    const po = (myOrders as any[]).find((o: any) => o.id === chatPoId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setChatPoId(null)}>← Back to Orders</Button>
          <div>
            <p className="font-semibold">{po?.poNumber}</p>
            <p className="text-xs text-muted-foreground">Procurement ↔ Supplier Discussion</p>
          </div>
        </div>
        <div style={{ height: 520 }}>
          <ChatPanel entityType="purchase_order" entityId={chatPoId} entityLabel={po?.poNumber} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Supplier Portal</h1>
        <p className="text-muted-foreground mt-1">Manage purchase orders, deliveries, and invoices</p>
        <div className="flex gap-1 mt-4 border-b">
          {(["orders","notifications"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
              {t}
              {t === "notifications" && unread > 0 && <span className="ml-1.5 bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5">{unread}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "New Orders",   value: newOrders.length,    color: "text-blue-600",  bg: "bg-blue-50",  icon: Package },
          { label: "In Progress",  value: activeOrders.length, color: "text-amber-600", bg: "bg-amber-50", icon: Truck },
          { label: "Awaiting Receipt", value: deliveredPOs.length, color: "text-green-600", bg: "bg-green-50", icon: Clock },
          { label: "Unread Alerts",value: unread,              color: "text-red-600",   bg: "bg-red-50",   icon: Bell },
        ].map((s, i) => (
          <Card key={i} className={`p-4 ${s.bg}`}>
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></div>
              <s.icon className={`w-7 h-7 ${s.color} opacity-60`} />
            </div>
          </Card>
        ))}
      </div>

      {tab === "orders" && (
        <div className="space-y-6">

          {/* ── NEW ORDERS */}
          {newOrders.length > 0 && (
            <section>
              <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />New Orders — Action Required
                <span className="bg-blue-500 text-white rounded-full text-xs px-2 py-0.5">{newOrders.length}</span>
              </h3>
              {newOrders.map((o: any) => (
                <Card key={o.id} className="p-4 border-blue-200 bg-blue-50/40 mb-3">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-semibold">{o.poNumber}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Value: <strong className="text-foreground">{formatRWF(o.totalAmount)}</strong>
                      </p>
                      {o.expectedDeliveryDate && (
                        <p className="text-xs text-muted-foreground">
                          Expected by: {new Date(o.expectedDeliveryDate).toLocaleDateString("en-RW", { dateStyle: "medium" })}
                        </p>
                      )}
                      {o.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{o.notes}"</p>}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground"
                        onClick={() => setChatPoId(o.id)}>
                        <MessageSquare className="w-3.5 h-3.5" />Chat
                      </Button>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1"
                        disabled={confirmOrder.isPending}
                        onClick={() => confirmOrder.mutate({ poId: o.id })}>
                        <CheckCircle className="w-3.5 h-3.5" />Confirm Order
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-600 gap-1"
                        onClick={() => { setSelectedPO(o); setShowDecline(true); }}>
                        <XCircle className="w-3.5 h-3.5" />Decline
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </section>
          )}

          {/* ── ACTIVE DELIVERIES */}
          {activeOrders.length > 0 && (
            <section>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-600" />Active Deliveries
              </h3>
              {activeOrders.map((o: any) => (
                <Card key={o.id} className="p-4 mb-3">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold">{o.poNumber}</p>
                        <Badge className={`text-xs border ${STATUS_COLOR[o.status] ?? ""}`}>
                          {o.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Value: {formatRWF(o.totalAmount)}</p>
                      <Input
                        placeholder="Delivery notes (optional)"
                        className="mt-2 h-8 text-xs w-72 max-w-full"
                        value={deliveryNotes[o.id] || ""}
                        onChange={e => setDeliveryNotes(p => ({ ...p, [o.id]: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground"
                        onClick={() => setChatPoId(o.id)}>
                        <MessageSquare className="w-3.5 h-3.5" />Chat
                      </Button>
                      {o.status !== "partial_delivery" && (
                        <Button size="sm" variant="outline"
                          disabled={updateDelivery.isPending}
                          onClick={() => updateDelivery.mutate({ poId: o.id, status: "partial_delivery", notes: deliveryNotes[o.id] })}>
                          Partial Delivery
                        </Button>
                      )}
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1"
                        disabled={updateDelivery.isPending}
                        onClick={() => updateDelivery.mutate({ poId: o.id, status: "delivered", notes: deliveryNotes[o.id] })}>
                        <CheckCircle className="w-3.5 h-3.5" />Mark Delivered
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </section>
          )}

          {/* ── DELIVERED — awaiting pharmacist receipt */}
          {deliveredPOs.length > 0 && (
            <section>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-600" />Delivered — Awaiting Receipt Confirmation
              </h3>
              <ReceiptAwareOrders
                orders={deliveredPOs}
                onChat={(id) => setChatPoId(id)}
                onInvoice={(o, hasReceipt, confirmedValue) => {
                  if (!hasReceipt) {
                    toast.info("The pharmacist must confirm receipt of the goods before you can submit an invoice.");
                    return;
                  }
                  setSelectedPO(o);
                  setInvAmount(String(confirmedValue || o.totalAmount));
                  setShowInvoice(true);
                }}
              />
            </section>
          )}

          {myOrders.length === 0 && (
            <Card className="p-14 text-center text-muted-foreground">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No purchase orders yet</p>
              <p className="text-xs mt-1">Orders will appear here once procurement sends them to you</p>
            </Card>
          )}
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === "notifications" && (
        <div className="space-y-2">
          {(notifList as any[]).length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />No notifications
            </Card>
          ) : (notifList as any[]).map((n: any) => (
            <Card key={n.id} className={`p-4 ${n.isRead ? "bg-gray-50" : "bg-blue-50 border-blue-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(n.createdAt).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── DIALOGS ── */}

      {/* Submit Invoice — shows invoice number only, no item details */}
      <Dialog open={showInvoice} onOpenChange={open => { setShowInvoice(open); if (!open) resetInvoice(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Invoice — {selectedPO?.poNumber}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="p-3 bg-muted rounded text-sm space-y-1">
              <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Purchase Order Reference</p>
              <p className="font-semibold">{selectedPO?.poNumber}</p>
              <p className="text-muted-foreground">PO Value: <strong className="text-foreground">{formatRWF(selectedPO?.totalAmount || 0)}</strong></p>
              {confirmedReceiptValue > 0 && (
                <p className="text-muted-foreground">Confirmed Receipt Value: <strong className="text-foreground">{formatRWF(confirmedReceiptValue)}</strong></p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Invoice Amount (RWF) *</label>
              <Input type="number" step="0.01" className="mt-1" value={invAmount} onChange={e => setInvAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Due Date</label>
              <Input type="date" className="mt-1" value={invDueDate} onChange={e => setInvDueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea rows={2} className="mt-1" value={invNotes} onChange={e => setInvNotes(e.target.value)} placeholder="Any notes for the accountant…" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowInvoice(false); resetInvoice(); }}>Cancel</Button>
            <Button disabled={submitInvoice.isPending || !invAmount}
              onClick={() => {
                if (!selectedPO || !invAmount) return;
                submitInvoice.mutate({ poId: selectedPO.id, totalAmount: invAmount, dueDate: invDueDate ? new Date(invDueDate) : undefined, notes: invNotes || undefined });
              }}>
              {submitInvoice.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Submitting…</> : <><DollarSign className="w-4 h-4 mr-1" />Submit Invoice</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline — with mandatory reason */}
      <Dialog open={showDecline} onOpenChange={open => { setShowDecline(open); if (!open) { setSelectedPO(null); setDeclineNotes(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Decline Order — {selectedPO?.poNumber}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Declining will cancel this purchase order. You must provide a reason so procurement can take action.
            </p>
            <Textarea rows={3} placeholder="Reason for declining (required)…" value={declineNotes}
              onChange={e => setDeclineNotes(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDecline(false); setDeclineNotes(""); }}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 gap-1"
              disabled={!declineNotes.trim() || updateDelivery.isPending}
              onClick={() => {
                if (!selectedPO || !declineNotes.trim()) return;
                updateDelivery.mutate({ poId: selectedPO.id, status: "cancelled", notes: declineNotes });
                setShowDecline(false);
                setSelectedPO(null);
                setDeclineNotes("");
              }}>
              <XCircle className="w-4 h-4" />Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component that checks receipt status per delivered PO
function ReceiptAwareOrders({ orders, onChat, onInvoice }: {
  orders: any[];
  onChat: (poId: number) => void;
  onInvoice: (o: any, hasReceipt: boolean, confirmedValue: number) => void;
}) {
  return (
    <>
      {orders.map((o: any) => (
        <ReceiptRow key={o.id} order={o} onChat={onChat} onInvoice={onInvoice} />
      ))}
    </>
  );
}

function ReceiptRow({ order, onChat, onInvoice }: { order: any; onChat: (id: number) => void; onInvoice: (o: any, has: boolean, confirmedValue: number) => void }) {
  const { data: receipt } = trpc.deliveryReceipts.getByPO.useQuery(order.id);
  const { data: poItems = [] } = trpc.purchaseOrders.getItems.useQuery(order.id);
  const hasReceipt = receipt?.status === "confirmed";
  const confirmedValue = ((receipt?.items as any[]) || []).reduce((sum: number, item: any) => {
    const poItem = (poItems as any[]).find((poIt: any) => poIt.supplyId === item.supplyId);
    return sum + (Number(item.receivedQuantity || 0) * Number(poItem?.unitCost || 0));
  }, 0);

  return (
    <Card className={`p-4 mb-3 ${hasReceipt ? "border-green-200" : "border-amber-200 bg-amber-50/20"}`}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="font-semibold">{order.poNumber}</p>
          <p className="text-sm text-muted-foreground">Value: {formatRWF(order.totalAmount)}</p>
          {order.deliveryDate && (
            <p className="text-xs text-muted-foreground">
              Delivered: {new Date(order.deliveryDate).toLocaleDateString("en-RW", { dateStyle: "medium" })}
            </p>
          )}
          {hasReceipt ? (
            <p className="text-xs text-green-700 mt-1 font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />Pharmacist confirmed receipt — you may now invoice
            </p>
          ) : (
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />Waiting for pharmacist to confirm receipt of goods
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => onChat(order.id)}>
            <MessageSquare className="w-3.5 h-3.5" />Chat
          </Button>
          <Button
            size="sm"
            className={hasReceipt ? "bg-blue-600 hover:bg-blue-700 text-white gap-1" : "gap-1"}
            variant={hasReceipt ? "default" : "outline"}
            disabled={!hasReceipt}
            onClick={() => onInvoice(order, hasReceipt, confirmedValue)}>
            <DollarSign className="w-3.5 h-3.5" />
            {hasReceipt ? "Submit Invoice" : "Receipt Pending"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
