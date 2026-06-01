import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FileDown, Loader2, FileText, FileSpreadsheet } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ExportReportsProps {
  reportType: "inventory" | "suppliers" | "orders" | "financial" | "budgets" | "users" | "logs";
  period?: string;        // e.g. "daily", "monthly", "quarterly", "yearly", "custom"
  dateFrom?: string;
  dateTo?: string;
  medicineId?: number | null;  // For pharmacist medicine-specific reports
}

const REPORT_LABELS: Record<string, string> = {
  inventory: "Inventory Report",
  suppliers: "Supplier Directory Report",
  orders: "Purchase Orders Report",
  financial: "Financial & Invoices Report",
  budgets: "Budget Allocation Report",
  users: "User Directory Report",
  logs: "Audit Logs Report",
};

const SYSTEM_NAME = "MediSupply Rwanda";
const SYSTEM_SUBTITLE = "AI-Powered Pharmaceutical Supply Chain Management System";

// ── CSV builder ──────────────────────────────────────────────────
function toCSV(data: any[]): string {
  if (!data || data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...data.map(row => headers.map(h => escape(row[h])).join(","))].join("\n");
}

// ── HTML-based printable PDF with proper header ──────────────────
function buildPrintableHTML(
  reportType: string,
  data: any[],
  period: string,
  dateFrom: string,
  dateTo: string,
  medicineName?: string
): string {
  const title = REPORT_LABELS[reportType] || reportType;
  const generatedAt = new Date().toLocaleString("en-RW", { dateStyle: "full", timeStyle: "short" });
  const periodLabel = {
    daily: "Today",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Annual",
    custom: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : "Custom Range"
  }[period] ?? period;

  if (!data || data.length === 0) {
    return `<html><body><p>No data available for this report.</p></body></html>`;
  }

  const headers = Object.keys(data[0]);

  const rows = data.map(row => `
    <tr>
      ${headers.map(h => `<td>${row[h] ?? ""}</td>`).join("")}
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title} — ${SYSTEM_NAME}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1f2937; padding: 24px; }

    /* ── HEADER ── */
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1E3A5F; padding-bottom: 14px; margin-bottom: 18px; }
    .logo-block { display: flex; align-items: center; gap: 12px; }
    .logo-circle { width: 48px; height: 48px; background: #1E3A5F; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; flex-shrink: 0; }
    .logo-text h1 { font-size: 20px; font-weight: bold; color: #1E3A5F; }
    .logo-text p { font-size: 9px; color: #6B7280; margin-top: 2px; }
    .header-right { text-align: right; }
    .report-title { font-size: 15px; font-weight: bold; color: #1E3A5F; }
    .report-meta { font-size: 9px; color: #6B7280; margin-top: 3px; line-height: 1.6; }

    /* ── SUMMARY BAND ── */
    .summary-band { background: #EBF4FB; border: 1px solid #D6E4F0; border-radius: 6px; padding: 10px 16px; margin-bottom: 16px; display: flex; gap: 32px; }
    .summary-item label { display: block; font-size: 9px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-item span { font-size: 14px; font-weight: bold; color: #1E3A5F; }

    /* ── TABLE ── */
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead th { background: #1E3A5F; color: white; padding: 7px 8px; text-align: left; font-size: 10px; font-weight: bold; }
    tbody tr:nth-child(even) { background: #F3F4F6; }
    tbody tr:nth-child(odd) { background: #FFFFFF; }
    tbody td { padding: 6px 8px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }

    /* ── FOOTER ── */
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; font-size: 9px; color: #9CA3AF; }

    @media print {
      body { padding: 12px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="header">
    <div class="logo-block">
      <div class="logo-circle">MS</div>
      <div class="logo-text">
        <h1>${SYSTEM_NAME}</h1>
        <p>${SYSTEM_SUBTITLE}</p>
      </div>
    </div>
    <div class="header-right">
      <div class="report-title">${title}</div>
      <div class="report-meta">
        Period: <strong>${periodLabel}</strong><br/>
        Generated: ${generatedAt}<br/>
        Total Records: ${data.length}
      </div>
    </div>
  </div>

  <!-- SUMMARY BAND -->
  <div class="summary-band">
    <div class="summary-item">
      <label>Report Type</label>
      <span>${title}</span>
    </div>
    <div class="summary-item">
      <label>Period</label>
      <span>${periodLabel}</span>
    </div>
    <div class="summary-item">
      <label>Records</label>
      <span>${data.length}</span>
    </div>
    <div class="summary-item">
      <label>Generated</label>
      <span>${new Date().toLocaleDateString("en-RW")}</span>
    </div>
  </div>

  <!-- DATA TABLE -->
  <table>
    <thead>
      <tr>${headers.map(h => `<th>${h.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}</th>`).join("")}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- FOOTER -->
  <div class="footer">
    <span>${SYSTEM_NAME} — Confidential</span>
    <span>Printed: ${generatedAt}</span>
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

// ── CSV header block ─────────────────────────────────────────────
function buildCSVWithHeader(reportType: string, data: any[], period: string, dateFrom: string, dateTo: string, medicineName?: string): string {
  const title = REPORT_LABELS[reportType] || reportType;
  const periodLabel = {
    daily: "Today",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Annual",
    custom: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : "Custom Range"
  }[period] ?? "All Time";

  const header = [
    `# ${SYSTEM_NAME}`,
    `# ${title}`,
    `# Period: ${periodLabel}`,
    `# Generated: ${new Date().toLocaleString("en-RW")}`,
    `# Records: ${data.length}`,
    `#`,
  ].join("\n");

  return header + "\n" + toCSV(data);
}

export default function ExportReports({ reportType, period = "monthly", dateFrom = "", dateTo = "", medicineId }: ExportReportsProps) {
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);
  const [isExporting, setIsExporting] = useState(false);

  const inventoryQ  = trpc.export.inventoryToJSON.useQuery(undefined, { enabled: false });
  const suppliersQ  = trpc.export.suppliersToJSON.useQuery(undefined, { enabled: false });
  const ordersQ     = trpc.export.ordersToJSON.useQuery(undefined, { enabled: false });
  const financialQ  = trpc.export.financialToJSON.useQuery(undefined, { enabled: false });
  const budgetsQ    = trpc.export.budgetsToJSON.useQuery(undefined, { enabled: false });
  const usersQ      = trpc.export.usersToJSON.useQuery(undefined, { enabled: false });
  const logsQ       = trpc.export.logsToJSON.useQuery(undefined, { enabled: false });
  const suppliessQ  = trpc.supplies.list.useQuery(undefined, { enabled: !!medicineId });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const queryMap: Record<string, { refetch: () => Promise<any> }> = {
        inventory: inventoryQ,
        suppliers: suppliersQ,
        orders: ordersQ,
        financial: financialQ,
        budgets: budgetsQ,
        users: usersQ,
        logs: logsQ,
      };

      const result = await queryMap[reportType].refetch();
      let data: any[] = result.data?.data ?? [];

      // Filter by medicine if medicineId is provided (pharmacy-specific reports)
      let medicineName = "";
      if (medicineId) {
        const medicine = suppliessQ.data?.find((m: any) => m.id === medicineId);
        medicineName = medicine ? `${medicine.name} (${medicine.code})` : "";

        if (reportType === "inventory") {
          data = data.filter((item: any) => item.id === medicineId);
        } else if (reportType === "orders") {
          data = data.filter((item: any) => item.medicineId === medicineId);
        }
      }

      if (!data || data.length === 0) {
        toast.error("No data available for this report");
        return;
      }

      const dateStr = new Date().toISOString().split("T")[0];
      const medicineLabel = medicineName ? ` - ${medicineName}` : "";
      const filename = `${reportType}-report-${dateStr}${medicineId ? `-med${medicineId}` : ""}`;
      const effectivePeriod = period || "monthly";

      if (exportFormat === "csv") {
        const csv = buildCSVWithHeader(reportType, data, effectivePeriod, customFrom, customTo, medicineLabel);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        downloadBlob(blob, `${filename}.csv`);
        toast.success(`${REPORT_LABELS[reportType]} exported as CSV`);
      } else {
        // Open printable HTML in new tab — browser's native print-to-PDF
        const html = buildPrintableHTML(reportType, data, effectivePeriod, customFrom, customTo, medicineLabel);
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
        } else {
          // Fallback: download as HTML if popup blocked
          const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
          downloadBlob(blob, `${filename}.html`);
          toast.info("Popup blocked — downloaded as HTML. Open and print to PDF.");
        }
        toast.success(`${REPORT_LABELS[reportType]} opened for printing`);
      }
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const icon = exportFormat === "pdf" ? FileText : FileSpreadsheet;
  const Icon = icon;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileDown className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-semibold">{REPORT_LABELS[reportType]}</h3>
          <p className="text-xs text-muted-foreground">{SYSTEM_NAME}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Export Format</label>
          <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">
                <div className="flex items-center gap-2"><FileSpreadsheet className="w-3.5 h-3.5" />CSV — Excel / Spreadsheet</div>
              </SelectItem>
              <SelectItem value="pdf">
                <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" />PDF — Print / Share</div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {period === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
              <Input type="date" className="h-9 text-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
              <Input type="date" className="h-9 text-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        {/* Report header preview */}
        <div className="bg-muted/40 rounded p-3 text-xs space-y-0.5 border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0">MS</div>
            <span className="font-semibold text-primary">{SYSTEM_NAME}</span>
          </div>
          <div className="text-muted-foreground">{REPORT_LABELS[reportType]}</div>
          {medicineId && suppliessQ.data && (
            <div className="text-muted-foreground font-medium text-primary">
              Medicine: {suppliessQ.data.find((m: any) => m.id === medicineId)?.name || "Loading..."}
            </div>
          )}
          <div className="text-muted-foreground">
            Period: {period === "custom" ? `${customFrom || "—"} to ${customTo || "—"}` :
              { monthly: "Monthly", quarterly: "Quarterly", yearly: "Annual", daily: "Daily" }[period] ?? period}
          </div>
          <div className="text-muted-foreground">Generated: {new Date().toLocaleDateString("en-RW")}</div>
        </div>

        <Button onClick={handleExport} disabled={isExporting} className="w-full gap-2">
          {isExporting
            ? <><Loader2 className="w-4 h-4 animate-spin" />Exporting...</>
            : <><Icon className="w-4 h-4" />Export {exportFormat.toUpperCase()}</>}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {exportFormat === "pdf"
            ? "Opens a print-ready page. Use Ctrl+P (or Cmd+P) → Save as PDF."
            : "Downloads a CSV file. Open in Excel, Google Sheets, or any spreadsheet app."}
        </p>
      </div>
    </Card>
  );
}
