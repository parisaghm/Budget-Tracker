import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  ChevronDown,
  CreditCard,
  Home,
  PiggyBank,
  ReceiptText,
  Settings,
  User,
} from "lucide-react";
import { MonthSelector } from "@/components/MonthSelector";
import { InstallAppButton } from "@/components/InstallAppButton";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/budget", label: "Budget", icon: PiggyBank },
  { to: "/bills", label: "Bills", icon: CreditCard },
  { to: "/weekly-review", label: "Review", icon: BarChart3 },
  { to: "/expenses", label: "Expenses", icon: ReceiptText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

/** Matches `main` shell containers so header and page content share the same horizontal grid. */
export const appShellContainerClass = "container px-5 sm:px-7 lg:px-9";

/** Default content width for primary app pages (Home, Budget, etc.). */
export const appShellMaxWidthClass = "max-w-8xl";

type ContentMaxWidth = "max-w-8xl" | "max-w-7xl" | "max-w-6xl" | "max-w-2xl";

interface AppShellHeaderProps {
  title?: string;
  subtitle?: string;
  currency?: string;
  currentMonth: string;
  onMonthChange: (month: string) => void;
  trailing?: ReactNode;
  /** Must match the `max-w-*` on the page’s `<main>` for edge alignment. */
  contentMaxWidth?: ContentMaxWidth;
}

export function AppShellHeader({
  title = "Sova Budget",
  subtitle = "Plan calmly. Spend confidently.",
  currency,
  currentMonth,
  onMonthChange,
  trailing,
  contentMaxWidth = appShellMaxWidthClass,
}: AppShellHeaderProps) {
  const location = useLocation();
  const isBrandTitle = title === "Sova Budget";

  return (
    <header className="pb-1 pt-4 sm:pb-1.5 sm:pt-5 lg:pt-6">
      <div className={cn(appShellContainerClass, contentMaxWidth)}>
        <div className="shell-header-card">
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <img
                src="/icons/wallet.svg"
                alt=""
                className="h-11 w-11 shrink-0 rounded-[0.85rem] sm:h-12 sm:w-12"
                width={48}
                height={48}
                aria-hidden
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className={cn(
                      "leading-snug text-[#1A1411]",
                      isBrandTitle
                        ? "font-display text-lg font-medium tracking-[-0.02em] sm:text-[1.35rem]"
                        : "text-lg font-medium sm:text-xl",
                    )}
                  >
                    {title}
                  </h1>
                  {currency ? <span className="shell-currency-pill">{currency}</span> : null}
                </div>
                <p className="mt-0.5 hidden text-xs font-normal leading-relaxed text-[#746A5D] sm:block">
                  {subtitle}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
              {trailing}
              <div className="hidden sm:block">
                <InstallAppButton />
              </div>
              <MonthSelector currentMonth={currentMonth} onMonthChange={onMonthChange} />
              <Link
                to="/settings"
                className="shell-user-btn touch-hit"
                aria-label="Account and settings"
              >
                <User className="h-4 w-4" aria-hidden />
                <ChevronDown className="ml-0.5 hidden h-3 w-3 opacity-60 sm:inline" aria-hidden />
              </Link>
            </div>
          </div>

          <nav
            className="mt-4 hidden flex-wrap items-center gap-1 border-t border-[#E8DFCC] pt-3.5 md:flex"
            aria-label="Main"
          >
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "shell-nav-link touch-hit",
                    active && "shell-nav-link-active",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
