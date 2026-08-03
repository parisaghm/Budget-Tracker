import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
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
import { AppPageContainer } from "@/components/AppPageContainer";
import type { IncomeCycle } from "@/types/incomeCycle";
import type { BudgetCycle } from "@/types/budgetCycle";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/budget", label: "Budget", icon: PiggyBank },
  { to: "/bills", label: "Bills", icon: CreditCard },
  { to: "/cycle", label: "Cycles", icon: BarChart3 },
  { to: "/expenses", label: "Expenses", icon: ReceiptText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

interface AppShellHeaderProps {
  title?: string;
  subtitle?: string;
  currency?: string;
  currentMonth: string;
  onMonthChange: (month: string) => void;
  incomeCycle?: IncomeCycle | null;
  /** Frozen budget cycle for the selected month; the month label uses its exact dates. */
  selectedCycle?: BudgetCycle | null;
  trailing?: ReactNode;
  /** Budget page mobile layout: flat header, bell, stacked month selector. */
  mobileLayout?: "default" | "budget";
}

export function AppShellHeader({
  title = "Sova Budget",
  subtitle = "Plan calmly. Spend confidently.",
  currency,
  currentMonth,
  onMonthChange,
  incomeCycle = null,
  selectedCycle = null,
  trailing,
  mobileLayout = "default",
}: AppShellHeaderProps) {
  const location = useLocation();
  const isBrandTitle = title === "Sova Budget";
  const isBudgetMobile = mobileLayout === "budget";

  return (
    <header className="pb-1 pt-4 sm:pb-1.5 sm:pt-5 lg:pt-6">
      <AppPageContainer>
        <div
          className={cn(
            "shell-header-card",
            isBudgetMobile && "shell-header-card--budget-mobile",
          )}
        >
          {isBudgetMobile ? (
            <>
              <div className="budget-mobile-header__top max-[640px]:flex min-[641px]:hidden">
                <div className="budget-mobile-header__brand flex min-w-0 items-center gap-3">
                  <img
                    src="/icons/wallet.svg"
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-[0.85rem]"
                    width={44}
                    height={44}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <h1
                      className={cn(
                        "leading-snug text-[#1A1411]",
                        isBrandTitle
                          ? "font-display text-lg font-medium tracking-[-0.02em]"
                          : "text-lg font-medium",
                      )}
                    >
                      {title}
                    </h1>
                    <p className="budget-mobile-header__subtitle">{subtitle}</p>
                  </div>
                </div>
                <Link
                  to="/settings"
                  className="shell-user-btn touch-hit shrink-0"
                  aria-label="Notifications and settings"
                >
                  <Bell className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <div className="budget-mobile-header__month max-[640px]:block min-[641px]:hidden">
                <MonthSelector
                  currentMonth={currentMonth}
                  onMonthChange={onMonthChange}
                  incomeCycle={incomeCycle}
                  selectedCycle={selectedCycle}
                  variant="mobile"
                />
              </div>
            </>
          ) : null}

          <div
            className={cn(
              "flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6",
              isBudgetMobile && "max-[640px]:hidden min-[641px]:flex",
            )}
          >
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
              <MonthSelector
                currentMonth={currentMonth}
                onMonthChange={onMonthChange}
                incomeCycle={incomeCycle}
                selectedCycle={selectedCycle}
              />
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
      </AppPageContainer>
    </header>
  );
}
