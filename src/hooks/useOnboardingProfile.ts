import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_ONBOARDING_DATA, type OnboardingData } from "@/types/onboarding";
import { mergeOnboardingData } from "@/utils/onboarding";

function storageKeyForUser(userId: string) {
  return `budget-tracker:onboarding:${userId}`;
}

export function useOnboardingProfile() {
  const { user } = useAuth();
  const [onboardingData, setOnboardingData] = useState<OnboardingData>(DEFAULT_ONBOARDING_DATA);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setOnboardingData(DEFAULT_ONBOARDING_DATA);
      setIsReady(true);
      return;
    }

    const raw = window.localStorage.getItem(storageKeyForUser(user.id));
    if (!raw) {
      setOnboardingData(DEFAULT_ONBOARDING_DATA);
      setIsReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<OnboardingData>;
      setOnboardingData(mergeOnboardingData(parsed));
    } catch {
      setOnboardingData(DEFAULT_ONBOARDING_DATA);
      try {
        window.localStorage.removeItem(storageKeyForUser(user.id));
      } catch {
        // ignore
      }
    } finally {
      setIsReady(true);
    }
  }, [user]);

  const persist = useCallback(
    (next: OnboardingData) => {
      setOnboardingData(next);
      if (!user) return;
      try {
        window.localStorage.setItem(storageKeyForUser(user.id), JSON.stringify(next));
      } catch {
        // Quota / private mode — in-memory state still updates for this session.
      }
    },
    [user],
  );

  const patch = useCallback(
    (updates: Partial<OnboardingData>) => {
      setOnboardingData((prev) => {
        const next = mergeOnboardingData({ ...prev, ...updates });
        if (user) {
          try {
            window.localStorage.setItem(storageKeyForUser(user.id), JSON.stringify(next));
          } catch {
            // Ignore storage failures; session state remains.
          }
        }
        return next;
      });
    },
    [user],
  );

  const complete = useCallback(
    (data: OnboardingData) => {
      persist({
        ...data,
        completed: true,
        completedAt: new Date().toISOString(),
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    persist(DEFAULT_ONBOARDING_DATA);
  }, [persist]);

  return useMemo(
    () => ({
      onboardingData,
      isReady,
      patch,
      persist,
      complete,
      reset,
    }),
    [complete, isReady, onboardingData, patch, persist, reset],
  );
}
