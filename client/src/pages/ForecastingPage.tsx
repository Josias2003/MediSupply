import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, Activity, AlertTriangle, Zap, Database, Brain, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatRWF, formatRWFCompact } from "@/lib/utils";

const URGENCY_CONFIG: Record<string, { color: string; label: string; dot: string }> = {
  critical: { color: "bg-red-50 border-red-200",    label: "Critical Priority",  dot: "bg-red-500" },
  high:     { color: "bg-orange-50 border-orange-200", label: "High Priority",   dot: "bg-orange-500" },
  medium:   { color: "bg-amber-50 border-amber-200",  label: "Medium Priority",  dot: "bg-amber-400" },
};

const METHOD_INFO: Record<string, { name: string; desc: string }> = {
  ml:                   { name: "Ensemble / ML",            desc: "Weighted average of all three models. Best for general use." },
  linear:               { name: "OLS Linear Regression",    desc: "Fits a trend line to historical usage. Good for steady growth/decline." },
  exponential_smoothing:{ name: "Holt Double Smoothing",    desc: "Weights recent data more heavily. Good for seasonal patterns." },
  arima:                { name: "AR(1) Autoregressive",     desc: "Uses the autocorrelation of the series. Good for irregular patterns." },
};

export default function ForecastingPage() {
  const { data: supplies = [] } = trpc.inventory.list.useQuery();
  const { data: forecasts = [], refetch } = trpc.aiForecasting.getAllForecasts.useQuery();
  const { data: recs, isLoading: recsLoading } = trpc.aiForecasting.getDemandRecommendations.useQuery();

  const generateForecast = trpc.aiForecasting.generateForecast.useMutation({
    onSuccess: (data) => {
      toast.success(`Forecast complete — ${data.forecast.predictedQuantity.toLocaleString()} units predicted (${(data.forecast.confidence * 100).toFixed(0)}% confidence)`);
      refetch();
      setLastResult(data);
    },
    onError: e => toast.error(e.message),
  });

  const [selectedSupply, setSelectedSupply] = useState("");
  const [method, setMethod] = useState<"linear" | "exponential_smoothing" | "arima" | "ml">("ml");
  const [period, setPeriod] = useState("2026-Q2");
  const [tab, setTab] = useState<"recommendations" | "generate" | "history">("recommendations");
  const [lastResult, setLastResult] = useState<any>(null);

  const supplyMap = new Map((supplies as any[]).map((s: any) => [s.id, s]));

  const totalEstimatedCost = recs?.recommendations?.reduce((s: number, r: any) => s + (r.estimatedCostRWF || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="w-8 h-8 text-primary" />AI Demand Forecasting
        </h1>
        <p className="text-muted-foreground mt-1">Statistical demand predictions powered by real transaction history — Linear Regression, Holt Smoothing, AR(1), and ML Ensemble</p>
        <div className="flex gap-1 mt-4 border-b">
          {(["recommendations","generate","history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
              {t === "recommendations" && (recs?.recommendations?.length ?? 0) > 0 && (
                <span className="ml-1.5 bg-red-500 text-white rounded-full text-xs px-1.5 py-0.5">{recs!.recommendations!.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── RECOMMENDATIONS ── */}
      {tab === "recommendations" && (
        <div className="space-y-4">
          {/* Summary banner */}
          {(recs?.recommendations?.length ?? 0) > 0 && (
            <Card className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="font-semibold text-purple-900">{recs!.recommendations!.length} items need procurement action</p>
                  <p className="text-sm text-purple-700 mt-0.5">
                    {recs!.recommendations!.filter((r: any) => r.urgency === "critical").length} critical ·{" "}
                    {recs!.recommendations!.filter((r: any) => r.urgency === "high").length} high ·{" "}
                    {recs!.recommendations!.filter((r: any) => r.urgency === "medium").length} medium
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Estimated procurement cost</p>
                  <p className="text-xl font-bold text-purple-800">{formatRWFCompact(totalEstimatedCost)}</p>
                </div>
              </div>
            </Card>
          )}

          {recsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin w-8 h-8 text-purple-500" /></div>
          ) : (recs?.recommendations?.length ?? 0) === 0 ? (
            <Card className="p-14 text-center text-muted-foreground border-green-200 bg-green-50">
              <Activity className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-60" />
              <p className="font-semibold text-green-800">All stock levels are healthy</p>
              <p className="text-sm text-green-700 mt-1">No procurement action required at this time</p>
            </Card>
          ) : recs!.recommendations!.map((r: any) => (
            <Card key={r.supplyId} className={`p-4 border ${URGENCY_CONFIG[r.urgency]?.color ?? ""}`}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${URGENCY_CONFIG[r.urgency]?.dot ?? "bg-gray-400"}`} />
                    <p className="font-semibold">{r.supplyName}</p>
                    <Badge variant="outline" className="text-xs">{r.category}</Badge>
                    <Badge className={`text-xs ${r.urgency === "critical" ? "bg-red-100 text-red-800" : r.urgency === "high" ? "bg-orange-100 text-orange-800" : "bg-amber-100 text-amber-800"}`}>
                      {URGENCY_CONFIG[r.urgency]?.label ?? r.urgency}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground mb-2">
                    <span>Stock: <strong className="text-red-600">{r.currentStock} {r.unit}</strong></span>
                    <span>Reorder point: <strong className="text-foreground">{r.reorderPoint}</strong></span>
                    <span>30-day forecast: <strong className="text-foreground">{r.predictedDemand30d.toLocaleString()} {r.unit}</strong></span>
                    <span>Days cover: <strong className={r.stockCoverDays < 7 ? "text-red-600" : "text-foreground"}>{r.stockCoverDays < 999 ? `${r.stockCoverDays}d` : "∞"}</strong></span>
                  </div>
                  {/* Stock coverage bar */}
                  <div className="w-full max-w-xs">
                    <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                      <span>Stock vs. reorder point</span>
                      <span>{r.reorderPoint > 0 ? Math.round((r.currentStock / r.reorderPoint) * 100) : 0}%</span>
                    </div>
                    <Progress value={r.reorderPoint > 0 ? Math.min(100, (r.currentStock / r.reorderPoint) * 100) : 0}
                      className="h-1.5" />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">Order {r.recommendedOrderQty.toLocaleString()} {r.unit}</p>
                  <p className="text-xs text-muted-foreground">{formatRWF(r.estimatedCostRWF)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(r.confidence * 100).toFixed(0)}% confidence · {r.dataPointsUsed} data pts</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── GENERATE ── */}
      {tab === "generate" && (
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />Generate Demand Forecast</h3>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium block mb-1">Medical Supply *</label>
                <Select value={selectedSupply} onValueChange={setSelectedSupply}>
                  <SelectTrigger><SelectValue placeholder="Select supply…" /></SelectTrigger>
                  <SelectContent>
                    {(supplies as any[]).map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} <span className="text-muted-foreground">— {s.currentStock} {s.unit}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Forecast Period</label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026-Q1">Q1 2026 (Jan–Mar)</SelectItem>
                    <SelectItem value="2026-Q2">Q2 2026 (Apr–Jun)</SelectItem>
                    <SelectItem value="2026-Q3">Q3 2026 (Jul–Sep)</SelectItem>
                    <SelectItem value="2026-Q4">Q4 2026 (Oct–Dec)</SelectItem>
                    <SelectItem value="2026-H1">H1 2026 (6 months)</SelectItem>
                    <SelectItem value="2026-H2">H2 2026 (6 months)</SelectItem>
                    <SelectItem value="2026-Annual">Full Year 2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium block mb-1">Algorithm</label>
                <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_INFO).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <span className="font-medium">{info.name}</span>
                          <span className="text-muted-foreground text-xs ml-2">{info.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {METHOD_INFO[method] && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <Info className="w-3 h-3" />{METHOD_INFO[method].desc}
                  </p>
                )}
              </div>
            </div>
            <Button className="w-full md:w-auto gap-2" disabled={!selectedSupply || generateForecast.isPending}
              onClick={() => { if (!selectedSupply) return; generateForecast.mutate({ supplyId: parseInt(selectedSupply), forecastPeriod: period, method }); }}>
              {generateForecast.isPending ? <><Loader2 className="animate-spin w-4 h-4" />Calculating…</> : <><Zap className="w-4 h-4" />Run Forecast</>}
            </Button>
          </Card>

          {lastResult && (
            <Card className="p-5 border-green-200 bg-green-50">
              <h3 className="font-semibold text-green-800 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Latest Forecast Results</h3>
              <div className="bg-white rounded-lg border p-4">
                <p className="text-lg font-bold">{lastResult.forecast.supplyName}</p>
                <div className="flex items-center gap-3 mt-0.5 mb-4 flex-wrap">
                  <span className="text-xs text-muted-foreground">Period: {lastResult.forecast.period}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">Algorithm: {METHOD_INFO[lastResult.forecast.method]?.name ?? lastResult.forecast.method}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Predicted Demand</p>
                    <p className="text-2xl font-bold text-blue-600">{lastResult.forecast.predictedQuantity.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">units / 30 days</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                    <p className="text-2xl font-bold text-purple-600">{(lastResult.forecast.confidence * 100).toFixed(0)}%</p>
                    <Progress value={lastResult.forecast.confidence * 100} className="mt-1 h-1.5" />
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Data Points</p>
                    <p className="text-2xl font-bold text-gray-700">{lastResult.forecast.dataPointsUsed}</p>
                    <p className="text-xs text-muted-foreground">transactions used</p>
                  </div>
                </div>
                {lastResult.forecast.recommendations?.map((rec: string, i: number) => (
                  <div key={i} className="p-3 bg-amber-50 rounded border border-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">{rec}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === "history" && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />Forecast History
            <span className="text-xs text-muted-foreground font-normal ml-1">({(forecasts as any[]).length} records)</span>
          </h3>
          {(forecasts as any[]).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No forecasts generated yet — run one from the Generate tab
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(forecasts as any[]).map((f: any) => {
                const supply = supplyMap.get(f.supplyId);
                return (
                  <div key={f.id} className="flex items-center justify-between p-3 border rounded text-sm hover:bg-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{supply?.name || `Supply #${f.supplyId}`}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{f.forecastPeriod}</span>
                        {f.method && <Badge variant="outline" className="text-xs h-4">{METHOD_INFO[f.method]?.name ?? f.method}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                      <div className="text-right">
                        <span className="font-semibold">{f.predictedQuantity.toLocaleString()}</span>
                        <span className="text-muted-foreground text-xs"> units</span>
                        {f.actualQuantity != null && (
                          <div className="text-xs text-muted-foreground">actual: {f.actualQuantity.toLocaleString()}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">{(Number(f.confidence) * 100).toFixed(0)}% conf.</Badge>
                        {f.accuracy != null && <div className="text-xs text-green-600 mt-0.5">{Number(f.accuracy).toFixed(1)}% accurate</div>}
                      </div>
                      <span className="text-xs text-muted-foreground">{f.dataPointsUsed ?? 0} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
