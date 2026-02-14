import { Platform } from 'react-native';

const isNative = Platform.OS !== 'web';

// Lazy-load expo-notifications only on native.
// The require is wrapped in try/catch because expo-notifications runs side-effect
// code on import (push token registration) that throws in Expo Go since SDK 53.
let _notifs: typeof import('expo-notifications') | null | undefined;

function getNotifs() {
  if (!isNative) return null;
  if (_notifs !== undefined) return _notifs;

  // Temporarily suppress console.error during require — expo-notifications
  // logs a noisy error about push token limitations in Expo Go (SDK 53+).
  // Local notifications still work fine; the error is cosmetic.
  const origError = console.error;
  console.error = (...args: any[]) => {
    if (String(args[0]).includes('expo-notifications')) return;
    origError(...args);
  };

  try {
    _notifs = require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    _notifs = null;
  } finally {
    console.error = origError;
  }
  return _notifs;
}

// ── Permissions ──

export async function requestPermissions(): Promise<boolean> {
  const Notifs = getNotifs();
  if (!Notifs) return false;

  const { status: existing } = await Notifs.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifs.requestPermissionsAsync();
  return status === 'granted';
}

export async function hasPermissions(): Promise<boolean> {
  const Notifs = getNotifs();
  if (!Notifs) return false;

  const { status } = await Notifs.getPermissionsAsync();
  return status === 'granted';
}

// ── Schedule a drop notification ──

export async function scheduleDropNotification(
  dropId: string,
  fireAt: Date,
  title: string,
  body: string
): Promise<string | null> {
  const Notifs = getNotifs();
  if (!Notifs) return null;

  const secondsFromNow = Math.max(1, Math.round((fireAt.getTime() - Date.now()) / 1000));

  const id = await Notifs.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { dropId },
      sound: true,
    },
    trigger: {
      type: Notifs.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsFromNow,
      repeats: false,
    },
  });

  return id;
}

// ── Cancel all scheduled notifications ──

export async function cancelAllScheduled(): Promise<void> {
  const Notifs = getNotifs();
  if (!Notifs) return;
  await Notifs.cancelAllScheduledNotificationsAsync();
}

// ── Get scheduled count (for iOS cap check) ──

export async function getScheduledCount(): Promise<number> {
  const Notifs = getNotifs();
  if (!Notifs) return 0;
  const scheduled = await Notifs.getAllScheduledNotificationsAsync();
  return scheduled.length;
}

// ── Notification tap listener ──

export function addNotificationResponseListener(
  onDropTapped: (dropId: string) => void
): (() => void) | null {
  const Notifs = getNotifs();
  if (!Notifs) return null;

  const subscription = Notifs.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    const dropId = data?.dropId as string | undefined;
    if (dropId) onDropTapped(dropId);
  });

  return () => subscription.remove();
}

// ── Cold-start: check if opened from a notification ──

export async function getLastNotificationResponse(): Promise<string | null> {
  const Notifs = getNotifs();
  if (!Notifs) return null;

  const response = await Notifs.getLastNotificationResponseAsync();
  if (!response) return null;

  const data = response.notification.request.content.data;
  return (data?.dropId as string) ?? null;
}
