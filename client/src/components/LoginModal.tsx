import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  Mail,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import etoileLogo from "../../../etoile.png";

type Screen = "login" | "otp" | "forgot" | "forgot_sent";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const utils = trpc.useUtils();
  const [screen, setScreen] = useState<Screen>("login");
  const [showPwd, setShowPwd] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [otp, setOtp] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      if (data.requires2fa) {
        setPendingUserId(data.userId ?? null);
        setScreen("otp");
        toast.info("A 6-digit code has been sent to your email.");
      } else {
        await utils.auth.me.invalidate();
        window.location.assign("/");
      }
    },
    onError: e => toast.error(e.message),
  });

  const verifyOtp = trpc.authExt.verifyOtp.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      window.location.assign("/");
    },
    onError: e => toast.error(e.message),
  });

  const forgotMutation = trpc.authExt.forgotPassword.useMutation({
    onSuccess: () => setScreen("forgot_sent"),
    onError: e => toast.error(e.message),
  });

  function handleLogin() {
    if (!form.email || !form.password) return toast.error("Enter email and password");
    loginMutation.mutate({ email: form.email, password: form.password });
  }

  function handleOtp() {
    if (otp.length !== 6) return toast.error("Enter the 6-digit code");
    if (!pendingUserId) return;
    verifyOtp.mutate({ userId: pendingUserId, code: otp });
  }

  const isLoading = loginMutation.isPending || verifyOtp.isPending || forgotMutation.isPending;

  const handleClose = () => {
    setScreen("login");
    setOtp("");
    setShowPwd(false);
    setForm({ email: "", password: "" });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative max-w-md w-full rounded-[32px] border border-white/70 bg-white/95 dark:border-slate-700/70 dark:bg-slate-900/95 p-6 backdrop-blur-2xl shadow-[0_30px_90px_rgba(15,23,42,0.14)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.5)] sm:p-8">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Polyclinique de l'Etoile</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-100">
              {screen === "login" && "Sign in"}
              {screen === "otp" && "Verify access"}
              {screen === "forgot" && "Reset password"}
              {screen === "forgot_sent" && "Check your email"}
            </h2>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-white dark:border-sky-900 dark:bg-slate-800 p-2 shadow-lg shadow-sky-500/10 dark:shadow-sky-950/30">
            <img
              src={etoileLogo}
              alt="Polyclinique de l'Etoile logo"
              className="h-8 w-8 object-contain"
            />
          </div>
        </div>

        {screen === "login" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="you@hospital.rw"
                className="mt-1 h-11 border-white/70 bg-white/80 dark:border-slate-700/70 dark:bg-slate-800/80"
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
              <div className="relative mt-1">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter your password"
                  className="h-11 border-white/70 bg-white/80 dark:border-slate-700/70 dark:bg-slate-800/80 pr-10"
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <button onClick={() => setScreen("forgot")} className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300">
                  Forgot password?
                </button>
              </div>
            </div>

            <Button className="h-11 w-full gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600" onClick={handleLogin} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Continue to dashboard
            </Button>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Account Provisioning</p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                Self-registration is disabled. If you need access, contact your system administrator to create and assign your account.
              </p>
            </div>
          </div>
        )}

        {screen === "otp" && (
          <div className="space-y-4">
            <button onClick={() => { setScreen("login"); setOtp(""); }} className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>

            <div className="rounded-2xl border border-sky-100 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/30 p-4 text-center">
              <Mail className="mx-auto mb-2 w-8 h-8 text-sky-600 dark:text-sky-400" />
              <p className="text-sm text-slate-700 dark:text-slate-300">Enter the 6-digit code sent to <strong>{form.email}</strong>.</p>
            </div>

            <Input
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="h-12 border-white/70 bg-white/80 dark:border-slate-700/70 dark:bg-slate-800/80 text-center font-mono text-2xl tracking-[0.45em]"
              maxLength={6}
              onKeyDown={e => e.key === "Enter" && handleOtp()}
              autoFocus
            />

            <Button className="h-11 w-full gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600" onClick={handleOtp} disabled={isLoading || otp.length !== 6}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Verify code
            </Button>
          </div>
        )}

        {screen === "forgot" && (
          <div className="space-y-4">
            <button onClick={() => setScreen("login")} className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>

            <p className="text-sm text-slate-600 dark:text-slate-400">Enter your work email and we will send a password reset link if the account exists.</p>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="you@hospital.rw"
                className="mt-1 h-11 border-white/70 bg-white/80 dark:border-slate-700/70 dark:bg-slate-800/80"
                onKeyDown={e => e.key === "Enter" && forgotMutation.mutate({ email: form.email })}
              />
            </div>

            <Button className="h-11 w-full gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600" onClick={() => forgotMutation.mutate({ email: form.email })} disabled={isLoading || !form.email}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Send reset link
            </Button>
          </div>
        )}

        {screen === "forgot_sent" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <div className="text-2xl">✓</div>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">Check your email</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">We've sent a password reset link to <strong>{form.email}</strong>.</p>
            </div>
            <Button className="h-11 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600" onClick={() => { setScreen("login"); setForm({ email: "", password: "" }); }}>
              Back to sign in
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
