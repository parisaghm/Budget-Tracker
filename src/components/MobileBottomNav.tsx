import { BarChart3, CreditCard, Home, PiggyBank, ReceiptText, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useSyncMobileBottomInset } from "@/hooks/useSyncMobileBottomInset";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/budget", label: "Budget", icon: PiggyBank },
  { to: "/bills", label: "Bills", icon: CreditCard },
  { to: "/cycle", label: "Cycles", icon: BarChart3 },
  { to: "/expenses", label: "Expenses", icon: ReceiptText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function MobileBottomNav() {
  const location = useLocation();
  useSyncMobileBottomInset();

  return (
    <>
      <div aria-hidden className="mobile-bottom-spacer max-[640px]:block hidden" />
      <nav
        data-mobile-bottom-nav
        className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 hidden border-t border-border bg-popover/95 backdrop-blur-md max-[640px]:block"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
        aria-label="Primary"
      >
        <div className="mobile-bottom-nav-inner mx-auto grid max-w-lg grid-cols-6 gap-0 px-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "touch-hit relative flex h-full flex-col items-center justify-center gap-1 px-0.5 py-1.5 text-[10px] font-medium leading-none transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                )}
              >
                <Icon
                  className={cn("h-5 w-5 shrink-0", active && "stroke-[2.25px]")}
                  aria-hidden
                />
                <span className="max-w-full truncate px-0.5">{label}</span>
                {active ? (
                  <span
                    className="absolute bottom-1.5 h-0.5 w-4 rounded-full bg-primary"
                    aria-hidden
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
