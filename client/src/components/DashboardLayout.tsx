import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { getRoleColors } from "@/utils/roleColors";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft, Package, ShoppingCart, Users,
  DollarSign, BarChart3, Truck, Bell, ClipboardList, TrendingUp, UserCircle, Moon, Sun,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";

type MenuItem = { icon: React.ElementType; label: string; path: string; roles: string[] };

const allMenuItems: MenuItem[] = [
  // All roles
  { icon: LayoutDashboard, label: "Dashboard",      path: "/",             roles: ["admin","pharmacist","procurement_officer","supplier","accountant"] },
  { icon: Bell,            label: "Notifications",  path: "/notifications", roles: ["pharmacist","procurement_officer","supplier","accountant"] },
  // Pharmacist only (+ admin)
  { icon: Package,         label: "Inventory",      path: "/inventory",    roles: ["pharmacist"] },
  { icon: ClipboardList,   label: "Requisitions",   path: "/requisitions", roles: ["pharmacist"] },
  { icon: TrendingUp,      label: "AI Forecasting", path: "/forecasting",  roles: ["pharmacist","procurement_officer"] },
  // Procurement only (+ admin)
  { icon: ShoppingCart,    label: "Procurement",    path: "/procurement",  roles: ["procurement_officer","supplier"] },
  { icon: Truck,           label: "Suppliers",      path: "/suppliers",    roles: ["admin"] },
  // Accountant only (+ admin)
  { icon: DollarSign,      label: "Financial",      path: "/financial",    roles: ["accountant"] },
  { icon: BarChart3,       label: "Reports",        path: "/reporting",    roles: ["admin","pharmacist","procurement_officer","supplier","accountant"] },
  // Admin only
  { icon: Users,           label: "User Management", path: "/admin/users", roles: ["admin"] },
  { icon: ClipboardList,   label: "Audit Logs",     path: "/admin/audit",  roles: ["admin"] },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 380;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()); }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <h1 className="text-2xl font-semibold text-center">Sign in to continue</h1>
          <Button onClick={() => { window.location.href = "/"; }} size="lg" className="w-full">Sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ setSidebarWidth, children }: { setSidebarWidth: (w: number) => void; children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isOpen: isCollapsed, toggleSidebar } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { data: unreadCount = 0 } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 30000 });

  const menuItems = allMenuItems.filter(item => user?.role && item.roles.includes(user.role));
  const activeMenuItem = menuItems.find(item => item.path === location || (item.path !== "/" && location.startsWith(item.path)));

  useEffect(() => { if (isCollapsed) setIsResizing(false); }, [isCollapsed]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const w = e.clientX - left;
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) setSidebarWidth(w);
    };
    const onUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center border-b">
            <div className="flex items-center gap-3 px-2 w-full">
              <button onClick={toggleSidebar} className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors shrink-0">
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-bold tracking-tight truncate text-primary">MediSupply</span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-10 transition-all font-normal">
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                      {item.path === "/notifications" && unreadCount > 0 && (
                        <Badge className="ml-auto h-5 min-w-5 px-1 text-xs bg-red-500 text-white shrink-0">{unreadCount > 9 ? "9+" : unreadCount}</Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t">
            {!isCollapsed && user?.role && (
              <div className={`text-xs px-2 py-1 rounded mb-2 font-medium ${getRoleColors(user.role).bg} ${getRoleColors(user.role).text}`}>
                {user.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">{user?.email || "-"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" /><span>My Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /><span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }} style={{ zIndex: 50 }} />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground">{activeMenuItem?.label ?? "Menu"}</span>
            </div>
            <div className="flex items-center gap-2">
              {(unreadCount as number) > 0 && <Badge className="bg-red-500 text-white">{unreadCount as number} New</Badge>}
              <button
                onClick={() => toggleTheme?.()}
                className="inline-flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-accent transition-colors"
                title={theme === "dark" ? "Light mode" : "Dark mode"}
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
