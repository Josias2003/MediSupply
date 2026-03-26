import { formatRWF, formatRWFCompact } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, DollarSign, TrendingUp, CreditCard, FileText, Plus, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, List } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  partial: { label: "Partial", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  paid: { label: "Paid", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  overdue: { label: "Overdue", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  cancelled: { label: "Cancelled", color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
};

export default function AccountantDashboard() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"invoices" | "budgets" | "payments">("invoices");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showPayment, setShowPayment] = useState(false);
  const [showCreateBudget, setShowCreateBudget] = useState(false);
  const [viewItemsInv, setViewItemsInv] = useState<any>(null);
  const [selectedInv, setSelectedInv] = useState<any>(null);
  const [expandedBudget, setExpandedBudget] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "bank_transfer", reference: "", notes: "" });
  const [budgetForm, setBudgetForm] = useState({ department: "", allocatedAmount: "", fiscalYear: String(new Date().getFullYear()), notes: "" });

  const { data: invoices = [], isLoading, refetch: refetchInvoices } = trpc.invoices.list.useQuery();
  const { data: budgetSummary, refetch: refetchSummary } = trpc.budgets.summary.useQuery();
  const { data: budgetList = [], refetch: refetchBudgets } = trpc.budgets.list.useQuery();

  const recordPayment = trpc.invoices.recordPayment.useMutation({
    onSuccess: (data) => {
      toast.success(`Payment recorded - invoice is now ${data.newStatus}`);
      refetchInvoices();
      utils.invoices.list.invalidate();
      utils.budgets.summary.invalidate();
      setShowPayment(false);
      setSelectedInv(null);
      setPayForm({ amount: "", method: "bank_transfer", reference: "", notes: "" });
    },
    onError: e => toast.error(e.message),
  });

  const createBudget = trpc.budgets.create.useMutation({
    onSuccess: () => {
      toast.success("Budget allocation created");
      refetchBudgets();
      refetchSummary();
      setShowCreateBudget(false);
      setBudgetForm({ department: "", allocatedAmount: "", fiscalYear: String(new Date().getFullYear()), notes: "" });
    },
    onError: e => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const pending = (invoices as any[]).filter((i: any) => i.status === "pending");
  const overdue = (invoices as any[]).filter((i: any) => i.status === "overdue");
  const partial = (invoices as any[]).filter((i: any) => i.status === "partial");
  const totalOwed = [...pending, ...overdue, ...partial].reduce((sum: number, inv: any) => sum + Number(inv.totalAmount) - Number(inv.paidAmount || 0), 0);
  const totalPaid = (invoices as any[]).filter((i: any) => i.status === "paid").reduce((sum: number, inv: any) => sum + Number(inv.paidAmount || 0), 0);
  const filtered = statusFilter === "all" ? invoices : (invoices as any[]).filter((i: any) => i.status === statusFilter);

  const openPayment = (inv: any) => {
    setSelectedInv(inv);
    setPayForm(prev => ({ ...prev, amount: (Number(inv.totalAmount) - Number(inv.paidAmount || 0)).toFixed(2) }));
    setShowPayment(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Financial Management</h1>
          <p className="mt-1 text-muted-foreground">Supplier-submitted invoices, payments, and budget control</p>
        </div>
        <div className="mt-2 flex w-full gap-1 border-b">
          {(["invoices", "budgets", "payments"] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === tabKey ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              {tabKey}
              {tabKey === "invoices" && overdue.length > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">{overdue.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 w-5 h-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-medium text-amber-800">Finance does not create invoices here.</p>
          <p className="mt-1 text-xs text-amber-700">Invoices must come from the supplier after pharmacy confirms receipt. Finance only reviews, records payments, and tracks balances.</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Outstanding Balance", value: formatRWFCompact(totalOwed), sub: `${pending.length + overdue.length} invoices`, color: "text-red-600", bg: "bg-red-50", icon: AlertTriangle },
          { label: "Overdue", value: overdue.length, sub: "past due date", color: "text-orange-600", bg: "bg-orange-50", icon: Clock },
          { label: "Total Paid", value: formatRWFCompact(totalPaid), sub: `${(invoices as any[]).filter((i: any) => i.status === "paid").length} invoices`, color: "text-green-600", bg: "bg-green-50", icon: CheckCircle },
          { label: "Budget Utilisation", value: `${budgetSummary?.totalAllocated ? (((budgetSummary.totalSpent || 0) / budgetSummary.totalAllocated) * 100).toFixed(0) : 0}%`, sub: `${formatRWFCompact(budgetSummary?.totalSpent || 0)} of ${formatRWFCompact(budgetSummary?.totalAllocated || 0)}`, color: "text-blue-600", bg: "bg-blue-50", icon: TrendingUp },
        ].map((item, index) => (
          <Card key={index} className={`p-4 ${item.bg}`}>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <item.icon className={`w-4 h-4 ${item.color} opacity-70`} />
            </div>
            <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.sub}</p>
          </Card>
        ))}
      </div>

      {tab === "invoices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
                  <SelectItem key={value} value={value}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(filtered as any[]).length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground"><FileText className="mx-auto mb-2 w-10 h-10 opacity-40" />No invoices match this filter</Card>
          ) : (
            (filtered as any[]).map((inv: any) => {
              const cfg = STATUS_CONFIG[inv.status] ?? { label: inv.status, color: "text-gray-600", bg: "bg-gray-50 border-gray-200" };
              const remaining = Number(inv.totalAmount) - Number(inv.paidAmount || 0);
              const pct = Number(inv.totalAmount) > 0 ? Math.min(100, (Number(inv.paidAmount || 0) / Number(inv.totalAmount)) * 100) : 0;
              return (
                <Card key={inv.id} className="p-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{inv.invoiceNumber}</p>
                        <Badge className={`text-xs ${cfg.color} ${cfg.bg}`}>{cfg.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Total: <strong className="text-foreground">{formatRWF(inv.totalAmount)}</strong>
                        {" · "}Paid: <strong className={inv.paidAmount > 0 ? "text-green-600" : "text-foreground"}>{formatRWF(inv.paidAmount || 0)}</strong>
                        {remaining > 0 && <> · <span className="font-medium text-red-600">Remaining: {formatRWF(remaining)}</span></>}
                      </p>
                      {inv.dueDate && <p className="mt-0.5 text-xs text-muted-foreground">Due: {new Date(inv.dueDate).toLocaleDateString("en-RW", { dateStyle: "medium" })}</p>}
                      {Number(inv.totalAmount) > 0 && (
                        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
                          <div className={`h-1.5 rounded-full transition-all ${pct >= 100 ? "bg-green-500" : pct > 0 ? "bg-blue-500" : "bg-gray-300"}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" onClick={() => setViewItemsInv(inv)}>
                        <List className="w-3 h-3" />View Items
                      </Button>
                      {inv.status !== "paid" && inv.status !== "cancelled" && (
                        <Button size="sm" className="gap-1 bg-green-600 text-white hover:bg-green-700" onClick={() => openPayment(inv)}>
                          <CreditCard className="w-3 h-3" />Pay
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "budgets" && (
        <div className="space-y-4">
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-green-50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Budget Overview - FY{new Date().getFullYear()}</h3>
              <Button size="sm" onClick={() => setShowCreateBudget(true)} className="gap-1"><Plus className="w-3.5 h-3.5" />Add Allocation</Button>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-4 text-center">
              <div><p className="text-xs text-muted-foreground">Allocated</p><p className="text-2xl font-bold text-blue-600">{formatRWFCompact(budgetSummary?.totalAllocated)}</p></div>
              <div><p className="text-xs text-muted-foreground">Spent</p><p className="text-2xl font-bold text-red-600">{formatRWFCompact(budgetSummary?.totalSpent)}</p></div>
              <div><p className="text-xs text-muted-foreground">Remaining</p><p className="text-2xl font-bold text-green-600">{formatRWFCompact((budgetSummary?.totalAllocated || 0) - (budgetSummary?.totalSpent || 0))}</p></div>
            </div>
          </Card>

          {(budgetList as any[]).length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No budget allocations yet</Card>
          ) : (
            (budgetList as any[]).map((budget: any) => {
              const pct = Number(budget.allocatedAmount) > 0 ? (Number(budget.spentAmount || 0) / Number(budget.allocatedAmount)) * 100 : 0;
              return (
                <Card key={budget.id} className="p-4">
                  <div className="flex cursor-pointer items-center justify-between" onClick={() => setExpandedBudget(expandedBudget === budget.id ? null : budget.id)}>
                    <div className="mr-4 min-w-0 flex-1">
                      <p className="font-medium">{budget.department}</p>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
                        <div className={`h-1.5 rounded-full transition-all ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-orange-400" : "bg-blue-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium">{formatRWFCompact(budget.spentAmount || 0)} <span className="font-normal text-muted-foreground">/ {formatRWFCompact(budget.allocatedAmount)}</span></p>
                      <p className="text-xs text-muted-foreground">FY{budget.fiscalYear}</p>
                    </div>
                    {expandedBudget === budget.id ? <ChevronUp className="ml-2 w-4 h-4 text-muted-foreground" /> : <ChevronDown className="ml-2 w-4 h-4 text-muted-foreground" />}
                  </div>
                  {expandedBudget === budget.id && budget.notes && <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{budget.notes}</p>}
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-3">
          {(invoices as any[]).filter((i: any) => Number(i.paidAmount) > 0).length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground"><CreditCard className="mx-auto mb-2 w-10 h-10 opacity-40" />No payments recorded yet</Card>
          ) : (
            (invoices as any[]).filter((i: any) => Number(i.paidAmount) > 0).map((inv: any) => (
              <Card key={inv.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatRWF(inv.paidAmount)} paid of {formatRWF(inv.totalAmount)}</p>
                  </div>
                  <Badge className={`text-xs ${STATUS_CONFIG[inv.status]?.color ?? ""} ${STATUS_CONFIG[inv.status]?.bg ?? ""}`}>{STATUS_CONFIG[inv.status]?.label ?? inv.status}</Badge>
                </div>
              </Card>
            ))
          )}
          <p className="pb-4 pt-2 text-center text-xs font-semibold text-muted-foreground">Total Paid: {formatRWF(totalPaid)}</p>
        </div>
      )}

      {(() => {
        const ViewItemsDialog = () => {
          const { data: items = [] } = trpc.purchaseOrders.getItems.useQuery(viewItemsInv?.poId ?? 0, { enabled: viewItemsInv !== null && !!viewItemsInv?.poId });
          const { data: receipt } = trpc.deliveryReceipts.getByPO.useQuery(viewItemsInv?.poId ?? 0, { enabled: viewItemsInv !== null && !!viewItemsInv?.poId });
          return (
            <Dialog open={viewItemsInv !== null} onOpenChange={open => !open && setViewItemsInv(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Invoice {viewItemsInv?.invoiceNumber} - Line Items</DialogTitle></DialogHeader>
                <div className="max-h-80 space-y-2 overflow-y-auto py-2">
                  {(items as any[]).length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No line items recorded for this PO</p>
                  ) : (
                    (items as any[]).map((item: any) => {
                      const receiptItem = (receipt?.items as any[] | undefined)?.find((r: any) => r.supplyId === item.supplyId);
                      const billedQty = receiptItem ? Number(receiptItem.receivedQuantity || 0) : Number(item.quantity || 0);
                      return (
                        <div key={item.id} className="flex items-center justify-between rounded border p-2.5 text-sm">
                          <div>
                            <p className="font-medium">{item.supplyName ?? `Supply #${item.supplyId}`}</p>
                            <p className="text-xs text-muted-foreground">{item.supplyUnit} · Unit: {formatRWF(item.unitCost)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">x {item.quantity}</p>
                            <p className="text-xs text-muted-foreground">{formatRWF(Number(item.unitCost) * billedQty)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setViewItemsInv(null)}>Close</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          );
        };
        return <ViewItemsDialog />;
      })()}

      <Dialog open={showPayment} onOpenChange={open => { setShowPayment(open); if (!open) setSelectedInv(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment - {selectedInv?.invoiceNumber}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div><label className="text-sm font-medium">Amount (RWF) *</label><Input type="number" step="0.01" className="mt-1" value={payForm.amount} onChange={e => setPayForm(prev => ({ ...prev, amount: e.target.value }))} /></div>
            <div><label className="text-sm font-medium">Payment Method *</label>
              <Select value={payForm.method} onValueChange={value => setPayForm(prev => ({ ...prev, method: value }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check / Cheque</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Transaction Reference</label><Input className="mt-1" value={payForm.reference} onChange={e => setPayForm(prev => ({ ...prev, reference: e.target.value }))} /></div>
            <div><label className="text-sm font-medium">Notes</label><Textarea className="mt-1" rows={2} value={payForm.notes} onChange={e => setPayForm(prev => ({ ...prev, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button
              disabled={recordPayment.isPending || !payForm.amount}
              onClick={() => {
                if (!selectedInv || !payForm.amount) return;
                recordPayment.mutate({
                  invoiceId: selectedInv.id,
                  amount: payForm.amount,
                  paymentMethod: payForm.method,
                  transactionReference: payForm.reference || undefined,
                  notes: payForm.notes || undefined,
                });
              }}
            >
              {recordPayment.isPending ? <><Loader2 className="mr-1 w-4 h-4 animate-spin" />Processing...</> : <><CreditCard className="mr-1 w-4 h-4" />Confirm Payment</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateBudget} onOpenChange={setShowCreateBudget}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Budget Allocation</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div><label className="text-sm font-medium">Department *</label><Input className="mt-1" value={budgetForm.department} onChange={e => setBudgetForm(prev => ({ ...prev, department: e.target.value }))} /></div>
            <div><label className="text-sm font-medium">Allocated Amount (RWF) *</label><Input type="number" className="mt-1" value={budgetForm.allocatedAmount} onChange={e => setBudgetForm(prev => ({ ...prev, allocatedAmount: e.target.value }))} /></div>
            <div><label className="text-sm font-medium">Fiscal Year *</label><Input type="number" className="mt-1" value={budgetForm.fiscalYear} onChange={e => setBudgetForm(prev => ({ ...prev, fiscalYear: e.target.value }))} /></div>
            <div><label className="text-sm font-medium">Notes</label><Input className="mt-1" value={budgetForm.notes} onChange={e => setBudgetForm(prev => ({ ...prev, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateBudget(false)}>Cancel</Button>
            <Button
              disabled={createBudget.isPending || !budgetForm.department || !budgetForm.allocatedAmount}
              onClick={() => createBudget.mutate({
                department: budgetForm.department,
                allocatedAmount: budgetForm.allocatedAmount,
                fiscalYear: parseInt(budgetForm.fiscalYear, 10),
                notes: budgetForm.notes || undefined,
              })}
            >
              {createBudget.isPending ? "Creating..." : "Create Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
