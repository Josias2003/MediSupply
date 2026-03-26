import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface NotificationPreferencesProps {
  onClose?: () => void;
}

export default function NotificationPreferences({ onClose }: NotificationPreferencesProps) {
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
      <Card className="w-full max-w-md bg-white rounded-lg shadow-lg">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">Notification Preferences</h2>

          <div className="space-y-4 mb-6">
            {/* Alert Type Toggles */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-gray-700">Alert Types</h3>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Checkbox
                  checked={settings.lowStockAlerts}
                  onCheckedChange={() => handleToggle('lowStockAlerts')}
                  id="lowStock"
                />
                <label htmlFor="lowStock" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">Low Stock Alerts</div>
                  <div className="text-xs text-gray-500">Notify when inventory falls below reorder point</div>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Checkbox
                  checked={settings.expiryWarnings}
                  onCheckedChange={() => handleToggle('expiryWarnings')}
                  id="expiry"
                />
                <label htmlFor="expiry" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">Expiry Warnings</div>
                  <div className="text-xs text-gray-500">Alert for items approaching expiration</div>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Checkbox
                  checked={settings.pendingApprovals}
                  onCheckedChange={() => handleToggle('pendingApprovals')}
                  id="approvals"
                />
                <label htmlFor="approvals" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">Pending Approvals</div>
                  <div className="text-xs text-gray-500">Notify about pending requisitions and orders</div>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Checkbox
                  checked={settings.orderUpdates}
                  onCheckedChange={() => handleToggle('orderUpdates')}
                  id="orders"
                />
                <label htmlFor="orders" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">Order Updates</div>
                  <div className="text-xs text-gray-500">Updates on purchase order status changes</div>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Checkbox
                  checked={settings.deliveryAlerts}
                  onCheckedChange={() => handleToggle('deliveryAlerts')}
                  id="delivery"
                />
                <label htmlFor="delivery" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">Delivery Alerts</div>
                  <div className="text-xs text-gray-500">Notify about late or delayed deliveries</div>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Checkbox
                  checked={settings.budgetAlerts}
                  onCheckedChange={() => handleToggle('budgetAlerts')}
                  id="budget"
                />
                <label htmlFor="budget" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">Budget Alerts</div>
                  <div className="text-xs text-gray-500">Alert when spending approaches budget limits</div>
                </label>
              </div>
            </div>

            {/* Notification Frequency */}
            <div className="pt-4 border-t">
              <h3 className="font-medium text-sm text-gray-700 mb-3">Notification Frequency</h3>
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
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded border border-blue-200">
                <Checkbox
                  checked={settings.emailNotifications}
                  onCheckedChange={() => handleToggle('emailNotifications')}
                  id="email"
                />
                <label htmlFor="email" className="flex-1 cursor-pointer">
                  <div className="font-medium text-sm">Email Notifications</div>
                  <div className="text-xs text-gray-500">Receive critical alerts via email</div>
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
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
