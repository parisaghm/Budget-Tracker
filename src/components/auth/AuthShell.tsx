import type { ReactNode } from "react";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicAuthFooter } from "@/components/auth/PublicAuthFooter";
import { PublicAuthHeader } from "@/components/auth/PublicAuthHeader";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  showCardBrandIcon = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  showCardBrandIcon?: boolean;
}) {
  return (
    <div className="auth-shell-page flex min-h-screen flex-col text-foreground">
      <PublicAuthHeader />

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-6 pt-4 sm:px-6 sm:pt-6">
        <div
          className={cn(
            "w-full max-w-[420px] space-y-6 rounded-xl border border-border/70 bg-card p-7 shadow-[0_8px_30px_rgb(0,0,0,0.06)] sm:p-8",
            "dark:border-border dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]",
          )}
        >
          {showCardBrandIcon ? (
            <div className="flex justify-center">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-lg shadow-md shadow-primary/15"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Wallet className="h-5 w-5 text-primary-foreground" aria-hidden />
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5 text-center">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground sm:text-[15px]">{subtitle}</p> : null}
          </div>

          {children}

          {footer ? (
            <div className="text-center text-sm text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline">
              {footer}
            </div>
          ) : null}
        </div>
      </main>

      <PublicAuthFooter />
    </div>
  );
}
