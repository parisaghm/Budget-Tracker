import { BarChart3, CreditCard, Home, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/bills", label: "Bills", icon: CreditCard },
  { to: "/weekly-review", label: "Review", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 shadow-[0_-8px_32px_-12px_hsl(var(--foreground)/0.06)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 pt-2">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "touch-hit flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] font-semibold leading-tight tracking-wide transition-colors",
                active
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.25px]")} aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
