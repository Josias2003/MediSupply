import { Card } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import { LoginModal } from "@/components/LoginModal";
import {
  Package,
  TrendingUp,
  Users,
  BarChart3,
  Lock,
  Zap,
  ArrowRight,
  Moon,
  Sun,
} from "lucide-react";
import { useState } from "react";

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const year = new Date().getFullYear();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_32%),radial-gradient(circle_at_center_right,_rgba(59,130,246,0.08),_transparent_40%)] bg-slate-50 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.06),_transparent_32%),radial-gradient(circle_at_center_right,_rgba(59,130,246,0.04),_transparent_40%)] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Navigation */}
      <nav className="border-b border-slate-200/70 bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2">
            <Package className="w-8 h-8 text-sky-600 dark:text-cyan-400" />
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
              MediSupply
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleTheme?.()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100/80 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-700 transition-colors dark:bg-sky-700 dark:hover:bg-sky-600"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container relative overflow-hidden py-20 md:py-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-8 top-16 h-36 w-36 rounded-3xl bg-sky-500/25 dark:bg-sky-500/15 blur-3xl" />
          <div className="absolute right-10 top-28 h-24 w-24 rounded-3xl border border-sky-400/40 dark:border-sky-500/30 bg-sky-200/15 dark:bg-sky-500/10 blur-sm" />
          <div className="absolute left-1/2 top-8 h-28 w-28 -translate-x-1/2 rounded-3xl bg-emerald-400/20 dark:bg-emerald-500/10 blur-2xl" />
          <div className="absolute right-1/4 bottom-10 h-32 w-32 rounded-3xl bg-slate-200/25 dark:bg-slate-700/20 blur-2xl" />
          <div className="absolute left-20 bottom-32 h-20 w-20 rounded-3xl border border-slate-300/50 dark:border-slate-600/40 bg-slate-100/30 dark:bg-slate-800/30 blur-sm" />
          <div className="absolute right-16 bottom-24 h-24 w-24 rounded-3xl bg-cyan-500/15 dark:bg-cyan-600/10 blur-2xl" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
              AI-Powered Medical Supply{" "}
              <span className="text-primary">Forecasting</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Streamline your pharmaceutical supply chain with intelligent
              inventory management, automated procurement, and predictive
              analytics.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="inline-flex items-center gap-2 px-8 py-3 bg-sky-600 text-white rounded-lg font-semibold shadow-lg shadow-sky-600/20 hover:bg-sky-700 transition-colors dark:bg-sky-700 dark:hover:bg-sky-600"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={scrollToFeatures}
              className="px-8 py-3 border border-slate-300 text-slate-800 rounded-lg font-semibold bg-white/90 hover:bg-slate-100 transition-colors dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to manage your pharmaceutical supply chain
            efficiently
          </p>
        </div>

        <div id="features" className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Package,
              title: "Inventory Management",
              description:
                "Real-time stock tracking, expiry alerts, and reorder automation",
            },
            {
              icon: TrendingUp,
              title: "AI Forecasting",
              description:
                "Predict demand with machine learning and historical data analysis",
            },
            {
              icon: Users,
              title: "Supplier Portal",
              description:
                "Seamless collaboration with suppliers and quotation management",
            },
            {
              icon: BarChart3,
              title: "Analytics & Reporting",
              description:
                "Comprehensive insights into procurement and financial metrics",
            },
            {
              icon: Lock,
              title: "Role-Based Access",
              description:
                "Secure multi-user system with granular permission controls",
            },
            {
              icon: Zap,
              title: "Automation",
              description:
                "Automated workflows for requisitions, approvals, and orders",
            },
          ].map((feature, idx) => (
            <Card key={idx} className="p-6 card-elegant border border-slate-200/70 bg-white/90 shadow-lg shadow-slate-200/50 transition-shadow hover:-translate-y-1 hover:shadow-xl dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-slate-950/40">
              <feature.icon className="w-12 h-12 text-sky-600 mb-4 dark:text-cyan-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* User Roles Section */}
      <section className="container py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Built for Your Role
          </h2>
          <p className="text-lg text-muted-foreground">
            Customized dashboards and features for each user type
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { role: "Admin", color: "bg-sky-100 text-sky-700" },
            { role: "Pharmacist", color: "bg-emerald-100 text-emerald-700" },
            { role: "Procurement", color: "bg-cyan-100 text-cyan-700" },
            { role: "Supplier", color: "bg-violet-100 text-violet-700" },
            { role: "Accountant", color: "bg-slate-100 text-slate-800" },
          ].map((item, idx) => (
            <Card key={idx} className="p-6 card-elegant border border-slate-200/70 bg-white/90 text-center transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-700/70 dark:bg-slate-900/80">
              <div className={`inline-block px-4 py-2 rounded-lg ${item.color} font-semibold mb-4`}>
                {item.role}
              </div>
              <p className="text-sm text-muted-foreground">
                Specialized dashboard and permissions
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-20">
        <Card className="p-12 card-elegant bg-gradient-to-r from-sky-50 via-cyan-50 to-emerald-50 text-center dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Transform Your Supply Chain?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join leading pharmaceutical organizations in optimizing their supply
            chain management with AI-powered insights and automation.
          </p>
          <button
            type="button"
            onClick={() => setIsLoginModalOpen(true)}
            className="inline-flex items-center gap-2 px-8 py-3 bg-sky-600 text-white rounded-lg font-semibold shadow-lg shadow-sky-600/20 hover:bg-sky-700 transition-colors dark:bg-sky-700 dark:hover:bg-sky-600"
          >
            Get Started <ArrowRight className="w-5 h-5" />
          </button>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 bg-slate-950 text-slate-300 mt-20">
        <div className="container py-12">
          <div className="flex justify-center mb-8">
            <div className="text-center">
              <div className="flex items-center gap-2 mb-4 justify-center">
                <Package className="w-6 h-6 text-primary" />
                <span className="font-bold text-foreground">MediSupply</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-sm">
                AI-powered pharmaceutical supply chain management
              </p>
            </div>
          </div>
          <div className="border-t border-slate-700/50 pt-6 text-center text-sm text-slate-400">
            <p>
              &copy; {year} Polyclinique de l'etoile. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}
