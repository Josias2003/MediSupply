import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  const { data: tokenCheck, isLoading: checking } = trpc.authExt.validateResetToken.useQuery(
    { token },
    { enabled: Boolean(token), retry: false }
  );

  const resetMutation = trpc.authExt.resetPassword.useMutation({
    onSuccess: () => setDone(true),
    onError: e => toast.error(e.message),
  });

  function handleReset() {
    if (pwd.length < 8) return toast.error("Password must be at least 8 characters");
    if (pwd !== pwd2) return toast.error("Passwords do not match");
    resetMutation.mutate({ token, newPassword: pwd });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-3">
            <Package className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">MediSupply Rwanda</h1>
        </div>
        <Card className="p-6 shadow-lg border-0">
          {checking && <div className="flex justify-center py-8"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>}

          {!checking && !tokenCheck?.valid && (
            <div className="text-center py-4 space-y-3">
              <p className="text-red-600 font-medium">This reset link is invalid or has expired.</p>
              <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>Back to Login</Button>
            </div>
          )}

          {!checking && tokenCheck?.valid && !done && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Set New Password</h2>
              <div className="relative">
                <label className="text-sm font-medium text-gray-700">New Password</label>
                <div className="relative mt-1">
                  <Input type={show ? "text" : "password"} value={pwd} onChange={e => setPwd(e.target.value)}
                    placeholder="Min. 8 characters" className="pr-10" />
                  <button type="button" onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                <Input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)}
                  placeholder="Repeat password" className="mt-1"
                  onKeyDown={e => e.key === "Enter" && handleReset()} />
              </div>
              <Button className="w-full" onClick={handleReset} disabled={resetMutation.isPending}>
                {resetMutation.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                Set New Password
              </Button>
            </div>
          )}

          {done && (
            <div className="text-center py-4 space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h2 className="font-semibold text-lg">Password Reset!</h2>
              <p className="text-sm text-gray-500">Your password has been updated. You can now sign in.</p>
              <Button className="w-full" onClick={() => setLocation("/")}>Sign In</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
