import { db } from './db';
import { getPacks } from './api';
import type { Item, Domain } from './types';

// ── Base64 decoding ──

export function decodeField(value: string): string {
  const prefix = 'enc:base64:';
  const raw = value.startsWith(prefix) ? value.slice(prefix.length) : value;
  // atob works in both RN and web
  return atob(raw);
}

// ── Web fallback: in-memory cache when SQLite is unavailable ──

let memoryItems: Item[] = [];

// ── Sync packs from API into local storage ──

export async function syncPacks(domain: string, locale: string): Promise<number> {
  const resp = await getPacks({ domain, locale });
  if (!resp.packs || resp.packs.length === 0) return 0;

  let count = 0;

  for (const pack of resp.packs) {
    if (db) {
      db.runSync(
        `INSERT OR REPLACE INTO packs (id, domain, validFrom, validTo, etag, sig, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [pack.packId, pack.domain, pack.validFrom, pack.validTo, resp.etag ?? null, pack.sig]
      );

      for (const item of pack.items) {
        db.runSync(
          `INSERT OR REPLACE INTO items
           (id, packId, domain, subdomain, type, diff, timeSec, prompt, choices, correctEnc, rationaleEnc, mediaUrl, tags, displayFrom, displayTo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            pack.packId,
            pack.domain,
            null,
            item.type,
            item.diff,
            item.timeSec,
            item.prompt,
            JSON.stringify(item.choices),
            item.correct,    // stored encoded
            item.rationale,  // stored encoded
            item.mediaUrl ?? null,
            JSON.stringify(item.tags ?? []),
            item.displayFrom,
            item.displayTo,
          ]
        );
        count++;
      }
    } else {
      // Web fallback: store in memory
      for (const item of pack.items) {
        const mapped: Item = {
          id: item.id,
          packId: pack.packId,
          domain: pack.domain as Domain,
          type: item.type as Item['type'],
          diff: item.diff,
          timeSec: item.timeSec,
          prompt: item.prompt,
          choices: item.choices,
          correctEnc: item.correct,
          rationaleEnc: item.rationale,
          mediaUrl: item.mediaUrl,
          tags: item.tags,
          displayFrom: item.displayFrom,
          displayTo: item.displayTo,
        };
        const idx = memoryItems.findIndex((i) => i.id === mapped.id);
        if (idx >= 0) memoryItems[idx] = mapped;
        else memoryItems.push(mapped);
        count++;
      }
    }
  }

  return count;
}

// ── Read items from local storage ──

export function getLocalItems(domain?: string): Item[] {
  if (!db) {
    return domain ? memoryItems.filter((i) => i.domain === domain) : [...memoryItems];
  }

  const sql = domain
    ? 'SELECT * FROM items WHERE domain = ? ORDER BY diff ASC, id ASC'
    : 'SELECT * FROM items ORDER BY diff ASC, id ASC';
  const args = domain ? [domain] : [];
  const rows = db.getAllSync(sql, args) as any[];

  return rows.map(rowToItem);
}

export function getItemById(id: string): Item | null {
  if (!db) {
    return memoryItems.find((i) => i.id === id) ?? null;
  }

  const rows = db.getAllSync('SELECT * FROM items WHERE id = ? LIMIT 1', [id]) as any[];
  if (rows.length === 0) return null;
  return rowToItem(rows[0]);
}

// ── Helpers ──

function rowToItem(row: any): Item {
  return {
    id: row.id,
    packId: row.packId,
    domain: row.domain as Domain,
    subdomain: row.subdomain ?? undefined,
    type: row.type as Item['type'],
    diff: row.diff,
    timeSec: row.timeSec,
    prompt: row.prompt,
    choices: typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices,
    correctEnc: row.correctEnc,
    rationaleEnc: row.rationaleEnc,
    mediaUrl: row.mediaUrl,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
    displayFrom: row.displayFrom,
    displayTo: row.displayTo,
  };
}
