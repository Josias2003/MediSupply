import { trpc } from "@/lib/trpc";
import { getActionColors } from "@/utils/roleColors";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardList, Shield, User, Clock } from "lucide-react";
import { useState } from "react";

function getActionColor(action: string) {
  const actionType = action?.split("_")[0]?.toLowerCase() || "";
  const mapping: Record<string, string> = {
    create: "added",
    delete: "deleted",
    update: "modified",
    approve: "added",
    reject: "deleted",
    submit: "modified",
    record: "modified",
    log: "modified",
    login: "viewed",
    change: "modified",
    cancel: "deleted",
    supplier: "modified",
    generate: "added",
    activate: "added",
    deactivate: "deleted",
  };
  const colorType = mapping[actionType] || "modified";
  const colors = getActionColors(colorType);
  return `${colors.bg} ${colors.text}`;
}

export default function AuditLogsPage() {
  const { data, isLoading } = trpc.auditTrail.list.useQuery({ limit: 300 });
  const logs = data?.logs ?? [];
  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterAction, setFilterAction] = useState("all");

  const entities = [...new Set(logs.map((l: any) => l.entityType).filter(Boolean))].sort();
  const actionPrefixes = [...new Set(logs.map((l: any) => l.action?.split("_")[0]).filter(Boolean))].sort();

  const filtered = logs.filter((l: any) => {
    const ms = !search || l.action?.toLowerCase().includes(search.toLowerCase()) || l.userName?.toLowerCase().includes(search.toLowerCase()) || l.entityType?.includes(search) || String(l.entityId)?.includes(search);
    const me = filterEntity === "all" || l.entityType === filterEntity;
    const ma = filterAction === "all" || l.action?.startsWith(filterAction);
    return ms && me && ma;
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Shield className="w-7 h-7 text-primary" />Audit Trail</h1>
        <p className="text-muted-foreground mt-1">Immutable record of all system actions — {logs.length} entries</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <ClipboardList className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search action, user, entity ID…" className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Entity Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {entities.map((e: any) => <SelectItem key={e} value={e}>{e.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Action Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actionPrefixes.map((a: any) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || filterEntity !== "all" || filterAction !== "all") && (
          <Button variant="outline" onClick={() => { setSearch(""); setFilterEntity("all"); setFilterAction("all"); }}>Clear</Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} results{filtered.length !== logs.length ? ` (filtered from ${logs.length})` : ""}</div>

      <div className="space-y-2">
        {filtered.slice(0, 150).map((log: any) => (
          <Card key={log.id} className="p-3 hover:bg-muted/20 transition-colors">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <Badge className={`text-xs shrink-0 ${getActionColor(log.action)}`}>{log.action?.replace(/_/g, " ")}</Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="w-3 h-3 shrink-0" />
                  <span className="font-medium text-foreground">{log.userName || `User #${log.userId}`}</span>
                  {log.userRole && <span className="capitalize text-muted-foreground">({log.userRole.replace(/_/g, " ")})</span>}
                </div>
                {log.entityType && (
                  <span className="text-xs text-muted-foreground capitalize">· {log.entityType.replace(/_/g, " ")} {log.entityId ? `#${log.entityId}` : ""}</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" />
                {new Date(log.createdAt).toLocaleString("en-RW", { dateStyle: "medium", timeStyle: "short" })}
              </div>
            </div>
            {log.changes && (
              <p className="text-xs text-muted-foreground mt-1.5 font-mono bg-muted/40 rounded px-2 py-1 truncate">{log.changes}</p>
            )}
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
            {logs.length === 0 ? "No audit activity yet" : "No logs match your filters"}
          </Card>
        )}
      </div>
    </div>
  );
}
