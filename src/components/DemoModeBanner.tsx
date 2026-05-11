import { Link } from "react-router-dom";
import { Leaf, Sparkles } from "lucide-react";
import { useDemo } from "@/context/DemoContext";

export function DemoModeBanner() {
  const { exitDemo } = useDemo();

  return (
    <div
      className="border-b border-primary/15 bg-primary/[0.05] px-4 py-3 dark:bg-primary/[0.08]"
      role="status"
    >
      <div className="container mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            aria-hidden
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium leading-snug text-foreground">
              Sample budget — not your real money
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Explore the dashboard, weekly review, and bills. When you&apos;re ready, start fresh with your own
              numbers.
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Leaf className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              No bank connection — just a calm preview.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            to="/signup"
            className="btn-primary touch-hit inline-flex min-h-10 items-center justify-center px-4 py-2.5 text-center text-sm font-semibold"
          >
            Create your account
          </Link>
          <button
            type="button"
            onClick={exitDemo}
            className="btn-secondary touch-hit inline-flex min-h-10 items-center justify-center px-4 py-2.5 text-sm font-semibold"
          >
            Leave demo
          </button>
        </div>
      </div>
    </div>
  );
}
