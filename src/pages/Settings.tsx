import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { Bell, BellOff, LogOut } from "lucide-react";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { useAuth } from "@/context/AuthContext";
import { useBudgetAdjustments } from "@/hooks/useBudgetAdjustments";
import { ResetMonthPlanButton } from "@/components/budget/ResetMonthPlanButton";
import { RemoveCarriedOverButton } from "@/components/budget/RemoveCarriedOverButton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { AppPageContainer } from "@/components/AppPageContainer";
import { InstallAppButton } from "@/components/InstallAppButton";
import { CurrencySelector } from "@/components/CurrencySelector";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { ThemePreference } from "@/components/ThemePreference";
import { IncomeCycleSettings } from "@/components/IncomeCycleSettings";
import { useIncomeCycle } from "@/hooks/useIncomeCycle";
import { INCOME_CYCLE_SETUP_MESSAGE } from "@/types/incomeCycle";
import { useDemo } from "@/context/DemoContext";
import { hasSupabaseEnv, supabase } from "@/lib/supabase/client";
import {
  getNotificationPermissionState,
  isReminderToggleOn,
  NOTIFICATION_BLOCKED_HINT,
  NOTIFICATION_BLOCKED_MESSAGE,
  readNotificationPreferences,
  syncPrefsWithPermission,
  writeNotificationPreferences,
  type NotificationPreferences,
} from "@/utils/notificationPreferences";

export default function SettingsPage() {
  const { user } = useAuth();
  const { isDemoMode, exitDemo } = useDemo();
  const { budget, allCategories, addExpense, currentMonth, setCurrency, selectedCycle } =
    useSupabaseFinanceData();
  const { incomeCycle, save: saveIncomeCycle, isConfigured } = useIncomeCycle();
  const userId = user?.id ?? (isDemoMode ? "demo" : "");
  const { adjustments, refresh: refreshBudgetPlan } = useBudgetAdjustments(userId || undefined, currentMonth);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() =>
    syncPrefsWithPermission(readNotificationPreferences(), getNotificationPermissionState()),
  );
  const [permission, setPermission] = useState(getNotificationPermissionState);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const current = getNotificationPermissionState();
    setPermission(current);
    setNotificationPrefs((prev) => syncPrefsWithPermission(prev, current));
  }, []);

  const updatePref = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!value) {
      setNotificationPrefs((prev) => {
        const next = { ...prev, [key]: false };
        writeNotificationPreferences(next);
        return next;
      });
      return;
    }

    if (typeof Notification === "undefined") {
      toast.error("Notifications are not supported in this browser.");
      return;
    }

    const currentPermission = Notification.permission;
    setPermission(currentPermission);

    if (currentPermission === "denied") {
      toast.error(NOTIFICATION_BLOCKED_MESSAGE, { description: NOTIFICATION_BLOCKED_HINT });
      return;
    }

    if (currentPermission === "default") {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast.error(NOTIFICATION_BLOCKED_MESSAGE, {
          description: result === "denied" ? NOTIFICATION_BLOCKED_HINT : undefined,
        });
        return;
      }
    }

    setNotificationPrefs((prev) => {
      const next = { ...prev, [key]: true };
      writeNotificationPreferences(next);
      return next;
    });
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      if (isDemoMode) {
        exitDemo();
        return;
      }
      if (!hasSupabaseEnv) return;
      await supabase.auth.signOut();
    } finally {
      setIsSigningOut(false);
      setSignOutOpen(false);
    }
  };

  const notificationsBlocked = permission === "denied";

  return (
    <>
      <Helmet>
        <title>Settings - Sova Budget</title>
      </Helmet>
      <div className="flex min-h-dvh flex-col bg-background md:pb-24">
        <AppPageContainer className="flex-1 space-y-4 pb-mobile-nav pr-mobile-fab pt-5 sm:pt-6">
          <div className="mx-auto w-full max-w-2xl space-y-4">
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
            <div className="flex flex-col gap-2 rounded-xl bg-muted/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Currency</p>
                <p className="text-xs text-muted-foreground">Used for amounts across the app</p>
              </div>
              <CurrencySelector
                value={budget?.currency ?? "EUR"}
                onChange={setCurrency}
                className="sm:justify-end"
              />
            </div>
            <div className="space-y-2 rounded-xl bg-muted/60 px-3 py-3">
              <div>
                <p className="text-sm font-semibold">Theme</p>
                <p className="text-xs text-muted-foreground">Light, dark, or match your device</p>
              </div>
              <ThemePreference />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Reminders</p>
              <p className="text-xs text-muted-foreground">
                Lightweight local notifications only. You stay in full control.
              </p>
              {notificationsBlocked ? (
                <p className="rounded-xl border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {NOTIFICATION_BLOCKED_MESSAGE} {NOTIFICATION_BLOCKED_HINT}
                </p>
              ) : null}
              {[
                { key: "weeklyReview", label: "Weekly review reminder" },
                { key: "upcomingBills", label: "Upcoming bill reminder" },
                { key: "goalProgress", label: "Goal progress reminder" },
              ].map((item) => {
                const prefKey = item.key as keyof NotificationPreferences;
                const enabled = isReminderToggleOn(notificationPrefs, prefKey, permission);
                return (
                  <div key={item.key} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      {enabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                      <span>{item.label}</span>
                    </div>
                    <Switch
                      checked={enabled}
                      disabled={permission === "unsupported"}
                      onCheckedChange={(val) => void updatePref(prefKey, Boolean(val))}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-elevated space-y-4 p-4">
            <div>
              <p className="text-sm font-semibold">Income &amp; Budget Cycle</p>
              <p className="text-xs text-muted-foreground">
                When you receive income — used for days remaining, daily pace, and bill windows.
              </p>
            </div>
            {!isConfigured ? (
              <p className="rounded-xl border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {INCOME_CYCLE_SETUP_MESSAGE}
              </p>
            ) : null}
            <IncomeCycleSettings value={incomeCycle} onChange={saveIncomeCycle} />
          </div>

          {userId ? (
            <div className="card-elevated space-y-3 p-4">
              <div>
                <p className="text-sm font-semibold">Budget plan</p>
                <p className="text-xs text-muted-foreground">
                  Recalculate {currentMonth} from your income, bills, and goals. Expenses and bills are kept.
                </p>
              </div>
              <ResetMonthPlanButton
                userId={userId}
                month={currentMonth}
                onReset={refreshBudgetPlan}
                className="w-full"
              />
              <RemoveCarriedOverButton
                userId={userId}
                month={currentMonth}
                amountCents={adjustments.rolloverBoostCents}
                currency={budget?.currency ?? "EUR"}
                onRemoved={refreshBudgetPlan}
              />
            </div>
          ) : null}

          <div className="card-elevated space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold">Account</p>
              <p className="text-xs text-muted-foreground">
                {isDemoMode ? "You are previewing sample data." : "Sign out of this device when you are done."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full touch-manipulation gap-2"
              onClick={() => setSignOutOpen(true)}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {isDemoMode ? "Leave demo" : "Sign out"}
            </Button>
          </div>
          </div>
        </AppPageContainer>
        <QuickAddExpenseSheet
          currency={budget?.currency ?? "EUR"}
          categories={allCategories}
          budgetMonth={currentMonth}
          selectedCycle={selectedCycle}
          onAdd={addExpense}
        />
        <MobileBottomNav />
      </div>

      <AlertDialog open={signOutOpen} onOpenChange={(open) => !isSigningOut && setSignOutOpen(open)}>
        <AlertDialogContent className="sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{isDemoMode ? "Leave demo?" : "Sign out?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isDemoMode
                ? "You will return to the public site. Your sample data will not be saved."
                : "You will need to sign in again to access your budget on this device."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={isSigningOut} onClick={() => void handleSignOut()}>
              {isSigningOut ? "Signing out…" : isDemoMode ? "Leave demo" : "Sign out"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
