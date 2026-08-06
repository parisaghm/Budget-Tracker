import { ThemePreference } from "@/components/ThemePreference";
import { SettingsSection } from "@/components/settings/SettingsSection";

export function AppearanceSettingsCard() {
  return (
    <SettingsSection id="appearance" title="Appearance" description="Pick a theme for the app.">
      <ThemePreference variant="cards" />
    </SettingsSection>
  );
}
