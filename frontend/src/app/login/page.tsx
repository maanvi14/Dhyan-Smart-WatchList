"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { ArrowRight, Sparkles } from "lucide-react";
import { DhyanLogo } from "@/components/DhyanLogo";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [seedStockCount, setSeedStockCount] = useState<number>(9);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authApi.getDemoInfo()
      .then(res => {
        if (res.seedStockCount) setSeedStockCount(res.seedStockCount);
      })
      .catch(() => {});
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let res;
      if (isSignup) {
        res = await authApi.signup(email, password, name);
      } else {
        res = await authApi.login(email, password);
      }
      localStorage.setItem("dhyan_token", res.token);
      localStorage.setItem("dhyan_user", JSON.stringify(res.user));
      router.push("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.demoLogin();
      localStorage.setItem("dhyan_token", res.token);
      localStorage.setItem("dhyan_user", JSON.stringify(res.user));
      router.push("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Demo access failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <DhyanLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Dhyan Market Watchlist
          </h1>
          <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
            Every move tagged with verified evidence. Never predicts, never fabricates.
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-surface border border-surfaceBorder rounded-2xl p-6 shadow-2xl">
          
          {/* One-Tap Demo Access Button for Judges */}
          <div className="mb-6 pb-6 border-b border-surfaceBorder">
            <button
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full min-h-[48px] bg-gradient-to-r from-brand-500 to-teal-500 hover:from-brand-600 hover:to-teal-600 text-slate-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-brand-500/20 active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>{t("demo_login_title")}</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>
            <p className="text-[11px] text-center text-muted mt-2">
              Pre-loaded with {seedStockCount} stocks & change events across all 3 tiers.
            </p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl mb-4 font-mono">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-xs text-muted mb-1">{t("full_name")}</label>
                <input
                  type="text"
                  required
                  placeholder="Rahul Sharma"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-inputBg border border-surfaceBorder rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder-slate-500 focus:outline-none focus:border-brand-500 min-h-[44px]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-muted mb-1">{t("email_address")}</label>
              <input
                type="email"
                required
                placeholder="investor@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-inputBg border border-surfaceBorder rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder-slate-500 focus:outline-none focus:border-brand-500 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">{t("password")}</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-inputBg border border-surfaceBorder rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder-slate-500 focus:outline-none focus:border-brand-500 min-h-[44px]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] bg-surfaceElevated hover:bg-surface text-foreground font-semibold rounded-xl text-xs transition-colors border border-surfaceBorder"
            >
              {loading ? "Processing..." : isSignup ? t("create_account") : t("sign_in")}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-surfaceBorder text-center">
            <button
              onClick={() => setIsSignup(!isSignup)}
              className="text-xs text-brand-500 hover:underline"
            >
              {isSignup ? "Already have an account? Sign In" : "Need an account? Sign Up"}
            </button>
          </div>

        </div>

        {/* Footer Principles */}
        <div className="mt-6 text-center space-y-1">
          <div className="flex items-center justify-center space-x-3 text-[11px] text-muted">
            <span>🟢 Confirmed</span>
            <span>🟡 Unexplained</span>
            <span>🔴 Uncertain</span>
          </div>
          <p className="text-[10px] text-muted">
            Built for Groww Code 2026 Hackathon
          </p>
        </div>

      </div>
    </div>
  );
}
