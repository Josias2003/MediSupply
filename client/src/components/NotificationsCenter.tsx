import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle, Clock, Settings } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface NotificationsCenterProps {
  onPreferencesClick?: () => void;
}

export default function NotificationsCenter({ onPreferencesClick }: NotificationsCenterProps) {
  const utils = trpc.useUtils();
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
  const [filterType, setFilterType] = useState<string>("all");

  const { data: notifications = [] } = trpc.notifications.list.useQuery();
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      setSelectedNotifications([]);
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "low_stock":
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case "expiry_warning":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "approval_pending":
        return <Clock className="w-5 h-5 text-blue-500" />;
      case "order_update":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "delivery_delay":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "budget_alert":
      case "payment_due":
        return <AlertCircle className="w-5 h-5 text-purple-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationBadge = (type: string) => {
    const badges: Record<string, { label: string; variant: "secondary" | "destructive" | "outline" }> = {
      low_stock: { label: "Low Stock", variant: "secondary" },
      expiry_warning: { label: "Expiry", variant: "destructive" },
      approval_pending: { label: "Approval", variant: "outline" },
      order_update: { label: "Order", variant: "secondary" },
      delivery_delay: { label: "Delivery", variant: "secondary" },
      budget_alert: { label: "Budget", variant: "secondary" },
      payment_due: { label: "Payment", variant: "secondary" },
    };
    return badges[type] || { label: "Alert", variant: "secondary" };
  };

  const filteredNotifications = filterType === "all"
    ? notifications
    : notifications.filter((n: any) => n.type === filterType);

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;
  const selectedUnreadIds = selectedNotifications.filter(id =>
    notifications.some((n: any) => n.id === id && !n.isRead)
  );

  const handleSelectNotification = (id: number) => {
    setSelectedNotifications(prev =>
      prev.includes(id) ? prev.filter(nId => nId !== id) : [...prev, id]
    );
  };

  const handleMarkSelectedAsRead = async () => {
    for (const id of selectedUnreadIds) {
      await markAsReadMutation.mutateAsync(id);
    }
    setSelectedNotifications([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Notifications</h2>
          {unreadCount > 0 && <Badge className="bg-red-500">{unreadCount} New</Badge>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onPreferencesClick}
          className="flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Preferences
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button variant={filterType === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterType("all")}>All</Button>
        <Button variant={filterType === "low_stock" ? "default" : "outline"} size="sm" onClick={() => setFilterType("low_stock")}>Low Stock</Button>
        <Button variant={filterType === "expiry_warning" ? "default" : "outline"} size="sm" onClick={() => setFilterType("expiry_warning")}>Expiry</Button>
        <Button variant={filterType === "approval_pending" ? "default" : "outline"} size="sm" onClick={() => setFilterType("approval_pending")}>Approvals</Button>
        <Button variant={filterType === "order_update" ? "default" : "outline"} size="sm" onClick={() => setFilterType("order_update")}>Orders</Button>
      </div>

      {selectedNotifications.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <span className="text-sm font-medium text-blue-900">{selectedNotifications.length} selected</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkSelectedAsRead}
            disabled={selectedUnreadIds.length === 0 || markAsReadMutation.isPending}
            className="text-blue-700 hover:text-blue-800"
          >
            Mark as Read
          </Button>
        </div>
      )}

      <div className="max-h-96 space-y-2 overflow-y-auto">
        {filteredNotifications.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">No notifications</p>
          </Card>
        ) : (
          filteredNotifications.map((notification: any) => (
            <Card
              key={notification.id}
              className={`cursor-pointer p-4 transition-colors ${
                notification.isRead ? "bg-gray-50" : "bg-blue-50 border-blue-200"
              } hover:bg-gray-100`}
            >
              <div className="flex gap-3">
                <Checkbox
                  checked={selectedNotifications.includes(notification.id)}
                  onCheckedChange={() => handleSelectNotification(notification.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    {getNotificationIcon(notification.type)}
                    <h3 className="text-sm font-semibold">{notification.title}</h3>
                    <Badge variant={getNotificationBadge(notification.type).variant}>
                      {getNotificationBadge(notification.type).label}
                    </Badge>
                  </div>
                  <p className="mb-2 text-sm text-gray-600">{notification.message}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsReadMutation.mutate(notification.id)}
                        className="text-xs"
                      >
                        Mark as Read
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {unreadCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllAsReadMutation.mutate()}
          disabled={markAllAsReadMutation.isPending}
          className="w-full"
        >
          Mark All as Read
        </Button>
      )}
    </div>
  );
}
