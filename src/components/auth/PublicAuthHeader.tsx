import { Link, useLocation } from "react-router-dom";
import { Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDemo } from "@/context/DemoContext";
import { cn } from "@/lib/utils";

export function PublicAuthHeader() {
  const { pathname } = useLocation();
  const { enterDemo } = useDemo();
  const isHome = pathname === "/";

  const loginTo = isHome ? "/?mode=login" : "/login";
  const signupTo = isHome ? "/?mode=signup" : "/signup";

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-[4.25rem] max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:min-h-[4.5rem] sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Wallet className="h-5 w-5 text-primary-foreground" aria-hidden />
          </div>
          <div className="min-w-0 text-left leading-tight">
            <p className="text-base font-bold tracking-tight text-foreground sm:text-lg">Budget Tracker</p>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground sm:text-[11px]">
              WEEKLY CLARITY
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-3 md:gap-4">
          <button
            type="button"
            onClick={enterDemo}
            className="touch-hit rounded-xl px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3 sm:text-sm"
          >
            Try demo
          </button>
          <Link
            to={loginTo}
            className="touch-hit rounded-xl px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3 sm:text-sm"
          >
            Log in
          </Link>
          <Link
            to={signupTo}
            className="btn-primary touch-hit whitespace-nowrap rounded-xl px-3 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm"
          >
            Get started
          </Link>
          <ThemeToggle
            className={cn(
              "h-9 w-9 shrink-0 rounded-lg border border-border/70 bg-secondary/60 shadow-none",
              "hover:bg-secondary hover:text-foreground",
            )}
          />
        </div>
      </div>
    </header>
  );
}
