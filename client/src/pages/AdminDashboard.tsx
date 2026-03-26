import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Shield, UserCheck, UserX, Activity, Building2, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";

const ROLE_COLOR: Record<string, string> = {
  pharmacist: "bg-blue-100 text-blue-800",
  procurement_officer: "bg-orange-100 text-orange-800",
  supplier: "bg-teal-100 text-teal-800",
  accountant: "bg-purple-100 text-purple-800",
  admin: "bg-red-100 text-red-800",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  pharmacist: "Pharmacist",
  procurement_officer: "Procurement",
  supplier: "Supplier",
  accountant: "Accountant",
};

export default function AdminDashboard() {
  const [, nav] = useLocation();
  const { data: users = [], isLoading } = trpc.userManagement.list.useQuery();
  const { data: logs } = trpc.auditTrail.list.useQuery({ limit: 15 });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const activeUsers = (users as any[]).filter((u: any) => u.isActive);
  const inactiveUsers = (users as any[]).filter((u: any) => !u.isActive);
  const byRole = (users as any[]).reduce((acc: Record<string, number>, u: any) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Shield className="w-7 h-7 text-primary" />Administration</h1>
        <p className="mt-1 text-muted-foreground">User management, supplier governance, audit, and system oversight</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Users", value: (users as any[]).length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Active", value: activeUsers.length, icon: UserCheck, color: "text-green-600", bg: "bg-green-50" },
          { label: "Inactive", value: inactiveUsers.length, icon: UserX, color: "text-red-600", bg: "bg-red-50" },
          { label: "Audit Entries", value: logs?.logs?.length ?? 0, icon: Activity, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((s, i) => (
          <Card key={i} className={`p-4 ${s.bg}`}>
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></div>
              <s.icon className={`w-7 h-7 ${s.color} opacity-60`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><Users className="w-4 h-4 text-primary" />Users by Role</h3>
          <div className="space-y-2">
            {Object.entries(byRole).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between border-b py-1 last:border-0">
                <Badge className={`${ROLE_COLOR[role] || "bg-gray-100 text-gray-700"} text-xs`}>{ROLE_LABELS[role] || role}</Badge>
                <span className="text-sm font-semibold">{count as number}</span>
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full" variant="outline" size="sm" onClick={() => nav("/admin/users")}>
            Manage Users
          </Button>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><Activity className="w-4 h-4 text-primary" />Recent Audit Activity</h3>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {(logs?.logs ?? []).slice(0, 10).map((log: any) => (
              <div key={log.id} className="flex items-start justify-between border-b py-1 text-xs last:border-0">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{log.userName || `#${log.userId}`}</span>
                  <span className="ml-1 text-muted-foreground">{log.action?.replace(/_/g, " ")}</span>
                </div>
                <span className="ml-2 shrink-0 text-muted-foreground">{new Date(log.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
            {(logs?.logs ?? []).length === 0 && <p className="text-sm text-muted-foreground">No activity yet</p>}
          </div>
          <Button className="mt-4 w-full" variant="outline" size="sm" onClick={() => nav("/admin/audit")}>
            Full Audit Log
          </Button>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Administration</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "User Management", icon: Users, path: "/admin/users" },
            { label: "Supplier Management", icon: Building2, path: "/suppliers" },
            { label: "Reports", icon: BarChart3, path: "/reporting" },
            { label: "Audit Logs", icon: Shield, path: "/admin/audit" },
          ].map((action, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-16 flex-col gap-1.5 text-xs hover:bg-muted/50"
              onClick={() => nav(action.path)}
            >
              <action.icon className="w-5 h-5 text-primary" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
