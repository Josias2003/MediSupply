import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import PharmacistDashboard from "./pages/PharmacistDashboard";
import ProcurementDashboard from "./pages/ProcurementDashboard";
import SupplierDashboard from "./pages/SupplierDashboard";
import AccountantDashboard from "./pages/AccountantDashboard";
import InventoryPage from "./pages/InventoryPage";
import SuppliersPage from "./pages/SuppliersPage";
import ProcurementPage from "./pages/ProcurementPage";
import FinancialPage from "./pages/FinancialPage";
import ReportingPage from "./pages/ReportingPage";
import ForecastingPage from "./pages/ForecastingPage";
import NotificationsPage from "./pages/NotificationsPage";
import UserManagementPage from "./pages/UserManagementPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProfilePage from "./pages/ProfilePage";
import RequisitionsPage from "./pages/RequisitionsPage";
import { Loader2 } from "lucide-react";

function ProtectedRouter() {
  const { user } = useAuth();

  const RoleDashboard = () => {
    switch (user?.role) {
      case "admin": return <AdminDashboard />;
      case "pharmacist": return <PharmacistDashboard />;
      case "procurement_officer": return <ProcurementDashboard />;
      case "supplier": return <SupplierDashboard />;
      case "accountant": return <AccountantDashboard />;
      default: return <NotFound />;
    }
  };

  const can = (...roles: string[]) => user?.role && roles.includes(user.role);

  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={RoleDashboard} />
        <Route path="/inventory">{can("admin","pharmacist") ? <InventoryPage /> : <NotFound />}</Route>
        <Route path="/suppliers">{can("admin") ? <SuppliersPage /> : <NotFound />}</Route>
        <Route path="/procurement">{can("admin","procurement_officer","supplier") ? <ProcurementPage /> : <NotFound />}</Route>
        <Route path="/financial">{can("admin","accountant") ? <FinancialPage /> : <NotFound />}</Route>
        <Route path="/reporting">{can("admin","pharmacist","procurement_officer","supplier","accountant") ? <ReportingPage /> : <NotFound />}</Route>
        <Route path="/forecasting">{can("admin","pharmacist","procurement_officer") ? <ForecastingPage /> : <NotFound />}</Route>
        <Route path="/requisitions">{can("admin","pharmacist") ? <RequisitionsPage /> : <NotFound />}</Route>
        <Route path="/notifications">{can("pharmacist","procurement_officer","supplier","accountant") ? <NotificationsPage /> : <NotFound />}</Route>
        <Route path="/admin/users">{can("admin") ? <UserManagementPage /> : <NotFound />}</Route>
        <Route path="/admin/audit">{can("admin") ? <AuditLogsPage /> : <NotFound />}</Route>
        <Route path="/profile" component={ProfilePage} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/" component={Home} />
        <Route component={Home} />
      </Switch>
    );
  }

  return <ProtectedRouter />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
