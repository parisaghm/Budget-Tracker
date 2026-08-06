import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SettingsSectionId } from "@/components/settings/settingsNav";
import { settingsSectionDomId } from "@/components/settings/settingsNav";

type SettingsSectionProps = {
  id: SettingsSectionId;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function SettingsSection({
  id,
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section
      id={settingsSectionDomId(id)}
      data-settings-section={id}
      aria-labelledby={`${settingsSectionDomId(id)}-title`}
      className={cn("card-elevated scroll-mt-24 space-y-4 p-4 sm:p-5", className)}
    >
      <header className="space-y-1.5">
        <h2
          id={`${settingsSectionDomId(id)}-title`}
          className="font-display text-xl font-semibold tracking-tight text-foreground"
        >
          {title}
        </h2>
        {description ? <p className="text-body-calm text-sm sm:text-[15px]">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
