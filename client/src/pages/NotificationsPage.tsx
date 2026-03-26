import NotificationsCenter from "@/components/NotificationsCenter";
import NotificationPreferences from "@/components/NotificationPreferences";
import { Card } from "@/components/ui/card";
import { useState } from "react";

export default function NotificationsPage() {
  const [showPreferences, setShowPreferences] = useState(false);
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Notifications</h1><p className="text-muted-foreground mt-1">Stay updated on alerts and system events</p></div>
      {showPreferences && <NotificationPreferences onClose={() => setShowPreferences(false)} />}
      <Card className="p-5"><NotificationsCenter onPreferencesClick={() => setShowPreferences(true)} /></Card>
    </div>
  );
}
