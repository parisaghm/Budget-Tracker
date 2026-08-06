import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { useAuth } from "@/context/AuthContext";
import { useBudgetAdjustments } from "@/hooks/useBudgetAdjustments";
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
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { useIncomeCycle } from "@/hooks/useIncomeCycle";
import { useDemo } from "@/context/DemoContext";
import { hasSupabaseEnv, supabase } from "@/lib/supabase/client";
import { SettingsSectionNav } from "@/components/settings/SettingsSectionNav";
import { CycleSettingsCard } from "@/components/settings/CycleSettingsCard";
import { ProfileSettingsCard } from "@/components/settings/ProfileSettingsCard";
import { AppearanceSettingsCard } from "@/components/settings/AppearanceSettingsCard";
import { PrivacyDataCard } from "@/components/settings/PrivacyDataCard";
import { AboutCard } from "@/components/settings/AboutCard";
import {
  SETTINGS_NAV_ITEMS,
  settingsSectionDomId,
  type SettingsSectionId,
} from "@/components/settings/settingsNav";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { isDemoMode, exitDemo } = useDemo();
  const { allCategories, addExpense, currentMonth, displayCurrency, setDisplayCurrency, selectedCycle } =
    useSupabaseFinanceData();
  const { incomeCycle, save: saveIncomeCycle, isConfigured } = useIncomeCycle();
  const userId = user?.id ?? (isDemoMode ? "demo" : "");
  const { adjustments, refresh: refreshBudgetPlan } = useBudgetAdjustments(
    userId || undefined,
    currentMonth,
  );
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("cycle");

  useEffect(() => {
    const sections = SETTINGS_NAV_ITEMS.map(({ id }) =>
      document.getElementById(settingsSectionDomId(id)),
    ).filter((el): el is HTMLElement => Boolean(el));

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top?.target) return;
        const id = (top.target as HTMLElement).dataset.settingsSection as
          | SettingsSectionId
          | undefined;
        if (id) setActiveSection(id);
      },
      {
        root: null,
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.55],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const navigateToSection = useCallback((id: SettingsSectionId) => {
    setActiveSection(id);
    const el = document.getElementById(settingsSectionDomId(id));
    if (!el) return;
    el.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }, []);

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

  return (
    <>
      <Helmet>
        <title>Settings - Sova Budget</title>
      </Helmet>
      <div className="flex min-h-dvh flex-col bg-background md:pb-24">
        <AppPageContainer className="flex-1 space-y-4 pb-mobile-nav pr-mobile-fab pt-5 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Settings
              </h1>
              <p className="text-sm text-muted-foreground">
                Cycle, profile, appearance, and account preferences.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="btn-secondary touch-hit inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Home
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-8">
            <SettingsSectionNav activeId={activeSection} onNavigate={navigateToSection} />

            <div className="min-w-0 space-y-4">
              <CycleSettingsCard
                incomeCycle={incomeCycle}
                isConfigured={isConfigured}
                onChange={saveIncomeCycle}
                selectedCycle={selectedCycle}
              />
              <ProfileSettingsCard
                user={user}
                isDemoMode={isDemoMode}
                currency={displayCurrency}
                onCurrencyChange={setDisplayCurrency}
              />
              <AppearanceSettingsCard />
              <PrivacyDataCard
                isDemoMode={isDemoMode}
                userId={userId}
                userEmail={user?.email ?? null}
                currentMonth={currentMonth}
                currency={displayCurrency}
                rolloverBoostCents={adjustments.rolloverBoostCents}
                onLeaveDemoOrSignOut={() => setSignOutOpen(true)}
                onBudgetPlanReset={refreshBudgetPlan}
              />
              <AboutCard />
            </div>
          </div>
        </AppPageContainer>

        <QuickAddExpenseSheet
          currency={displayCurrency}
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
