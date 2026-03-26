import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  Mail,
  ShieldCheck,
  Activity,
  ReceiptText,
  Users,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import etoileLogo from "../../../etoile.png";

type Screen = "login" | "otp" | "forgot" | "forgot_sent";

const QA_ITEMS = [
  {
    question: "Who gets access to the system?",
    answer: "Users are created internally by the administrator based on their hospital role.",
    icon: ShieldCheck,
  },
  {
    question: "What does the pharmacist follow here?",
    answer: "Inventory levels, receipt confirmations, stock movement, and expiry-sensitive operations.",
    icon: Activity,
  },
  {
    question: "How are suppliers and finance handled?",
    answer: "Suppliers submit invoice workflows after receipt confirmation, and finance tracks payment and budget control.",
    icon: ReceiptText,
  },
  {
    question: "Why is access role-based?",
    answer: "Because Polyclinique de l'Etoile needs each team to work in one secure dashboard with the right permissions only.",
    icon: Users,
  },
];

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "sindnepom@gmail.com" },
  { role: "Pharmacist", email: "blackhathackers2022@gmail.com" },
  { role: "Procurement", email: "bikomeye9@gmail.com" },
  { role: "Supplier", email: "nayihikisamuelnasri@gmail.com" },
  { role: "Accountant", email: "vianew440@gmail.com" },
];

export default function LoginPage() {
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_24%),linear-gradient(135deg,#f8fbff_0%,#eef5ff_42%,#f5f7fb_100%)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:36px_36px]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="flex flex-col justify-center">
            <div className="flex items-center gap-4">
              <div className="rounded-[28px] border border-white/70 bg-white/70 p-3 backdrop-blur-xl shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
                <img
                  src={etoileLogo}
                  alt="Polyclinique de l'Etoile logo"
                  className="h-16 w-16 rounded-2xl object-contain"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Polyclinique de l'Etoile</p>
                <p className="text-lg font-semibold text-slate-950">Supply Chain Management System</p>
              </div>
            </div>

            <div className="mt-8 max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Secure internal access for hospital operations.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Manage inventory, procurement, supplier coordination, and finance from one internal platform built for day-to-day hospital workflow.
              </p>
              <p className="mt-3 max-w-lg text-sm text-slate-500">
                Access is provided by the system administrator.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {QA_ITEMS.map((item, index) => (
                <div
                  key={index}
                  className="rounded-3xl border border-white/70 bg-white/58 p-5 backdrop-blur-xl shadow-[0_20px_55px_rgba(148,163,184,0.18)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="rounded-2xl bg-slate-900/95 p-2.5 text-white shadow-lg">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Q&A {index + 1}</span>
                  </div>
                  <p className="mt-5 text-sm font-semibold text-slate-900">{item.question}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/72 p-6 backdrop-blur-2xl shadow-[0_30px_90px_rgba(15,23,42,0.14)] sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Polyclinique de l'Etoile</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                    {screen === "login" && "Sign in"}
                    {screen === "otp" && "Verify access"}
                    {screen === "forgot" && "Reset password"}
                    {screen === "forgot_sent" && "Check your email"}
                  </h2>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-white p-2 shadow-lg shadow-sky-500/10">
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
                    <label className="text-sm font-medium text-slate-700">Email</label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="you@hospital.rw"
                      className="mt-1 h-11 border-white/70 bg-white/80"
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <div className="relative mt-1">
                      <Input
                        type={showPwd ? "text" : "password"}
                        value={form.password}
                        onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter your password"
                        className="h-11 border-white/70 bg-white/80 pr-10"
                        onKeyDown={e => e.key === "Enter" && handleLogin()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button onClick={() => setScreen("forgot")} className="text-xs font-medium text-sky-700 hover:text-sky-800">
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  <Button className="h-11 w-full gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-900" onClick={handleLogin} disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Continue to dashboard
                  </Button>

                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Account Provisioning</p>
                    <p className="mt-2 text-sm text-slate-700">
                      Self-registration is disabled. If you need access, contact your system administrator to create and assign your account.
                    </p>
                  </div>

                  <div className="border-t border-slate-200/70 pt-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-500">Quick Fill Demo Accounts</p>
                    <div className="flex flex-wrap gap-2">
                      {DEMO_ACCOUNTS.map(account => (
                        <button
                          key={account.role}
                          onClick={() => setForm(prev => ({ ...prev, email: account.email, password: "Password123!" }))}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-300 hover:text-sky-700"
                        >
                          {account.role}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {screen === "otp" && (
                <div className="space-y-4">
                  <button onClick={() => { setScreen("login"); setOtp(""); }} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-3 h-3" /> Back
                  </button>

                  <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-center">
                    <Mail className="mx-auto mb-2 w-8 h-8 text-sky-600" />
                    <p className="text-sm text-slate-700">Enter the 6-digit code sent to <strong>{form.email}</strong>.</p>
                  </div>

                  <Input
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="h-12 border-white/70 bg-white/80 text-center font-mono text-2xl tracking-[0.45em]"
                    maxLength={6}
                    onKeyDown={e => e.key === "Enter" && handleOtp()}
                    autoFocus
                  />

                  <Button className="h-11 w-full gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-900" onClick={handleOtp} disabled={isLoading || otp.length !== 6}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Verify code
                  </Button>
                </div>
              )}

              {screen === "forgot" && (
                <div className="space-y-4">
                  <button onClick={() => setScreen("login")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-3 h-3" /> Back
                  </button>

                  <p className="text-sm text-slate-600">Enter your work email and we will send a password reset link if the account exists.</p>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Email</label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="you@hospital.rw"
                      className="mt-1 h-11 border-white/70 bg-white/80"
                      onKeyDown={e => e.key === "Enter" && forgotMutation.mutate({ email: form.email })}
                    />
                  </div>

                  <Button className="h-11 w-full gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-900" onClick={() => forgotMutation.mutate({ email: form.email })} disabled={isLoading || !form.email}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Send reset link
                  </Button>
                </div>
              )}

              {screen === "forgot_sent" && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <Mail className="w-7 h-7 text-emerald-600" />
                  </div>
                  <p className="text-sm text-slate-700">
                    If <strong>{form.email}</strong> is registered, a reset link has been sent.
                  </p>
                  <p className="text-xs text-slate-500">
                    In development, you may also see the reset link in the server terminal output.
                  </p>
                  <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setScreen("login")}>
                    Back to sign in
                  </Button>
                </div>
              )}
            </div>
          </section>

          </div>

          <footer className="mt-10 rounded-[28px] border border-white/70 bg-white/60 p-6 backdrop-blur-xl shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Polyclinique de l'Etoile</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Polyclinique de l'Etoile, established in Kigali in 2014 and, is a private clinic offering high-quality outpatient care to local and international patients.
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-950">Clinic Services</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>Pediatrics</p>
                  <p>Gynecology & Obstetrics</p>
                  <p>Internal Medicine</p>
                  <p>Dental</p>
                  <p>General Medicine</p>
                  <p>Laboratory</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-950">Contact Info</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>KG 1 Ave, Kigali, Gasabo, Remera, Rukiri I, Ubumwe Rwanda.</p>
                  <p>polycliniquedeletoile2020@gmail.com</p>
                  <p>Free Call : 1301</p>
                  <p>Reception Call And Whatsapp :</p>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
