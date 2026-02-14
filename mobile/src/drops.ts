import { db } from './db';
import { getLocalItems } from './packs';
import { hasAttempt } from './attempts';

const DROP_SIZE = 3;

// ── Web fallback: in-memory drops when SQLite is unavailable ──

interface ScheduleRow {
  id: string;
  dropId: string;
  itemId: string;
  seq: number;
  fireAt: number;
  state: string;
  notifId: string | null;
}

let memorySchedule: ScheduleRow[] = [];

// ── Get items eligible for scheduling ──

export function getSchedulableItems(domain?: string): string[] {
  const items = getLocalItems(domain);
  const now = Math.floor(Date.now() / 1000);

  // Get item IDs already in pending/notified drops
  const scheduledIds = new Set<string>();
  if (db) {
    const rows = db.getAllSync(
      "SELECT itemId FROM schedule WHERE state IN ('pending', 'notified')",
      []
    ) as { itemId: string }[];
    for (const r of rows) scheduledIds.add(r.itemId);
  } else {
    for (const r of memorySchedule) {
      if (r.state === 'pending' || r.state === 'notified') {
        scheduledIds.add(r.itemId);
      }
    }
  }

  return items
    .filter((item) => {
      // Not already attempted
      if (hasAttempt(item.id)) return false;
      // Not already in a pending/notified drop
      if (scheduledIds.has(item.id)) return false;
      // Within display window
      if (item.displayFrom > now) return false;
      if (item.displayTo < now) return false;
      return true;
    })
    .map((item) => item.id);
}

// ── Shuffle and group items into drops of 3 ──

export function createDropGroups(itemIds: string[], maxDrops: number): string[][] {
  // Fisher-Yates shuffle
  const shuffled = [...itemIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const groups: string[][] = [];
  for (let i = 0; i < shuffled.length && groups.length < maxDrops; i += DROP_SIZE) {
    const group = shuffled.slice(i, i + DROP_SIZE);
    if (group.length > 0) groups.push(group);
  }
  return groups;
}

// ── Persist a drop to the schedule table ──

export function saveDrop(
  dropId: string,
  itemIds: string[],
  fireAt: number,
  notifId?: string
): void {
  if (db) {
    for (let i = 0; i < itemIds.length; i++) {
      const rowId = `${dropId}_${i}`;
      db.runSync(
        `INSERT OR REPLACE INTO schedule (id, dropId, itemId, seq, fireAt, state, notifId)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [rowId, dropId, itemIds[i], i, fireAt, notifId ?? null]
      );
    }
  } else {
    for (let i = 0; i < itemIds.length; i++) {
      const rowId = `${dropId}_${i}`;
      const existing = memorySchedule.findIndex((r) => r.id === rowId);
      const entry: ScheduleRow = {
        id: rowId,
        dropId,
        itemId: itemIds[i],
        seq: i,
        fireAt,
        state: 'pending',
        notifId: notifId ?? null,
      };
      if (existing >= 0) memorySchedule[existing] = entry;
      else memorySchedule.push(entry);
    }
  }
}

// ── Get ordered item IDs for a drop ──

export function getDropItems(dropId: string): string[] {
  let rows: ScheduleRow[];
  if (db) {
    rows = db.getAllSync(
      'SELECT * FROM schedule WHERE dropId = ? ORDER BY seq ASC',
      [dropId]
    ) as ScheduleRow[];
  } else {
    rows = memorySchedule
      .filter((r) => r.dropId === dropId)
      .sort((a, b) => a.seq - b.seq);
  }
  return rows.map((r) => r.itemId);
}

// ── State transitions ──

export function markDropNotified(dropId: string): void {
  if (db) {
    db.runSync("UPDATE schedule SET state = 'notified' WHERE dropId = ?", [dropId]);
  } else {
    for (const r of memorySchedule) {
      if (r.dropId === dropId) r.state = 'notified';
    }
  }
}

export function markDropCompleted(dropId: string): void {
  if (db) {
    db.runSync("UPDATE schedule SET state = 'completed' WHERE dropId = ?", [dropId]);
  } else {
    for (const r of memorySchedule) {
      if (r.dropId === dropId) r.state = 'completed';
    }
  }
}

// ── Expire old drops (>24h past fireAt) ──

export function expireOldDrops(): void {
  const cutoff = Math.floor(Date.now() / 1000) - 86400;
  if (db) {
    db.runSync(
      "UPDATE schedule SET state = 'expired' WHERE state IN ('pending', 'notified') AND fireAt < ?",
      [cutoff]
    );
  } else {
    for (const r of memorySchedule) {
      if ((r.state === 'pending' || r.state === 'notified') && r.fireAt < cutoff) {
        r.state = 'expired';
      }
    }
  }
}

// ── Get or create an ad-hoc drop for the "Start Drop" button ──

export function getOrCreateNextDrop(domain?: string): { dropId: string; itemIds: string[] } | null {
  // First check for an existing pending drop
  if (db) {
    const rows = db.getAllSync(
      "SELECT DISTINCT dropId FROM schedule WHERE state = 'pending' ORDER BY fireAt ASC LIMIT 1",
      []
    ) as { dropId: string }[];
    if (rows.length > 0) {
      const dropId = rows[0].dropId;
      const itemIds = getDropItems(dropId);
      // Filter out already-attempted items
      const valid = itemIds.filter((id) => !hasAttempt(id));
      if (valid.length > 0) return { dropId, itemIds: valid };
    }
  } else {
    const pending = memorySchedule
      .filter((r) => r.state === 'pending')
      .sort((a, b) => a.fireAt - b.fireAt);
    if (pending.length > 0) {
      const dropId = pending[0].dropId;
      const itemIds = getDropItems(dropId);
      const valid = itemIds.filter((id) => !hasAttempt(id));
      if (valid.length > 0) return { dropId, itemIds: valid };
    }
  }

  // Create ad-hoc drop from schedulable items
  const schedulable = getSchedulableItems(domain);
  if (schedulable.length === 0) return null;

  const groups = createDropGroups(schedulable, 1);
  if (groups.length === 0) return null;

  const itemIds = groups[0];
  const dropId = `drop_${Date.now()}`;
  const fireAt = Math.floor(Date.now() / 1000);
  saveDrop(dropId, itemIds, fireAt);

  return { dropId, itemIds };
}

// ── Clear all schedule rows (dev reset) ──

export function clearSchedule(): void {
  if (db) {
    db.runSync('DELETE FROM schedule', []);
  } else {
    memorySchedule = [];
  }
}

// ── Count pending drops (for iOS notification cap check) ──

export function getPendingDropCount(): number {
  if (db) {
    const rows = db.getAllSync(
      "SELECT COUNT(DISTINCT dropId) as cnt FROM schedule WHERE state IN ('pending', 'notified')",
      []
    ) as { cnt: number }[];
    return rows[0]?.cnt ?? 0;
  }
  const ids = new Set(
    memorySchedule
      .filter((r) => r.state === 'pending' || r.state === 'notified')
      .map((r) => r.dropId)
  );
  return ids.size;
}
