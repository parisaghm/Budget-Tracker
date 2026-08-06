import { SettingsSection } from "@/components/settings/SettingsSection";
import { APP_NAME, APP_TAGLINE, APP_VERSION } from "@/lib/appVersion";

export function AboutCard() {
  return (
    <SettingsSection id="about" title="About">
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">{APP_NAME}</span>
          {" · "}
          v{APP_VERSION}
          {" · "}
          {APP_TAGLINE}
        </p>
      </div>
    </SettingsSection>
  );
}
