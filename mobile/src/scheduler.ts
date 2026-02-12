import {
  expireOldDrops,
  getSchedulableItems,
  createDropGroups,
  saveDrop,
  getPendingDropCount,
} from './drops';
import {
  hasPermissions,
  cancelAllScheduled,
  scheduleDropNotification,
} from './notifications';

const MAX_NOTIFICATIONS = 60; // iOS cap is 64, keep 4 as safety margin
const DROPS_PER_DAY = 6;
const DAY_START_HOUR = 8;  // 8am
const DAY_END_HOUR = 22;   // 10pm

const TITLES = [
  'Quiz time!',
  'Brain check!',
  'Quick round!',
  'Test yourself!',
  'Knowledge drop!',
];

const BODIES = [
  '3 questions waiting for you',
  'Can you ace this micro-drop?',
  'A quick challenge awaits',
  'Ready for a brain teaser?',
  'Your daily drop is here',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Generate spread-out fire times ──

function generateFireTimes(count: number): Date[] {
  const now = new Date();
  const times: Date[] = [];

  // Start from the next available slot today or tomorrow morning
  let cursor = new Date(now);
  if (cursor.getHours() >= DAY_END_HOUR) {
    // Past 10pm — start tomorrow at 8am
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(DAY_START_HOUR, 0, 0, 0);
  } else if (cursor.getHours() < DAY_START_HOUR) {
    cursor.setHours(DAY_START_HOUR, 0, 0, 0);
  }

  // Spread drops across remaining hours in the day window
  const windowMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const intervalMinutes = Math.floor(windowMinutes / DROPS_PER_DAY);

  let dayOffset = 0;
  let slotInDay = 0;

  while (times.length < count) {
    const baseDate = new Date(cursor);
    baseDate.setDate(baseDate.getDate() + dayOffset);

    if (dayOffset === 0 && slotInDay === 0) {
      // First slot: at least 5 minutes from now
      const minTime = new Date(now.getTime() + 5 * 60 * 1000);
      if (baseDate < minTime) {
        // Skip ahead to the right slot
        const msSinceDayStart =
          minTime.getHours() * 60 * 60 * 1000 +
          minTime.getMinutes() * 60 * 1000;
        const dayStartMs = DAY_START_HOUR * 60 * 60 * 1000;
        const elapsed = msSinceDayStart - dayStartMs;
        slotInDay = Math.ceil(elapsed / (intervalMinutes * 60 * 1000));
      }
    }

    if (slotInDay >= DROPS_PER_DAY) {
      dayOffset++;
      slotInDay = 0;
      continue;
    }

    const fireDate = new Date(baseDate);
    fireDate.setHours(DAY_START_HOUR, 0, 0, 0);
    fireDate.setMinutes(slotInDay * intervalMinutes);

    // Add jitter (0–15 min)
    fireDate.setMinutes(fireDate.getMinutes() + Math.floor(Math.random() * 15));

    // Don't schedule in the past
    if (fireDate > now) {
      times.push(fireDate);
    }

    slotInDay++;
  }

  return times;
}

// ── Main scheduler entry point ──

export async function reschedule(domain?: string): Promise<void> {
  // 1. Clean stale entries
  expireOldDrops();

  // 2. Check permissions (skip scheduling notifications if denied, but still create drops)
  const permitted = await hasPermissions();

  // 3. Get schedulable items
  const schedulable = getSchedulableItems(domain);
  if (schedulable.length === 0) return;

  // 4. Calculate available slots
  const currentDrops = getPendingDropCount();
  const availableSlots = Math.max(0, MAX_NOTIFICATIONS - currentDrops);
  if (availableSlots === 0) return;

  // 5. Group into drops
  const groups = createDropGroups(schedulable, availableSlots);
  if (groups.length === 0) return;

  // 6. Generate fire times
  const fireTimes = generateFireTimes(groups.length);

  // 7. Schedule each drop
  if (permitted) {
    await cancelAllScheduled();
  }

  for (let i = 0; i < groups.length; i++) {
    const dropId = `drop_${Date.now()}_${i}`;
    const fireAt = fireTimes[i];
    const fireAtEpoch = Math.floor(fireAt.getTime() / 1000);

    let notifId: string | null = null;
    if (permitted) {
      notifId = await scheduleDropNotification(
        dropId,
        fireAt,
        pickRandom(TITLES),
        pickRandom(BODIES)
      );
    }

    saveDrop(dropId, groups[i], fireAtEpoch, notifId ?? undefined);
  }

  console.log(`[scheduler] Scheduled ${groups.length} drops (${permitted ? 'with' : 'without'} notifications)`);
}
