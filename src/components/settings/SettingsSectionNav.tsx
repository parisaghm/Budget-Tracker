import { cn } from "@/lib/utils";
import {
  SETTINGS_NAV_ITEMS,
  settingsSectionDomId,
  type SettingsSectionId,
} from "@/components/settings/settingsNav";

type SettingsSectionNavProps = {
  activeId: SettingsSectionId;
  onNavigate: (id: SettingsSectionId) => void;
};

export function SettingsSectionNav({ activeId, onNavigate }: SettingsSectionNavProps) {
  return (
    <>
      {/* Mobile / tablet: horizontal strip */}
      <nav
        aria-label="Settings sections"
        className="lg:hidden"
      >
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SETTINGS_NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const selected = activeId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "touch-hit inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                  selected
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop: sticky vertical list */}
      <nav
        aria-label="Settings sections"
        className="hidden lg:block"
      >
        <ul className="sticky top-6 space-y-1">
          {SETTINGS_NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const selected = activeId === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onNavigate(id)}
                  aria-current={selected ? "true" : undefined}
                  aria-controls={settingsSectionDomId(id)}
                  className={cn(
                    "touch-hit flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                    selected
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
