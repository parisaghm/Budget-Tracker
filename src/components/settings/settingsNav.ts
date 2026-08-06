import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Info,
  Palette,
  Shield,
  User,
} from "lucide-react";

/** Includes `notifications` so the preserved card still typechecks while the section is hidden from Settings. */
export type SettingsSectionId =
  | "cycle"
  | "profile"
  | "appearance"
  | "notifications"
  | "privacy"
  | "about";

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
};

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { id: "cycle", label: "Cycle", icon: CalendarDays },
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "privacy", label: "Privacy & data", icon: Shield },
  { id: "about", label: "About", icon: Info },
];

export function settingsSectionDomId(id: SettingsSectionId): string {
  return `settings-${id}`;
}
