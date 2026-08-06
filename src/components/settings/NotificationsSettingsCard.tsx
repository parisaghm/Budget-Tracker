import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "@/components/settings/SettingsSection";
import {
  NOTIFICATION_BLOCKED_HINT,
  NOTIFICATION_BLOCKED_MESSAGE,
  isReminderToggleOn,
  type NotificationPermissionState,
  type NotificationPreferences,
} from "@/utils/notificationPreferences";

const REMINDER_ITEMS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: "upcomingBills",
    label: "Bill reminders",
    description: "When a bill is due soon in this cycle.",
  },
  {
    key: "weeklyReview",
    label: "Weekly review reminder",
    description: "A calm check-in to review the week.",
  },
  {
    key: "goalProgress",
    label: "Goal progress reminder",
    description: "A nudge when you have savings goals in play.",
  },
];

type NotificationsSettingsCardProps = {
  prefs: NotificationPreferences;
  permission: NotificationPermissionState;
  onPrefChange: (key: keyof NotificationPreferences, value: boolean) => void;
};

export function NotificationsSettingsCard({
  prefs,
  permission,
  onPrefChange,
}: NotificationsSettingsCardProps) {
  const notificationsBlocked = permission === "denied";

  return (
    <SettingsSection
      id="notifications"
      title="Notifications"
      description="Only the useful ones. Sova never nags."
    >
      <p className="text-xs text-muted-foreground">
        Lightweight local notifications in this browser. You stay in full control.
      </p>

      {notificationsBlocked ? (
        <p className="rounded-xl border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {NOTIFICATION_BLOCKED_MESSAGE} {NOTIFICATION_BLOCKED_HINT}
        </p>
      ) : null}

      <ul className="divide-y divide-dashed divide-border/80">
        {REMINDER_ITEMS.map((item) => {
          const enabled = isReminderToggleOn(prefs, item.key, permission);
          const switchId = `notif-${item.key}`;
          const descId = `${switchId}-desc`;
          return (
            <li key={item.key} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <label htmlFor={switchId} className="text-sm font-semibold text-foreground">
                  {item.label}
                </label>
                <p id={descId} className="mt-0.5 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <Switch
                id={switchId}
                checked={enabled}
                disabled={permission === "unsupported"}
                aria-describedby={descId}
                onCheckedChange={(val) => onPrefChange(item.key, Boolean(val))}
              />
            </li>
          );
        })}
      </ul>
    </SettingsSection>
  );
}
