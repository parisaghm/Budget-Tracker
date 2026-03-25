import type { ReactNode } from "react";
import { Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container max-w-6xl px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Wallet className="h-5 w-5 text-black" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Budget Tracker</h1>
              <p className="text-[11px] text-muted-foreground tracking-wide uppercase">
                Secure account access
              </p>
            </div>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="container max-w-md px-4 py-12">
        <div className="card-elevated p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          {footer ? <div className="text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
