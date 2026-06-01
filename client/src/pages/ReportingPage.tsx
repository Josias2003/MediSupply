import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calendar, BarChart3, Pill } from "lucide-react";
import { useMemo, useState } from "react";
import ExportReports from "@/components/ExportReports";

type Preset = "daily" | "monthly" | "quarterly" | "yearly" | "custom";
type ReportType = "inventory" | "orders" | "financial" | "budgets" | "users" | "logs";

const REPORT_ORDER: ReportType[] = ["inventory", "orders", "financial", "budgets", "users", "logs"];

export default function ReportingPage() {
  const { user } = useAuth();
  const [preset, setPreset] = useState<Preset>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedMedicineId, setSelectedMedicineId] = useState<number | null>(null);

  const { data, isLoading } = trpc.export.allowedReports.useQuery();
  const { data: medicines = [] } = trpc.supplies.list.useQuery(undefined, {
    enabled: user?.role === "pharmacist",
  });

  const allowedReports = useMemo(
    () => REPORT_ORDER.filter(type => (data?.reports ?? []).includes(type)),
    [data]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="mt-1 text-muted-foreground">
          Export readable reports with names and business labels instead of raw internal IDs.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Report Period:</span>
          <Select value={preset} onValueChange={(value: Preset) => setPreset(value)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Today</SelectItem>
              <SelectItem value="monthly">This Month</SelectItem>
              <SelectItem value="quarterly">This Quarter</SelectItem>
              <SelectItem value="yearly">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <>
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-40 text-sm" />
              <span className="text-sm text-muted-foreground">to</span>
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-40 text-sm" />
            </>
          )}
        </div>

        {user?.role === "pharmacist" && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
            <Pill className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter by Medicine (Optional):</span>
            <Select value={selectedMedicineId?.toString() || "all"} onValueChange={(val) => setSelectedMedicineId(val === "all" ? null : parseInt(val))}>
              <SelectTrigger className="w-64"><SelectValue placeholder="All Medicines" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Medicines</SelectItem>
                {medicines.map((med: any) => (
                  <SelectItem key={med.id} value={med.id.toString()}>
                    {med.name} ({med.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : allowedReports.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <BarChart3 className="mx-auto mb-3 w-10 h-10 opacity-40" />
          No reports are available for your role.
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {allowedReports.map(reportType => (
            <ExportReports
              key={reportType}
              reportType={reportType}
              period={preset}
              dateFrom={customFrom}
              dateTo={customTo}
              medicineId={user?.role === "pharmacist" ? selectedMedicineId : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
