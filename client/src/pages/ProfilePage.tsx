import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { getRoleColors } from "@/utils/roleColors";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  User, Mail, Shield, Eye, EyeOff, Loader2, CheckCircle,
  Bell, Lock, KeyRound, Smartphone, Moon, Sun, Palette
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "System Administrator",
  pharmacist: "Pharmacist",
  procurement_officer: "Procurement Officer",
  supplier: "Supplier",
  accountant: "Accountant",
};

export default function ProfilePage() {
  const { theme, toggleTheme } = useTheme();
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: notifPrefs } = trpc.notificationPreferences.get.useQuery();
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => { toast.success("Profile updated"); utils.auth.me.invalidate(); },
    onError: e => toast.error(e.message),
  });

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => { toast.success("Password changed successfully"); setPwdForm({ current: "", next: "", confirm: "" }); setShowPwd(false); },
    onError: e => toast.error(e.message),
  });

  const toggle2fa = trpc.authExt.toggle2fa.useMutation({
    onSuccess: (d) => { toast.success(d.twoFactorEnabled ? "Two-factor authentication enabled" : "Two-factor authentication disabled"); utils.auth.me.invalidate(); },
    onError: e => toast.error(e.message),
  });

  const updateNotifPrefs = trpc.notificationPreferences.update.useMutation({
    onSuccess: () => { toast.success("Notification preferences saved"); utils.notificationPreferences.get.invalidate(); },
    onError: e => toast.error(e.message),
  });

  const [profileForm, setProfileForm] = useState({ name: me?.name || "", email: me?.email || "" });
  const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showConfirm2fa, setShowConfirm2fa] = useState(false);
  const [tab, setTab] = useState<"profile" | "preferences">("profile");
  const [prefTab, setPrefTab] = useState<"notifications" | "security" | "theme">("notifications");

  // Sync form with loaded data
  const nameVal = profileForm.name || me?.name || "";
  const emailVal = profileForm.email || me?.email || "";

  function handleSaveProfile() {
    if (!nameVal.trim()) return toast.error("Name cannot be empty");
    if (!emailVal.includes("@")) return toast.error("Enter a valid email");
    updateProfile.mutate({ name: nameVal, email: emailVal });
  }

  function handleChangePassword() {
    if (!pwdForm.current) return toast.error("Enter your current password");
    if (pwdForm.next.length < 8) return toast.error("New password must be at least 8 characters");
    if (pwdForm.next !== pwdForm.confirm) return toast.error("Passwords do not match");
    changePassword.mutate({ currentPassword: pwdForm.current, newPassword: pwdForm.next });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account, security, and notification preferences</p>
      </div>

      {/* User identity card */}
      <Card className="p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <User className="w-7 h-7 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg truncate">{me?.name || "—"}</p>
          <p className="text-sm text-muted-foreground truncate">{me?.email}</p>
        </div>
        <Badge className={`${getRoleColors(me?.role || "").bg} ${getRoleColors(me?.role || "").text} shrink-0`}>
          {ROLE_LABELS[me?.role || ""] || me?.role}
        </Badge>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["profile", "preferences"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setPrefTab("notifications"); }}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Preferences Sub-tabs */}
      {tab === "preferences" && (
        <div className="flex gap-1 border-b bg-muted/30 -mx-6 px-6 mb-4">
          {(["notifications", "security", "theme"] as const).map(t => (
            <button key={t} onClick={() => setPrefTab(t)}
              className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${prefTab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* ── PROFILE TAB ── */}
      {tab === "profile" && (
        <Card className="p-6 space-y-5">
          <h2 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" />Personal Information</h2>

          <div>
            <label className="text-sm font-medium">Full Name</label>
            <Input
              value={nameVal}
              onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Your full name"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Email Address</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                value={emailVal}
                onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@hospital.rw"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Role</label>
            <div className="mt-1 flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/30">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{ROLE_LABELS[me?.role || ""] || me?.role}</span>
              <span className="text-xs text-muted-foreground ml-1">(contact an admin to change)</span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </Card>
      )}

      {/* ── PREFERENCES TAB WITH SUB-TABS ── */}
      {tab === "preferences" && (
        <>
          {/* NOTIFICATIONS SUB-TAB */}
          {prefTab === "notifications" && (
            <Card className="p-6 space-y-5">
              <h2 className="font-semibold flex items-center gap-2"><Bell className="w-4 h-4" />Notification Preferences</h2>
              <p className="text-sm text-muted-foreground">Choose which alerts you receive in-app and by email.</p>

              <div className="space-y-3">
                {[
                  { key: "lowStockAlerts", label: "Low Stock Alerts", desc: "When inventory falls below reorder point" },
                  { key: "expiryWarnings", label: "Expiry Warnings", desc: "When items are expiring within 30 days" },
                  { key: "approvalAlerts", label: "Approval Notifications", desc: "Pending requisition approvals and decisions" },
                  { key: "orderUpdates", label: "Order Updates", desc: "Purchase order status changes" },
                  { key: "budgetAlerts", label: "Budget Alerts", desc: "When departments approach budget limits" },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-start justify-between gap-4 py-3 border-b last:border-0 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      className="w-4 h-4 mt-0.5 accent-primary"
                      checked={notifPrefs?.[key as keyof typeof notifPrefs] as boolean ?? true}
                      onChange={e => updateNotifPrefs.mutate({ [key]: e.target.checked })}
                    />
                  </label>
                ))}

                <div className="pt-2">
                  <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">📧 Email Notifications</p>
                      <p className="text-xs text-muted-foreground">Receive important alerts at {me?.email}</p>
                    </div>
                    <input
                      type="checkbox"
                      className="w-4 h-4 mt-0.5 accent-primary"
                      checked={notifPrefs?.emailNotifications ?? true}
                      onChange={e => updateNotifPrefs.mutate({ emailNotifications: e.target.checked })}
                    />
                  </label>
                </div>
              </div>
            </Card>
          )}

          {/* SECURITY SUB-TAB */}
          {prefTab === "security" && (
            <div className="space-y-4">
              {/* Change Password */}
              <Card className="p-6 space-y-4">
                <h2 className="font-semibold flex items-center gap-2"><Lock className="w-4 h-4" />Change Password</h2>

                <div>
                  <label className="text-sm font-medium">Current Password</label>
                  <div className="relative mt-1">
                    <Input
                      type={showCurrent ? "text" : "password"}
                      value={pwdForm.current}
                      onChange={e => setPwdForm(p => ({ ...p, current: e.target.value }))}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">New Password</label>
                  <div className="relative mt-1">
                    <Input
                      type={showPwd ? "text" : "password"}
                      value={pwdForm.next}
                      onChange={e => setPwdForm(p => ({ ...p, next: e.target.value }))}
                      placeholder="Min. 8 characters"
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {pwdForm.next.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {[8, 12, 16].map(len => (
                        <div key={len} className={`h-1 flex-1 rounded-full ${pwdForm.next.length >= len ? "bg-status-success-bg" : "bg-muted"}`} />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Confirm New Password</label>
                  <Input
                    type="password"
                    value={pwdForm.confirm}
                    onChange={e => setPwdForm(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="Repeat new password"
                    className="mt-1"
                  />
                  {pwdForm.confirm && pwdForm.next && (
                    <p className={`text-xs mt-1 ${pwdForm.next === pwdForm.confirm ? "text-status-success-text" : "text-destructive"}`}>
                      {pwdForm.next === pwdForm.confirm ? "✓ Passwords match" : "✗ Passwords do not match"}
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleChangePassword} disabled={changePassword.isPending}>
                    {changePassword.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                    Update Password
                  </Button>
                </div>
              </Card>

              {/* Two-Factor Authentication */}
              <Card className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold">Two-Factor Authentication</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        When enabled, you'll receive a 6-digit code by email each time you sign in.
                      </p>
                      <Badge className={`mt-2 ${me?.twoFactorEnabled ? "bg-status-success-bg text-status-success-text" : "bg-muted text-muted-foreground"}`}>
                        {me?.twoFactorEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant={me?.twoFactorEnabled ? "destructive" : "default"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => setShowConfirm2fa(true)}
                    disabled={toggle2fa.isPending}
                  >
                    {toggle2fa.isPending ? <Loader2 className="animate-spin w-3 h-3 mr-1" /> : null}
                    {me?.twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* THEME SUB-TAB */}
          {prefTab === "theme" && (
            <Card className="p-6 space-y-5">
              <h2 className="font-semibold flex items-center gap-2"><Palette className="w-4 h-4" />Theme Preferences</h2>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => theme !== "light" && toggleTheme?.()}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-3 ${
                    theme === "light" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                  }`}
                >
                  <Sun className="w-6 h-6" />
                  <div className="text-sm">
                    <p className="font-medium">Light Mode</p>
                    <p className="text-xs text-muted-foreground">Bright and clear</p>
                  </div>
                  {theme === "light" && <CheckCircle className="w-4 h-4 text-primary mt-1" />}
                </button>

                <button
                  onClick={() => theme !== "dark" && toggleTheme?.()}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-3 ${
                    theme === "dark" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                  }`}
                >
                  <Moon className="w-6 h-6" />
                  <div className="text-sm">
                    <p className="font-medium">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">Easy on the eyes</p>
                  </div>
                  {theme === "dark" && <CheckCircle className="w-4 h-4 text-primary mt-1" />}
                </button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* 2FA Confirm Dialog */}
      <Dialog open={showConfirm2fa} onOpenChange={setShowConfirm2fa}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{me?.twoFactorEnabled ? "Disable" : "Enable"} Two-Factor Authentication</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {me?.twoFactorEnabled
                ? "Disabling 2FA will make your account less secure. You will no longer receive a verification code when signing in."
                : "Enabling 2FA adds an extra layer of security. You will receive a 6-digit code at your email each time you sign in."}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirm2fa(false)}>Cancel</Button>
              <Button
                className="flex-1"
                variant={me?.twoFactorEnabled ? "destructive" : "default"}
                disabled={toggle2fa.isPending}
                onClick={() => {
                  toggle2fa.mutate({ enable: !me?.twoFactorEnabled });
                  setShowConfirm2fa(false);
                }}
              >
                {me?.twoFactorEnabled ? "Yes, Disable 2FA" : "Yes, Enable 2FA"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
