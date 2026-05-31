export type NotificationPreferences = {
  weeklyReview: boolean;
  upcomingBills: boolean;
  goalProgress: boolean;
};

export const NOTIFICATION_SETTINGS_KEY = 'bt_notification_preferences_v1';

export function readNotificationPreferences(): NotificationPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTIFICATION_SETTINGS_KEY) ?? '{}');
    return {
      weeklyReview: Boolean(parsed.weeklyReview),
      upcomingBills: Boolean(parsed.upcomingBills),
      goalProgress: Boolean(parsed.goalProgress),
    };
  } catch {
    return { weeklyReview: false, upcomingBills: false, goalProgress: false };
  }
}

export function writeNotificationPreferences(prefs: NotificationPreferences): void {
  localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(prefs));
}

export type NotificationPermissionState = NotificationPermission | 'unsupported';

export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export function isReminderToggleOn(
  prefs: NotificationPreferences,
  key: keyof NotificationPreferences,
  permission: NotificationPermissionState,
): boolean {
  if (!prefs[key]) return false;
  return permission === 'granted';
}

/** Turn off stored prefs when the browser has blocked notifications. */
export function syncPrefsWithPermission(
  prefs: NotificationPreferences,
  permission: NotificationPermissionState,
): NotificationPreferences {
  if (permission !== 'denied') return prefs;
  const cleared = { weeklyReview: false, upcomingBills: false, goalProgress: false };
  const hadEnabled = prefs.weeklyReview || prefs.upcomingBills || prefs.goalProgress;
  if (hadEnabled) writeNotificationPreferences(cleared);
  return cleared;
}

export const NOTIFICATION_BLOCKED_MESSAGE = 'Notifications are blocked in your browser settings.';

export const NOTIFICATION_BLOCKED_HINT =
  'Open your browser site settings for this app and allow notifications, then try again.';
