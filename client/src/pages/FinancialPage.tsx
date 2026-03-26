import { formatRWF } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, DollarSign, TrendingUp, CreditCard, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const INV_STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700", partial: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700", overdue: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-700",
};

export default function FinancialPage() {
  const { data: invoices = [], isLoading, refetch } = trpc.invoices.list.useQuery();
  const { data: budgetSummary } = trpc.budgets.summary.useQuery();
  const { data: budgets = [] } = trpc.budgets.list.useQuery();
  const recordPayment = trpc.invoices.recordPayment.useMutation({ onSuccess: () => { toast.success("Payment recorded"); refetch(); setShowPayment(false); }, onError: e => toast.error(e.message) });
  const createBudget = trpc.budgets.create.useMutation({ onSuccess: () => { toast.success("Budget created"); setShowBudget(false); }, onError: e => toast.error(e.message) });

  const [tab, setTab] = useState<"invoices" | "budget">("invoices");
  const [showPayment, setShowPayment] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [selectedInv, setSelectedInv] = useState<any>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "bank_transfer", reference: "" });
  const [budgetForm, setBudgetForm] = useState({ department: "", allocatedAmount: "", fiscalYear: String(new Date().getFullYear()) });
  const [statusFilter, setStatusFilter] = useState("all");

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  const pending = invoices.filter((i: any) => i.status === "pending");
  const overdue = invoices.filter((i: any) => i.status === "overdue");
  const totalOwed = pending.concat(overdue).reduce((s: number, i: any) => s + Number(i.totalAmount) - Number(i.paidAmount || 0), 0);
  const totalPaid = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.paidAmount || 0), 0);
  const filteredInv = statusFilter === "all" ? invoices : invoices.filter((i: any) => i.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Financial Management</h1>
          <p className="text-muted-foreground mt-1">Invoices, payments, and budget tracking</p>
          <div className="flex gap-1 mt-4 border-b">
            {(["invoices", "budget"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
                {t}{t === "invoices" && overdue.length > 0 && <span className="ml-1 bg-red-500 text-white rounded-full text-xs px-1.5">{overdue.length}</span>}
              </button>
            ))}
          </div>
        </div>
        {tab === "budget" && <Button size="sm" onClick={() => setShowBudget(true)}><Plus className="w-4 h-4 mr-1" />Add Budget</Button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Outstanding", value: formatRWF(totalOwed), color: "text-red-600", icon: DollarSign },
          { label: "Overdue", value: overdue.length, color: "text-orange-600", icon: FileText },
          { label: "Total Paid", value: formatRWF(totalPaid), color: "text-green-600", icon: CreditCard },
          { label: "Budget Util.", value: `${budgetSummary?.totalAllocated ? (((budgetSummary.totalSpent || 0) / budgetSummary.totalAllocated) * 100).toFixed(0) : 0}%`, color: "text-blue-600", icon: TrendingUp },
        ].map((s, i) => (
          <Card key={i} className="p-4"><div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-xl font-bold ${s.color}`}>{s.value}</p></div>
            <s.icon className={`w-7 h-7 ${s.color} opacity-60`} />
          </div></Card>
        ))}
      </div>

      {tab === "invoices" && (
        <>
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {filteredInv.length === 0 ? <Card className="p-12 text-center text-muted-foreground">No invoices</Card> : filteredInv.map((inv: any) => (
              <Card key={inv.id} className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{inv.invoiceNumber}</p>
                      <Badge className={`text-xs ${INV_STATUS_COLOR[inv.status] || "bg-gray-100 text-gray-700"}`}>{inv.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total: <strong>{formatRWF(inv.totalAmount)}</strong> · Paid: {formatRWF(inv.paidAmount || 0)} · Remaining: {formatRWF(Number(inv.totalAmount) - Number(inv.paidAmount || 0))}
                      {inv.dueDate && ` · Due: ${new Date(inv.dueDate).toLocaleDateString()}`}
                    </p>
                  </div>
                  {inv.status !== "paid" && inv.status !== "cancelled" && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                      setSelectedInv(inv);
                      setPayForm(p => ({ ...p, amount: (Number(inv.totalAmount) - Number(inv.paidAmount || 0)).toFixed(2) }));
                      setShowPayment(true);
                    }}><CreditCard className="w-3 h-3 mr-1" />Record Payment</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "budget" && (
        <div className="space-y-4">
          <Card className="p-5 bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
            <h3 className="font-semibold mb-4">Budget Overview — FY{new Date().getFullYear()}</h3>
            <div className="grid md:grid-cols-3 gap-4 text-center mb-4">
              <div><p className="text-xs text-muted-foreground">Allocated</p><p className="text-2xl font-bold text-blue-600">{formatRWF(budgetSummary?.totalAllocated)}</p></div>
              <div><p className="text-xs text-muted-foreground">Spent</p><p className="text-2xl font-bold text-red-600">{formatRWF(budgetSummary?.totalSpent)}</p></div>
              <div><p className="text-xs text-muted-foreground">Remaining</p><p className="text-2xl font-bold text-green-600">{formatRWF((budgetSummary?.totalAllocated || 0) - (budgetSummary?.totalSpent || 0))}</p></div>
            </div>
            {(budgetSummary?.totalAllocated || 0) > 0 && (
              <div><div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Utilization</span><span>{(((budgetSummary?.totalSpent || 0) / (budgetSummary?.totalAllocated || 1)) * 100).toFixed(1)}%</span></div>
                <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, ((budgetSummary?.totalSpent || 0) / (budgetSummary?.totalAllocated || 1)) * 100)}%` }} /></div>
              </div>
            )}
          </Card>
          {budgets.length === 0 ? <Card className="p-8 text-center text-muted-foreground">No budget allocations</Card> :
            budgets.map((b: any) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div><p className="font-medium">{b.department}</p><p className="text-xs text-muted-foreground">FY{b.fiscalYear}{b.notes && ` · ${b.notes}`}</p></div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatRWF(b.spentAmount || 0)} / {formatRWF(b.allocatedAmount)}</p>
                    <div className="w-28 bg-gray-200 rounded-full h-1.5 mt-1 ml-auto">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (Number(b.spentAmount || 0) / Number(b.allocatedAmount || 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </Card>
            ))
          }
        </div>
      )}

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment — {selectedInv?.invoiceNumber}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Amount (RWF)</label><Input type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div><label className="text-sm font-medium">Payment Method</label>
              <Select value={payForm.method} onValueChange={v => setPayForm(p => ({ ...p, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Transaction Reference</label><Input value={payForm.reference} onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))} /></div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowPayment(false)}>Cancel</Button>
              <Button className="flex-1" disabled={recordPayment.isPending} onClick={() => {
                if (!selectedInv || !payForm.amount) return;
                recordPayment.mutate({ invoiceId: selectedInv.id, amount: payForm.amount, paymentMethod: payForm.method, transactionReference: payForm.reference || undefined });
              }}>{recordPayment.isPending ? "Processing..." : "Record Payment"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBudget} onOpenChange={setShowBudget}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Budget Allocation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Department *</label><Input value={budgetForm.department} onChange={e => setBudgetForm(p => ({ ...p, department: e.target.value }))} placeholder="Pharmacy" /></div>
            <div><label className="text-sm font-medium">Allocated Amount (RWF) *</label><Input type="number" step="0.01" value={budgetForm.allocatedAmount} onChange={e => setBudgetForm(p => ({ ...p, allocatedAmount: e.target.value }))} /></div>
            <div><label className="text-sm font-medium">Fiscal Year *</label><Input type="number" value={budgetForm.fiscalYear} onChange={e => setBudgetForm(p => ({ ...p, fiscalYear: e.target.value }))} /></div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowBudget(false)}>Cancel</Button>
              <Button className="flex-1" disabled={createBudget.isPending} onClick={() => {
                if (!budgetForm.department || !budgetForm.allocatedAmount) return toast.error("Fill required fields");
                createBudget.mutate({ department: budgetForm.department, allocatedAmount: budgetForm.allocatedAmount, fiscalYear: parseInt(budgetForm.fiscalYear) });
              }}>{createBudget.isPending ? "Creating..." : "Create Budget"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
