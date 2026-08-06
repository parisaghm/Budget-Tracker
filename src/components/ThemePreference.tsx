import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type ThemeValue = "light" | "dark" | "system";

const options: {
  value: ThemeValue;
  label: string;
  description: string;
  icon: typeof Sun;
  /** Optional class on the swatch row to preview dark tokens while in light mode. */
  swatchScopeClass?: string;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Warm ivory surfaces",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Soft low-light mode",
    icon: Moon,
    swatchScopeClass: "dark",
  },
  {
    value: "system",
    label: "System",
    description: "Match your device",
    icon: Monitor,
  },
];

type ThemePreferenceProps = {
  /** Larger palette cards for Settings; compact radios elsewhere. */
  variant?: "compact" | "cards";
};

export function ThemePreference({ variant = "compact" }: ThemePreferenceProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "grid gap-2",
          variant === "cards" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-3",
        )}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={cn("rounded-xl bg-muted/60", variant === "cards" ? "h-28" : "h-11")}
            aria-hidden
          />
        ))}
      </div>
    );
  }

  const active = (theme as ThemeValue | undefined) ?? "system";

  if (variant === "cards") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
        {options.map(({ value, label, description, swatchScopeClass }) => {
          const selected = active === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={cn(
                "touch-hit relative overflow-hidden rounded-xl border text-left transition-colors",
                selected
                  ? "border-primary/40 bg-primary/10"
                  : "border-transparent bg-muted/60 hover:bg-muted",
              )}
            >
              <div
                className={cn(
                  "flex h-10 overflow-hidden border-b border-border/60",
                  swatchScopeClass,
                )}
                aria-hidden
              >
                <span className="min-w-0 flex-1 bg-background" />
                <span className="min-w-0 flex-1 bg-card" />
                <span className="min-w-0 flex-1 bg-primary" />
                <span className="min-w-0 flex-1 bg-foreground" />
              </div>
              <div className="space-y-0.5 px-3 py-3 pr-8">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    selected ? "text-primary" : "text-foreground",
                  )}
                >
                  {label}
                </p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              {selected ? (
                <span
                  className="absolute bottom-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  aria-hidden
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
      {options.map(({ value, label, icon: Icon }) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "touch-hit flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors",
              selected
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
