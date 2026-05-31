import { BarChart3, CreditCard, Home, PiggyBank, ReceiptText, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/budget", label: "Budget", icon: PiggyBank },
  { to: "/bills", label: "Bills", icon: CreditCard },
  { to: "/weekly-review", label: "Review", icon: BarChart3 },
  { to: "/expenses", label: "Expenses", icon: ReceiptText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8DFCC] bg-[#FFFDF8]/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      <div className="mx-auto grid max-w-lg grid-cols-6 gap-0 px-1 pt-2">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "touch-hit relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 text-[9px] font-medium leading-tight transition-colors",
                active
                  ? "bg-[#FFFDF8] text-[#6E4E91] shadow-sm"
                  : "text-[#746A5D] hover:bg-[#EFE7F7]/60 hover:text-[#4A3463]",
              )}
            >
              <Icon className={cn("h-[1.125rem] w-[1.125rem] shrink-0", active && "stroke-[2.25px]")} aria-hidden />
              <span className="max-w-full truncate px-0.5">{label}</span>
              {active ? (
                <span
                  className="absolute bottom-1 h-0.5 w-3 rounded-full bg-[#6E4E91]"
                  aria-hidden
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
