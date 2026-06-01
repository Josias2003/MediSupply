import React, { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface NotificationPreferencesProps {
  onClose?: () => void;
}

// Define which notifications each role can see
const ROLE_NOTIFICATION_ACCESS: Record<string, string[]> = {
  pharmacist: ['lowStockAlerts', 'expiryWarnings', 'pendingApprovals', 'budgetAlerts'],
  procurement_officer: ['pendingApprovals', 'orderUpdates', 'deliveryAlerts', 'budgetAlerts'],
  supplier: ['orderUpdates', 'deliveryAlerts'],
  accountant: ['budgetAlerts', 'orderUpdates'],
  admin: ['lowStockAlerts', 'expiryWarnings', 'pendingApprovals', 'orderUpdates', 'deliveryAlerts', 'budgetAlerts'],
};

const NOTIFICATION_CONFIG = {
  lowStockAlerts: {
    label: 'Low Stock Alerts',
    description: 'Notify when inventory falls below reorder point',
  },
  expiryWarnings: {
    label: 'Expiry Warnings',
    description: 'Alert for items approaching expiration',
  },
  pendingApprovals: {
    label: 'Pending Approvals',
    description: 'Notify about pending requisitions and orders',
  },
  orderUpdates: {
    label: 'Order Updates',
    description: 'Updates on purchase order status changes',
  },
  deliveryAlerts: {
    label: 'Delivery Alerts',
    description: 'Notify about late or delayed deliveries',
  },
  budgetAlerts: {
    label: 'Budget Alerts',
    description: 'Alert when spending approaches budget limits',
  },
};

export default function NotificationPreferences({ onClose }: NotificationPreferencesProps) {
  const { user } = useAuth();
  const { data: preferences, isLoading } = trpc.notificationPreferences.get.useQuery();
  const updateMutation = trpc.notificationPreferences.update.useMutation();

  const [settings, setSettings] = useState({
    lowStockAlerts: preferences?.lowStockAlerts ?? true,
    expiryWarnings: preferences?.expiryWarnings ?? true,
    pendingApprovals: preferences?.pendingApprovals ?? true,
    orderUpdates: preferences?.orderUpdates ?? true,
    deliveryAlerts: preferences?.deliveryAlerts ?? true,
    budgetAlerts: preferences?.budgetAlerts ?? true,
    emailNotifications: preferences?.emailNotifications ?? false,
    frequency: preferences?.frequency ?? 'immediate',
  });

  // Get notifications visible to this user's role
  const visibleNotifications = ROLE_NOTIFICATION_ACCESS[user?.role || 'admin'] || [];

  const handleToggle = (key: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof settings],
    }));
  };

  const handleFrequencyChange = (value: string) => {
    setSettings(prev => ({
      ...prev,
      frequency: value,
    }));
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(settings as any);
      toast.success('Notification preferences updated successfully');
      onClose?.();
    } catch (error) {
      toast.error('Failed to update preferences');
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading preferences...</div>;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md rounded-lg shadow-lg">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">Notification Preferences</h2>

          <div className="space-y-4 mb-6">
            {/* Alert Type Toggles */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-foreground">Alert Types</h3>

              {visibleNotifications.map((notifKey) => (
                <div key={notifKey} className="flex items-center gap-3 p-3 bg-muted rounded">
                  <Checkbox
                    checked={settings[notifKey as keyof typeof settings] as boolean}
                    onCheckedChange={() => handleToggle(notifKey)}
                    id={notifKey}
                  />
                  <label htmlFor={notifKey} className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm">{NOTIFICATION_CONFIG[notifKey as keyof typeof NOTIFICATION_CONFIG]?.label}</div>
                    <div className="text-xs text-muted-foreground">{NOTIFICATION_CONFIG[notifKey as keyof typeof NOTIFICATION_CONFIG]?.description}</div>
                  </label>
                </div>
              ))}
            </div>

            {/* Notification Frequency */}
            <div className="pt-4 border-t">
              <h3 className="font-medium text-sm text-foreground mb-3">Notification Frequency</h3>
              <Select value={settings.frequency} onValueChange={handleFrequencyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="daily">Daily Digest</SelectItem>
                  <SelectItem value="weekly">Weekly Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Email Notifications */}
            <div className="pt-4 border-t">
              <div className="flex items-center gap-3 p-3 bg-primary/10 rounded border border-primary/20">
                <Checkbox
                  checked={settings.emailNotifications}
                  onCheckedChange={() => handleToggle('emailNotifications')}
                  id="email"
                />
                <label htmlFor="email" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">Email Notifications</div>
                  <div className="text-xs text-muted-foreground">Receive critical alerts via email</div>
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex-1"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
