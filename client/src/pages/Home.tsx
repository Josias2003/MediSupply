import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Package,
  TrendingUp,
  Users,
  BarChart3,
  Lock,
  Zap,
  ArrowRight,
} from "lucide-react";
import { getLoginUrl } from "@/const";

export default function Home() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Package className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold text-foreground">
              MediSupply
            </span>
          </div>
          <a
            href={getLoginUrl()}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Sign In
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center space-y-8">
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
            <a
              href={getLoginUrl()}
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </a>
            <button className="px-8 py-3 border border-border text-foreground rounded-lg font-semibold hover:bg-muted transition-colors">
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            <Card key={idx} className="p-6 card-elegant hover:shadow-elevated transition-shadow">
              <feature.icon className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">
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
            { role: "Admin", color: "bg-primary/10 text-primary" },
            { role: "Pharmacist", color: "bg-secondary/10 text-secondary" },
            { role: "Procurement", color: "bg-accent/10 text-accent" },
            { role: "Supplier", color: "bg-blue-100 text-blue-700" },
            { role: "Accountant", color: "bg-emerald-100 text-emerald-700" },
          ].map((item, idx) => (
            <Card key={idx} className={`p-6 card-elegant text-center`}>
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
        <Card className="p-12 card-elegant bg-gradient-to-r from-primary/5 to-secondary/5 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Transform Your Supply Chain?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join leading pharmaceutical organizations in optimizing their supply
            chain management with AI-powered insights and automation.
          </p>
          <a
            href={getLoginUrl()}
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </a>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 mt-20">
        <div className="container py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-6 h-6 text-primary" />
                <span className="font-bold text-foreground">MediSupply</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered pharmaceutical supply chain management
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Security
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Compliance
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>
              &copy; 2026 MediSupply. All rights reserved. | Pharmaceutical
              Supply Chain Management Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
