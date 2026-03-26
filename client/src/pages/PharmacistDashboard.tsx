/**
 * PharmacistDashboard
 *
 * Responsibilities:
 *  - Monitor inventory (usage, stock levels, expiry)
 *  - Create & submit requisitions (with chat thread per requisition)
 *  - Confirm delivery receipts → auto-updates stock
 *
 * NOT the pharmacist's job: POs, suppliers, finances, AI forecasting settings
 */
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, Package, AlertTriangle, Clock, Plus, Minus, Search,
  Truck, CheckCircle, MessageSquare, ChevronDown, ChevronUp, Info, Eye
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatRWF } from "@/lib/utils";
import ChatPanel from "@/components/ChatPanel";

const STOCK_STATUS = (current: number, reorder: number) => {
  if (current === 0) return { label: "Out of Stock", color: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" };
  if (current <= reorder * 0.5) return { label: "Critical", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-400" };
  if (current <= reorder) return { label: "Low Stock", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400" };
  return { label: "In Stock", color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" };
};

function PendingReceiptCard({
  po,
  onConfirm,
}: {
  po: any;
  onConfirm: (po: any) => void;
}) {
  const [showItems, setShowItems] = useState(false);
  const { data: items = [], isLoading } = trpc.purchaseOrders.getItems.useQuery(
    po.id,
    { enabled: showItems }
  );

  return (
    <Card className="p-4 border-green-200">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <p className="font-semibold">{po.poNumber}</p>
          <p className="text-sm text-muted-foreground">
            Value: {formatRWF(po.totalAmount)}
            {po.deliveryDate && ` · Delivered ${new Date(po.deliveryDate).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setShowItems(v => !v)}
          >
            <Eye className="w-3.5 h-3.5" />
            {showItems ? "Hide PO Items" : "View PO Items"}
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white gap-1"
            onClick={() => onConfirm(po)}
          >
            <CheckCircle className="w-3.5 h-3.5" />Confirm Receipt
          </Button>
        </div>
      </div>

      {showItems && (
        <div className="mt-4 rounded-lg border bg-muted/20 p-3">
          <p className="mb-2 text-sm font-medium">Purchase order items</p>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading PO items...
            </div>
          ) : (items as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items found for this purchase order.</p>
          ) : (
            <div className="space-y-2">
              {(items as any[]).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.supplyName}</p>
                    <p className="text-xs text-muted-foreground">Supply #{item.supplyId}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{item.quantity} {item.supplyUnit}</p>
                    <p className="text-xs text-muted-foreground">{formatRWF(item.unitCost)} each</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function PharmacistDashboard() {
  const utils = trpc.useUtils();
  const { data: supplies = [], isLoading, refetch } = trpc.inventory.list.useQuery();
  const { data: lowStock = [] } = trpc.inventory.getLowStock.useQuery();
  const { data: expiring = [] } = trpc.inventory.getExpiring.useQuery({ daysThreshold: 30 });
  const { data: pendingReceipts = [] } = trpc.deliveryReceipts.pendingConfirmation.useQuery();

  const logUsage = trpc.inventoryTransactions.logUsage.useMutation({
    onSuccess: (d) => { toast.success(`Usage logged — new stock: ${d.newStock}`); refetch(); utils.inventory.getLowStock.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const confirmReceipt = trpc.deliveryReceipts.confirm.useMutation({
    onSuccess: () => {
      toast.success("Receipt confirmed — stock has been updated automatically");
      refetch();
      utils.inventory.list.invalidate();
      utils.inventory.getLowStock.invalidate();
      utils.deliveryReceipts.pendingConfirmation.invalidate();
      setShowReceipt(false);
      setReceiptPO(null);
      setReceiptItems({});
      setReceiptNotes("");
    },
    onError: e => toast.error(e.message),
  });

  const [tab, setTab]       = useState<"inventory" | "alerts" | "deliveries">("inventory");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [useQty, setUseQty]     = useState<Record<number, string>>({});
  const [showReceipt, setShowReceipt]   = useState(false);
  const [receiptPO, setReceiptPO]       = useState<any>(null);
  const [receiptNotes, setReceiptNotes] = useState("");
  // receiptItems: supplyId → { ordered, received, notes }
  const [receiptItems, setReceiptItems] = useState<Record<number, { ordered: number; received: string; notes: string }>>({});
  const [chatReqId, setChatReqId] = useState<number | null>(null);
  const { data: requisitions = [] } = trpc.requisitions.list.useQuery();
  const { data: poItems = [] } = trpc.purchaseOrders.getItems.useQuery(
    receiptPO?.id ?? 0,
    { enabled: receiptPO !== null }
  );

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  const filtered = (supplies as any[]).filter((s: any) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase()) ||
    s.category?.toLowerCase().includes(search.toLowerCase())
  );

  // Open receipt confirmation dialog — pre-populate items from PO line items
  const openReceipt = (po: any) => {
    setReceiptPO(po);
    setShowReceipt(true);
  };

  // When poItems load, initialise receive quantities
  const initItems = (items: any[]) => {
    const init: Record<number, { ordered: number; received: string; notes: string }> = {};
    items.forEach((it: any) => {
      if (!receiptItems[it.supplyId]) {
        const received = it.deliveredQuantity > 0 ? it.deliveredQuantity : it.quantity;
        init[it.supplyId] = { ordered: it.quantity, received: String(received), notes: "" };
      }
    });
    if (Object.keys(init).length) setReceiptItems(p => ({ ...p, ...init }));
  };

  // Initialise when poItems arrive
  if (poItems.length && Object.keys(receiptItems).length === 0 && receiptPO) {
    initItems(poItems as any[]);
  }

  const handleConfirmReceipt = () => {
    if (!receiptPO) return;
    const items = Object.entries(receiptItems).map(([supplyId, v]) => ({
      supplyId: Number(supplyId),
      orderedQuantity: v.ordered,
      receivedQuantity: Math.max(0, Number(v.received) || 0),
      notes: v.notes || undefined,
    }));
    confirmReceipt.mutate({ poId: receiptPO.id, items, notes: receiptNotes || undefined });
  };

  // Chat on requisition
  if (chatReqId !== null) {
    const req = (requisitions as any[]).find((r: any) => r.id === chatReqId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setChatReqId(null)}>← Back</Button>
          <div>
            <p className="font-semibold">{req?.requisitionNumber}</p>
            <p className="text-xs text-muted-foreground">Pharmacist ↔ Procurement Discussion</p>
          </div>
        </div>
        <div style={{ height: 520 }}>
          <ChatPanel entityType="requisition" entityId={chatReqId} entityLabel={req?.requisitionNumber} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pharmacy</h1>
        <p className="text-muted-foreground mt-1">Inventory, alerts, and delivery receipts</p>
        <div className="flex gap-1 mt-4 border-b">
          {([
            { key: "inventory", label: "Inventory" },
            { key: "alerts",    label: `Alerts ${(lowStock as any[]).length + (expiring as any[]).length > 0 ? `(${(lowStock as any[]).length + (expiring as any[]).length})` : ""}` },
            { key: "deliveries",label: `Pending Deliveries ${(pendingReceipts as any[]).length > 0 ? `(${(pendingReceipts as any[]).length})` : ""}` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${tab === key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Items",  value: (supplies as any[]).length,          color: "text-blue-600",  bg: "bg-blue-50" },
          { label: "Low / Out",    value: (lowStock as any[]).length,           color: "text-red-600",   bg: "bg-red-50" },
          { label: "Expiring",     value: (expiring as any[]).length,           color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Awaiting Receipt", value: (pendingReceipts as any[]).length, color: "text-green-600", bg: "bg-green-50" },
        ].map((s, i) => (
          <Card key={i} className={`p-3 ${s.bg}`}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* ── INVENTORY TAB ── */}
      {tab === "inventory" && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, code, or category…" className="pl-10"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {filtered.map((s: any) => {
            const st = STOCK_STATUS(s.currentStock, s.reorderPoint);
            const isOpen = expanded[s.id];
            return (
              <Card key={s.id} className="overflow-hidden">
                {/* Row header */}
                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/20"
                  onClick={() => setExpanded(p => ({ ...p, [s.id]: !p[s.id] }))}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.category} · {s.unit}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold">{s.currentStock.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">/ {s.reorderPoint} reorder</p>
                    </div>
                    <Badge className={`text-xs border hidden sm:inline-flex ${st.color}`}>{st.label}</Badge>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t px-3 pt-3 pb-4 bg-muted/10 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div><p className="text-xs text-muted-foreground">Stock</p><p className="font-semibold">{s.currentStock} {s.unit}</p></div>
                      <div><p className="text-xs text-muted-foreground">Reorder at</p><p className="font-semibold">{s.reorderPoint}</p></div>
                      <div><p className="text-xs text-muted-foreground">Unit Cost</p><p className="font-semibold">{formatRWF(s.unitCost)}</p></div>
                      {s.storageLocation && <div><p className="text-xs text-muted-foreground">Location</p><p className="font-semibold">{s.storageLocation}</p></div>}
                      {s.batchNumber && <div><p className="text-xs text-muted-foreground">Batch</p><p className="font-semibold">{s.batchNumber}</p></div>}
                      {s.expiryDate && <div><p className="text-xs text-muted-foreground">Expires</p><p className="font-semibold">{new Date(s.expiryDate).toLocaleDateString()}</p></div>}
                    </div>
                    {/* Log usage inline */}
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min="1" placeholder="Qty to use"
                        className="h-8 w-32 text-sm"
                        value={useQty[s.id] || ""}
                        onChange={e => setUseQty(p => ({ ...p, [s.id]: e.target.value }))}
                      />
                      <Button size="sm" className="h-8 gap-1"
                        disabled={!useQty[s.id] || logUsage.isPending}
                        onClick={() => {
                          const qty = Number(useQty[s.id]);
                          if (!qty || qty <= 0) return;
                          logUsage.mutate({ supplyId: s.id, quantity: qty });
                          setUseQty(p => ({ ...p, [s.id]: "" }));
                        }}>
                        <Minus className="w-3 h-3" />Log Usage
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {filtered.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              {search ? "No items match your search" : "No inventory items yet"}
            </Card>
          )}
        </div>
      )}

      {/* ── ALERTS TAB ── */}
      {tab === "alerts" && (
        <div className="space-y-4">
          {(lowStock as any[]).length > 0 && (
            <section>
              <h3 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />Low / Out of Stock ({(lowStock as any[]).length})
              </h3>
              {(lowStock as any[]).map((s: any) => {
                const st = STOCK_STATUS(s.currentStock, s.reorderPoint);
                return (
                  <Card key={s.id} className="p-3 border-red-200 bg-red-50/30 mb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.currentStock} {s.unit} remaining · Reorder at {s.reorderPoint}</p>
                      </div>
                      <Badge className={`text-xs border ${st.color}`}>{st.label}</Badge>
                    </div>
                  </Card>
                );
              })}
            </section>
          )}

          {(expiring as any[]).length > 0 && (
            <section>
              <h3 className="font-semibold text-amber-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />Expiring Within 30 Days ({(expiring as any[]).length})
              </h3>
              {(expiring as any[]).map((s: any) => (
                <Card key={s.id} className="p-3 border-amber-200 bg-amber-50/30 mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Batch {s.batchNumber || "N/A"} · Expires {new Date(s.expiryDate).toLocaleDateString("en-RW", { dateStyle: "medium" })}
                      </p>
                    </div>
                    <Badge className="text-xs border bg-amber-100 text-amber-700">Expiring</Badge>
                  </div>
                </Card>
              ))}
            </section>
          )}

          {(lowStock as any[]).length === 0 && (expiring as any[]).length === 0 && (
            <Card className="p-10 text-center text-muted-foreground">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-40 text-green-500" />
              <p className="font-medium text-green-800">All stock levels are healthy</p>
            </Card>
          )}
        </div>
      )}

      {/* ── PENDING DELIVERIES TAB ── */}
      {tab === "deliveries" && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>These POs have been marked delivered by the supplier. Confirm you physically received the items — this will automatically update stock levels.</p>
          </div>

          {(pendingReceipts as any[]).length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">No deliveries awaiting confirmation</p>
            </Card>
          ) : (pendingReceipts as any[]).map((po: any) => (
            <PendingReceiptCard key={po.id} po={po} onConfirm={openReceipt} />
          ))}
        </div>
      )}

      {/* ── CONFIRM RECEIPT DIALOG ── */}
      <Dialog open={showReceipt} onOpenChange={open => { if (!open) { setShowReceipt(false); setReceiptPO(null); setReceiptItems({}); setReceiptNotes(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Confirm Delivery Receipt — {receiptPO?.poNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Enter the actual quantities you received for each item. Stock will be updated automatically.
            </p>
            {receiptPO?.status === "delivered" && (
              <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                Supplier marked this PO as fully delivered, so confirming receipt will add the delivered PO quantities to inventory.
              </div>
            )}
            {receiptPO?.status === "partial_delivery" && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Supplier marked this PO as partially delivered. Enter the quantities that pharmacy actually received so inventory only increases by confirmed items.
              </div>
            )}

            {(poItems as any[]).length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm flex items-center justify-center gap-2">
                <Loader2 className="animate-spin w-4 h-4" />Loading order items…
              </div>
            ) : (
              <div className="space-y-3">
                {(poItems as any[]).map((item: any) => {
                  const defaultReceived = receiptPO?.status === "delivered"
                    ? String(item.deliveredQuantity > 0 ? item.deliveredQuantity : item.quantity)
                    : String(item.deliveredQuantity > 0 ? item.deliveredQuantity : item.quantity);
                  const rec = receiptItems[item.supplyId] || { ordered: item.quantity, received: defaultReceived, notes: "" };
                  const receivedNum = Number(rec.received) || 0;
                  const shortfall = rec.ordered - receivedNum;
                  return (
                    <div key={item.supplyId} className="border rounded p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{item.supplyName}</p>
                        <span className="text-xs text-muted-foreground">{item.supplyUnit}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Ordered</label>
                          <p className="font-semibold">{rec.ordered}</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Actually Received *</label>
                          <Input type="number" min="0" max={rec.ordered}
                            className={`h-8 text-sm ${shortfall > 0 ? "border-amber-400" : ""}`}
                            value={rec.received}
                            disabled={receiptPO?.status === "delivered"}
                            onChange={e => setReceiptItems(p => ({ ...p, [item.supplyId]: { ...rec, received: e.target.value } }))}
                          />
                        </div>
                      </div>
                      {shortfall > 0 && receivedNum >= 0 && (
                        <p className="text-xs text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />{shortfall} units short — only received qty will be added to stock
                        </p>
                      )}
                      <Input placeholder="Item notes (optional)"
                        className="h-7 text-xs"
                        value={rec.notes}
                        onChange={e => setReceiptItems(p => ({ ...p, [item.supplyId]: { ...rec, notes: e.target.value } }))}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Overall Receipt Notes (optional)</label>
              <Textarea rows={2} className="mt-1"
                placeholder="Any issues, damages, or notes about the delivery…"
                value={receiptNotes} onChange={e => setReceiptNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowReceipt(false); setReceiptPO(null); setReceiptItems({}); setReceiptNotes(""); }}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 gap-1"
              disabled={confirmReceipt.isPending || (poItems as any[]).length === 0}
              onClick={handleConfirmReceipt}>
              {confirmReceipt.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Updating stock…</>
                : <><CheckCircle className="w-4 h-4" />Confirm Receipt & Update Stock</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
