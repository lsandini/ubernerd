import { Platform } from 'react-native';
import { db } from './db';
import { getApiBase } from './api';
import { getOrCreateUuid } from './identity';

const API_BASE = getApiBase();

// ── Web fallback: in-memory attempts when SQLite is unavailable ──
// On web, persist to localStorage so attempts survive page reloads.

const WEB_STORAGE_KEY = 'ug_attempts';

function loadWebAttempts(): AttemptRecord[] {
  if (db || typeof localStorage === 'undefined') return [];
  try {
    const stored = localStorage.getItem(WEB_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function persistWebAttempts() {
  if (db || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(memoryAttempts)); }
  catch {}
}

let memoryAttempts: AttemptRecord[] = loadWebAttempts();

export interface AttemptRecord {
  id: string;
  itemId: string;
  domain: string;
  servedAt: number;
  answeredAt: number;
  rtMs: number;
  choice: number;
  correct: number; // 1 or 0
  scoreDelta: number;
  synced: number;  // 0 or 1
}

// ── Save an attempt ──

export function saveAttempt(record: {
  itemId: string;
  domain: string;
  servedAt: number;
  answeredAt: number;
  rtMs: number;
  choice: number;
  correct: boolean;
  scoreDelta: number;
}): void {
  const id = `att_${record.itemId}_${record.answeredAt}`;
  const correctInt = record.correct ? 1 : 0;

  if (db) {
    db.runSync(
      `INSERT OR REPLACE INTO attempts
       (id, itemId, domain, servedAt, answeredAt, rtMs, choice, correct, scoreDelta, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, record.itemId, record.domain, record.servedAt, record.answeredAt, record.rtMs, record.choice, correctInt, record.scoreDelta]
    );
  } else {
    const existing = memoryAttempts.findIndex((a) => a.id === id);
    const entry: AttemptRecord = {
      id,
      itemId: record.itemId,
      domain: record.domain,
      servedAt: record.servedAt,
      answeredAt: record.answeredAt,
      rtMs: record.rtMs,
      choice: record.choice,
      correct: correctInt,
      scoreDelta: record.scoreDelta,
      synced: 0,
    };
    if (existing >= 0) memoryAttempts[existing] = entry;
    else memoryAttempts.push(entry);
    persistWebAttempts();
  }
}

// ── Check if an item was already attempted ──

export function hasAttempt(itemId: string): boolean {
  if (!db) {
    return memoryAttempts.some((a) => a.itemId === itemId);
  }
  const rows = db.getAllSync('SELECT 1 FROM attempts WHERE itemId = ? LIMIT 1', [itemId]) as any[];
  return rows.length > 0;
}

// ── Get the latest attempt for an item ──

export function getLatestAttempt(itemId: string): AttemptRecord | null {
  if (!db) {
    const matches = memoryAttempts
      .filter((a) => a.itemId === itemId)
      .sort((a, b) => b.answeredAt - a.answeredAt);
    return matches[0] ?? null;
  }
  const rows = db.getAllSync(
    'SELECT * FROM attempts WHERE itemId = ? ORDER BY answeredAt DESC LIMIT 1',
    [itemId]
  ) as AttemptRecord[];
  return rows[0] ?? null;
}

// ── Clear all local attempts (dev reset) ──

export function clearAllAttempts(): void {
  if (db) {
    db.runSync('DELETE FROM attempts', []);
  } else {
    memoryAttempts = [];
    persistWebAttempts();
  }
}

// ── Sync unsynced attempts to backend ──

export async function syncAttempts(): Promise<void> {
  const uuid = await getOrCreateUuid();

  let unsynced: AttemptRecord[];

  if (db) {
    unsynced = db.getAllSync('SELECT * FROM attempts WHERE synced = 0', []) as AttemptRecord[];
  } else {
    unsynced = memoryAttempts.filter((a) => a.synced === 0);
  }

  if (unsynced.length === 0) return;

  // Group unsynced attempts by domain
  const byDomain = new Map<string, AttemptRecord[]>();
  for (const a of unsynced) {
    const d = a.domain || 'medical';
    const list = byDomain.get(d) ?? [];
    list.push(a);
    byDomain.set(d, list);
  }

  const syncedIds: string[] = [];

  for (const [domain, domainAttempts] of byDomain) {
    const payload = {
      uuid,
      domain,
      platform: Platform.OS,
      items: domainAttempts.map((a) => ({
        itemId: a.itemId,
        servedAt: a.servedAt,
        answeredAt: a.answeredAt,
        rtMs: a.rtMs,
        choice: a.choice,
        correct: a.correct === 1,
        scoreDelta: a.scoreDelta,
      })),
    };

    try {
      const res = await fetch(`${API_BASE}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        syncedIds.push(...domainAttempts.map((a) => a.id));
      }
    } catch {
      // Network error — silent fail, stays unsynced for retry
    }
  }

  // Mark synced attempts
  if (syncedIds.length > 0) {
    if (db) {
      for (const id of syncedIds) {
        db.runSync('UPDATE attempts SET synced = 1 WHERE id = ?', [id]);
      }
    } else {
      for (const a of memoryAttempts) {
        if (syncedIds.includes(a.id)) a.synced = 1;
      }
      persistWebAttempts();
    }
  }
}
