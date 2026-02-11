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
    CREATE TABLE IF NOT EXISTS schedule (
      id TEXT PRIMARY KEY,
      itemId TEXT,
      fireAt INTEGER,
      state TEXT
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      itemId TEXT,
      servedAt INTEGER,
      answeredAt INTEGER,
      rtMs INTEGER,
      choice INTEGER,
      correct INTEGER,
      scoreDelta INTEGER,
      synced INTEGER
    );
  `);
}
