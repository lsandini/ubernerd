import { Platform } from 'react-native';

const isNative = Platform.OS !== 'web';

// expo-sqlite only works on native (iOS/Android).
// On web, db is null and initDb() is a no-op.
let db: import('expo-sqlite').SQLiteDatabase | null = null;

if (isNative) {
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  db = SQLite.openDatabaseSync('ubernerd.db');
}

export { db };

export function initDb() {
  if (!db) return;

  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (
      uuid TEXT PRIMARY KEY,
      region TEXT,
      domainPrefs TEXT,
      dropsPerDay INTEGER,
      windows TEXT,
      notificationsEnabled INTEGER
    );
    CREATE TABLE IF NOT EXISTS packs (
      id TEXT PRIMARY KEY,
      domain TEXT,
      validFrom INTEGER,
      validTo INTEGER,
      etag TEXT,
      sig TEXT,
      status TEXT
    );
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      packId TEXT,
      domain TEXT,
      subdomain TEXT,
      type TEXT,
      diff INTEGER,
      timeSec INTEGER,
      prompt TEXT,
      choices TEXT,
      correctEnc TEXT,
      rationaleEnc TEXT,
      mediaUrl TEXT,
      tags TEXT,
      displayFrom INTEGER,
      displayTo INTEGER
    );
    DROP TABLE IF EXISTS schedule;
    CREATE TABLE IF NOT EXISTS schedule (
      id TEXT PRIMARY KEY,
      dropId TEXT NOT NULL,
      itemId TEXT NOT NULL,
      seq INTEGER NOT NULL,
      fireAt INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending',
      notifId TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_schedule_dropId ON schedule(dropId);
    CREATE INDEX IF NOT EXISTS idx_schedule_state ON schedule(state);
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      itemId TEXT,
      domain TEXT DEFAULT 'medical',
      servedAt INTEGER,
      answeredAt INTEGER,
      rtMs INTEGER,
      choice INTEGER,
      correct INTEGER,
      scoreDelta INTEGER,
      synced INTEGER
    );
  `);

  // Migration: add domain column to existing attempts tables
  try {
    db.runSync(`ALTER TABLE attempts ADD COLUMN domain TEXT DEFAULT 'medical'`);
  } catch {
    // Column already exists — ignore
  }
}
