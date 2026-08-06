import type { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CurrencySelector } from "@/components/CurrencySelector";
import { InstallAppButton } from "@/components/InstallAppButton";
import { SettingsSection } from "@/components/settings/SettingsSection";

type ProfileSettingsCardProps = {
  user: User | null;
  isDemoMode: boolean;
  currency: string;
  onCurrencyChange: (code: string) => void;
};

function initialsFromEmail(email: string | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[^a-zA-Z0-9]/g, "");
  if (!cleaned) return email.slice(0, 1).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

function displayNameFromEmail(email: string | undefined): string {
  if (!email) return "Account";
  const local = email.split("@")[0] ?? email;
  return local;
}

export function ProfileSettingsCard({
  user,
  isDemoMode,
  currency,
  onCurrencyChange,
}: ProfileSettingsCardProps) {
  const email = user?.email;
  const initials = isDemoMode ? "D" : initialsFromEmail(email);
  const name = isDemoMode ? "Demo preview" : displayNameFromEmail(email);
  const subtitle = isDemoMode
    ? "Sample data — not your real account"
    : email ?? "Signed in";

  return (
    <SettingsSection id="profile" title="Profile">
      <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-3">
        <Avatar className="h-12 w-12 rounded-[0.85rem]">
          <AvatarFallback className="rounded-[0.85rem] bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-muted/60 px-3 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="label-caps text-muted-foreground">Currency</p>
          <CurrencySelector
            value={currency}
            onChange={onCurrencyChange}
            className="sm:justify-end"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Changes how amounts are displayed across Sova. Existing values are not
          converted using exchange rates.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-muted/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Install app</p>
          <p className="text-xs text-muted-foreground">Faster daily access on this device</p>
        </div>
        <InstallAppButton />
      </div>
    </SettingsSection>
  );
}
