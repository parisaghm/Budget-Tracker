import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import type { OnboardingData } from "@/types/onboarding";
import { Switch } from "@/components/ui/switch";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { InstallAppButton } from "@/components/InstallAppButton";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { useDemo } from "@/context/DemoContext";

type NotificationPreferences = {
  weeklyReview: boolean;
  upcomingBills: boolean;
  goalProgress: boolean;
};

const NOTIFICATION_SETTINGS_KEY = "bt_notification_preferences_v1";

function readNotificationPreferences(): NotificationPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTIFICATION_SETTINGS_KEY) ?? "{}");
    return {
      weeklyReview: Boolean(parsed.weeklyReview),
      upcomingBills: Boolean(parsed.upcomingBills),
      goalProgress: Boolean(parsed.goalProgress),
    };
  } catch {
    return { weeklyReview: false, upcomingBills: false, goalProgress: false };
  }
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isDemoMode } = useDemo();
  const { onboardingData, complete } = useOnboardingProfile();
  const { budget, allCategories, addExpense, syncFromOnboarding } = useSupabaseFinanceData();
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(readNotificationPreferences);

  const handleSave = async (data: OnboardingData) => {
    if (isDemoMode) {
      toast.info("Sample budget", {
        description: "Create a free account to save your plan and preferences.",
      });
      return;
    }
    try {
      await syncFromOnboarding(data);
      complete(data);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile. Try again.");
    }
  };

  const updatePref = (key: keyof NotificationPreferences, value: boolean) => {
    if (value && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    setNotificationPrefs((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <>
      <Helmet>
        <title>Settings - Budget Tracker</title>
      </Helmet>
      <div className="bg-background pb-mobile-nav md:pb-24">
        <div className="container mx-auto max-w-2xl space-y-4 px-4 pt-5 sm:pt-6">
          <Link
            to="/dashboard"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground touch-manipulation hover:bg-secondary/80 sm:w-auto sm:py-2 sm:text-xs"
          >
            Back to dashboard
          </Link>
          <div className="card-elevated space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">App experience</p>
                <p className="text-xs text-muted-foreground">Install for faster daily access</p>
              </div>
              <InstallAppButton />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Reminders</p>
              <p className="text-xs text-muted-foreground">
                Lightweight local notifications only. You stay in full control.
              </p>
              {[
                { key: "weeklyReview", label: "Weekly review reminder" },
                { key: "upcomingBills", label: "Upcoming bill reminder" },
                { key: "goalProgress", label: "Goal progress reminder" },
              ].map((item) => {
                const enabled = notificationPrefs[item.key as keyof NotificationPreferences];
                return (
                  <div key={item.key} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      {enabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                      <span>{item.label}</span>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(val) => updatePref(item.key as keyof NotificationPreferences, Boolean(val))}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <OnboardingFlow
          initialData={onboardingData}
          currency={budget?.currency ?? "EUR"}
          canExit
          onExit={() => navigate("/dashboard")}
          onComplete={handleSave}
        />
        <QuickAddExpenseSheet
          currency={budget?.currency ?? "EUR"}
          categories={allCategories}
          onAdd={addExpense}
        />
        <MobileBottomNav />
      </div>
    </>
  );
}
