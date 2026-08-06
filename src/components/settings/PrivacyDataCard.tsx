import { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ResetMonthPlanButton } from "@/components/budget/ResetMonthPlanButton";
import { RemoveCarriedOverButton } from "@/components/budget/RemoveCarriedOverButton";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { hasSupabaseEnv, supabase, supabaseEnvError } from "@/lib/supabase/client";

type PrivacyDataCardProps = {
  isDemoMode: boolean;
  userId: string;
  userEmail: string | null;
  currentMonth: string;
  currency: string;
  rolloverBoostCents: number;
  onLeaveDemoOrSignOut: () => void;
  onBudgetPlanReset: () => void;
};

export function PrivacyDataCard({
  isDemoMode,
  userId,
  userEmail,
  currentMonth,
  currency,
  rolloverBoostCents,
  onLeaveDemoOrSignOut,
  onBudgetPlanReset,
}: PrivacyDataCardProps) {
  const [sendingReset, setSendingReset] = useState(false);

  const handleChangePassword = async () => {
    if (!hasSupabaseEnv) {
      toast.error(supabaseEnvError ?? "Supabase env vars are missing.");
      return;
    }

    const email = userEmail?.trim();
    if (!email) {
      toast.error("This account has no email on file, so a reset link cannot be sent.");
      return;
    }

    setSendingReset(true);
    try {
      const redirectTo = `${window.location.origin}/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Reset link sent. Check your email for the secure link.");
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <SettingsSection id="privacy" title="Privacy & data" description="Your data is yours.">
      {isDemoMode ? (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Demo mode</p>
            <p className="text-xs text-muted-foreground">
              You are previewing sample data. It does not modify a real account.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="touch-manipulation shrink-0 gap-2"
            onClick={onLeaveDemoOrSignOut}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Leave demo
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Change password</p>
              <p className="text-xs text-muted-foreground">
                Sends a secure reset link to your email.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="touch-manipulation shrink-0 gap-2"
              disabled={sendingReset}
              onClick={() => void handleChangePassword()}
            >
              <KeyRound className="h-4 w-4" aria-hidden />
              {sendingReset ? "Sending…" : "Change"}
            </Button>
          </div>

          <div className="flex flex-col gap-2 border-t border-dashed border-border/80 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Sign out</p>
              <p className="text-xs text-muted-foreground">
                Sign out of this device when you are done.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="touch-manipulation shrink-0 gap-2"
              onClick={onLeaveDemoOrSignOut}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </div>
        </>
      )}

      {userId ? (
        <div className="space-y-3 border-t border-dashed border-border/80 pt-4">
          <div>
            <p className="text-sm font-semibold">Budget plan</p>
            <p className="text-xs text-muted-foreground">
              Recalculate {currentMonth} from your income, bills, and goals. Expenses and bills are
              kept.
            </p>
          </div>
          <ResetMonthPlanButton
            userId={userId}
            month={currentMonth}
            onReset={onBudgetPlanReset}
            className="w-full"
          />
          <RemoveCarriedOverButton
            userId={userId}
            month={currentMonth}
            amountCents={rolloverBoostCents}
            currency={currency}
            onRemoved={onBudgetPlanReset}
          />
        </div>
      ) : null}
    </SettingsSection>
  );
}
