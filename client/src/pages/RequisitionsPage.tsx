import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, ClipboardList, Send, Trash2, Eye, CheckCircle, XCircle, AlertTriangle, Package, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import ChatPanel from "@/components/ChatPanel";
import { formatRWF } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; step: number }> = {
  draft:           { label: "Draft",           color: "bg-gray-100 text-gray-700",    step: 1 },
  submitted:       { label: "Submitted",       color: "bg-blue-100 text-blue-700",    step: 2 },
  approved:        { label: "Approved",        color: "bg-green-100 text-green-700",  step: 3 },
  rejected:        { label: "Rejected",        color: "bg-red-100 text-red-700",      step: 0 },
  converted_to_po: { label: "PO Created",      color: "bg-purple-100 text-purple-700",step: 4 },
};

type ReqItem = { supplyId: string; quantity: string; estimatedUnitCost: string };

export default function RequisitionsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: requisitions = [], isLoading } = trpc.requisitions.list.useQuery();
  const { data: supplies = [] } = trpc.inventory.list.useQuery();

  const isAdmin = user?.role === "admin" || user?.role === "procurement_officer";
  const isPharmacist = user?.role === "pharmacist";

  const [showCreate, setShowCreate] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [chatReqId, setChatReqId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReqItem[]>([{ supplyId: "", quantity: "", estimatedUnitCost: "" }]);

  const createMut = trpc.requisitions.create.useMutation({
    onSuccess: (data) => { toast.success(`Requisition ${data.requisitionNumber} created as draft`); utils.requisitions.list.invalidate(); setShowCreate(false); resetForm(); },
    onError: e => toast.error(e.message),
  });
  const submitMut = trpc.requisitions.submit.useMutation({
    onSuccess: () => { toast.success("Submitted for approval — admin has been notified"); utils.requisitions.list.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const approveMut = trpc.requisitions.approve.useMutation({
    onSuccess: () => { toast.success("Requisition approved — procurement officer notified"); utils.requisitions.list.invalidate(); setViewId(null); },
    onError: e => toast.error(e.message),
  });
  const rejectMut = trpc.requisitions.reject.useMutation({
    onSuccess: () => { toast.success("Requisition rejected — requester notified"); utils.requisitions.list.invalidate(); setViewId(null); setShowReject(false); setRejectReason(""); },
    onError: e => toast.error(e.message),
  });

  const { data: viewItems = [] } = trpc.requisitions.getItems.useQuery(
    { requisitionId: viewId! },
    { enabled: viewId !== null }
  );

  const resetForm = () => { setNotes(""); setItems([{ supplyId: "", quantity: "", estimatedUnitCost: "" }]); };
  const addItem = () => setItems(p => [...p, { supplyId: "", quantity: "", estimatedUnitCost: "" }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, j) => j !== i));
  const updateItem = (i: number, field: keyof ReqItem, val: string) => setItems(p => p.map((x, j) => j === i ? { ...x, [field]: val } : x));

  const handleCreate = () => {
    const valid = items.filter(it => it.supplyId && Number(it.quantity) > 0);
    if (!valid.length) return toast.error("Add at least one item with a quantity");
    createMut.mutate({ items: valid.map(it => ({ supplyId: Number(it.supplyId), quantity: Number(it.quantity), estimatedUnitCost: it.estimatedUnitCost || undefined })), notes: notes || undefined });
  };

  const totalEstimate = items.reduce((s, it) => s + (Number(it.estimatedUnitCost || 0) * Number(it.quantity || 0)), 0);
  const viewReq = viewId !== null ? (requisitions as any[]).find((r: any) => r.id === viewId) : null;

  const filtered = statusFilter === "all" ? requisitions : (requisitions as any[]).filter((r: any) => r.status === statusFilter);
  const counts = (requisitions as any[]).reduce((acc: Record<string, number>, r: any) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  if (chatReqId !== null) {
    const req = (requisitions as any[]).find((r: any) => r.id === chatReqId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setChatReqId(null)} className="text-sm text-muted-foreground hover:text-foreground">← Back to Requisitions</button>
          <div><p className="font-semibold">{req?.requisitionNumber}</p><p className="text-xs text-muted-foreground">Chat with Procurement</p></div>
        </div>
        <div style={{ height: 520 }}>
          <ChatPanel entityType="requisition" entityId={chatReqId} entityLabel={req?.requisitionNumber} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><ClipboardList className="w-7 h-7 text-primary" />Purchase Requisitions</h1>
          <p className="text-muted-foreground mt-1">{isAdmin ? "Review and approve stock requests from pharmacy" : "Create and track your stock replenishment requests"}</p>
        </div>
        {isPharmacist && (
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" />New Requisition</Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <Card key={key} className={`p-3 text-center cursor-pointer hover:shadow-sm transition-all ${statusFilter === key ? "ring-2 ring-primary ring-offset-1" : ""}`} onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}>
            <p className="text-xs text-muted-foreground">{cfg.label}</p>
            <p className="text-2xl font-bold mt-0.5">{counts[key] ?? 0}</p>
          </Card>
        ))}
      </div>

      {/* Admin pending approvals alert */}
      {isAdmin && (counts["submitted"] ?? 0) > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 text-sm">{counts["submitted"]} requisition{(counts["submitted"] ?? 0) > 1 ? "s" : ""} awaiting your approval</p>
          </div>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0" onClick={() => setStatusFilter("submitted")}>Review Now</Button>
        </Card>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Filter:</span>
        <button onClick={() => setStatusFilter("all")} className={`px-3 py-1 rounded-full text-xs border transition-colors ${statusFilter === "all" ? "bg-primary text-white border-primary" : "border-gray-200 text-muted-foreground"}`}>
          All ({(requisitions as any[]).length})
        </button>
        {Object.entries(STATUS_CONFIG).filter(([k]) => counts[k]).map(([key, cfg]) => (
          <button key={key} onClick={() => setStatusFilter(statusFilter === key ? "all" : key)} className={`px-3 py-1 rounded-full text-xs border transition-colors ${statusFilter === key ? "bg-primary text-white border-primary" : cfg.color}`}>
            {cfg.label} ({counts[key] ?? 0})
          </button>
        ))}
      </div>

      {/* List */}
      <Card className="overflow-hidden">
        {(filtered as any[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 gap-3 text-muted-foreground">
            <ClipboardList className="w-10 h-10 opacity-30" />
            <p className="text-sm">{statusFilter !== "all" ? `No ${STATUS_CONFIG[statusFilter]?.label.toLowerCase() ?? statusFilter} requisitions` : "No requisitions yet"}</p>
            {isPharmacist && statusFilter === "all" && (
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>Create your first requisition</Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {(filtered as any[]).map((req: any) => (
              <div key={req.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{req.requisitionNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                      {new Date(req.createdAt).toLocaleDateString("en-RW", { dateStyle: "medium" })}
                      {req.notes && ` · ${req.notes}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {req.totalAmount && Number(req.totalAmount) > 0 && (
                    <span className="text-sm text-muted-foreground hidden md:block">{formatRWF(Number(req.totalAmount))}</span>
                  )}
                  <Badge className={`text-xs capitalize ${STATUS_CONFIG[req.status]?.color ?? "bg-gray-100 text-gray-700"}`}>
                    {STATUS_CONFIG[req.status]?.label ?? req.status}
                  </Badge>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" onClick={() => setChatReqId(req.id)}>
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setViewId(req.id)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {req.status === "draft" && isPharmacist && (
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-blue-600 border-blue-200" disabled={submitMut.isPending}
                        onClick={() => submitMut.mutate({ requisitionId: req.id })}>
                        <Send className="w-3 h-3" />Submit
                      </Button>
                    )}
                    {req.status === "submitted" && isAdmin && (
                      <>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-green-600 border-green-200" disabled={approveMut.isPending}
                          onClick={() => approveMut.mutate({ requisitionId: req.id })}>
                          <CheckCircle className="w-3 h-3" />Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-red-600 border-red-200"
                          onClick={() => { setViewId(req.id); setShowReject(true); }}>
                          <XCircle className="w-3 h-3" />Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* CREATE DIALOG */}
      <Dialog open={showCreate} onOpenChange={open => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Requisition</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Notes / Justification</label>
              <Textarea placeholder="Reason for this request, department, or urgency…" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Items to Request *</label>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1 h-7 text-xs"><Plus className="w-3 h-3" />Add Item</Button>
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded p-3 bg-muted/20">
                  <div className="col-span-5">
                    <label className="text-xs text-muted-foreground mb-1 block">Supply *</label>
                    <Select value={item.supplyId} onValueChange={v => {
                      const s = (supplies as any[]).find((x: any) => String(x.id) === v);
                      updateItem(i, "supplyId", v);
                      if (s && !item.estimatedUnitCost) updateItem(i, "estimatedUnitCost", String(s.unitCost));
                    }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select supply" /></SelectTrigger>
                      <SelectContent>
                        {(supplies as any[]).map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} <span className="text-muted-foreground text-xs">({s.currentStock} {s.unit})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground mb-1 block">Quantity *</label>
                    <Input type="number" min="1" className="h-8 text-sm" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground mb-1 block">Est. Unit Cost (RWF)</label>
                    <Input type="number" className="h-8 text-sm" value={item.estimatedUnitCost} onChange={e => updateItem(i, "estimatedUnitCost", e.target.value)} />
                  </div>
                  <div className="col-span-1 flex justify-center pb-0.5">
                    {items.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(i)} className="h-8 w-8 p-0 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                    )}
                  </div>
                  {item.quantity && item.estimatedUnitCost && Number(item.estimatedUnitCost) > 0 && (
                    <div className="col-span-12 text-xs text-right text-muted-foreground">
                      Line total: {formatRWF(Number(item.estimatedUnitCost) * Number(item.quantity))}
                    </div>
                  )}
                </div>
              ))}
              {totalEstimate > 0 && (
                <div className="flex justify-end">
                  <div className="text-sm bg-muted rounded px-4 py-2">
                    Estimated Total: <span className="font-bold text-primary">{formatRWF(totalEstimate)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending} className="gap-2">
              {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}Save as Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIEW DIALOG */}
      <Dialog open={viewId !== null && !showReject} onOpenChange={open => !open && setViewId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Requisition — {viewReq?.requisitionNumber}</DialogTitle></DialogHeader>
          {viewReq && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Status:</span> <Badge className={`text-xs ml-1 ${STATUS_CONFIG[viewReq.status]?.color}`}>{STATUS_CONFIG[viewReq.status]?.label}</Badge></div>
                <div><span className="text-muted-foreground">Created:</span> <span className="font-medium ml-1">{new Date(viewReq.createdAt).toLocaleDateString("en-RW", { dateStyle: "medium" })}</span></div>
                {viewReq.approvalDate && <div><span className="text-muted-foreground">Approved:</span> <span className="ml-1">{new Date(viewReq.approvalDate).toLocaleDateString()}</span></div>}
                {viewReq.totalAmount && Number(viewReq.totalAmount) > 0 && <div><span className="text-muted-foreground">Est. Total:</span> <strong className="ml-1">{formatRWF(Number(viewReq.totalAmount))}</strong></div>}
              </div>
              {viewReq.notes && <div className="text-sm bg-muted rounded p-3"><span className="font-medium text-muted-foreground">Notes: </span>{viewReq.notes}</div>}
              {viewReq.rejectionReason && (
                <div className="text-sm bg-red-50 text-red-700 rounded p-3 border border-red-200">
                  <span className="font-medium">Rejection reason: </span>{viewReq.rejectionReason}
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2"><Package className="w-4 h-4 text-muted-foreground" />Requested Items</p>
                {(viewItems as any[]).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No items found</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {(viewItems as any[]).map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between text-sm border rounded p-2.5 bg-muted/20">
                        <div>
                          <span className="font-medium">{it.supplyName ?? `Supply #${it.supplyId}`}</span>
                          <span className="text-muted-foreground text-xs ml-1">({it.supplyUnit})</span>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <span className="font-semibold">× {it.quantity}</span>
                          {it.estimatedUnitCost && <span className="text-muted-foreground text-xs">{formatRWF(Number(it.estimatedUnitCost))}/unit</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2 flex-wrap">
                {viewReq.status === "draft" && isPharmacist && (
                  <Button className="gap-1 bg-blue-600 hover:bg-blue-700" disabled={submitMut.isPending}
                    onClick={() => { submitMut.mutate({ requisitionId: viewReq.id }); setViewId(null); }}>
                    <Send className="w-4 h-4" />Submit for Approval
                  </Button>
                )}
                {viewReq.status === "submitted" && isAdmin && (
                  <>
                    <Button className="gap-1 bg-green-600 hover:bg-green-700" disabled={approveMut.isPending}
                      onClick={() => approveMut.mutate({ requisitionId: viewReq.id })}>
                      <CheckCircle className="w-4 h-4" />Approve
                    </Button>
                    <Button variant="outline" className="gap-1 text-red-600 border-red-200" onClick={() => setShowReject(true)}>
                      <XCircle className="w-4 h-4" />Reject
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setViewId(null)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* REJECT DIALOG */}
      <Dialog open={showReject} onOpenChange={open => { if (!open) { setShowReject(false); setRejectReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Requisition — {viewReq?.requisitionNumber}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Provide a reason so the pharmacist can revise and resubmit.</p>
            <Textarea placeholder="Reason for rejection…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowReject(false); setRejectReason(""); }}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 gap-1" disabled={rejectMut.isPending}
              onClick={() => { if (viewId) rejectMut.mutate({ requisitionId: viewId, reason: rejectReason }); }}>
              <XCircle className="w-4 h-4" />Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
