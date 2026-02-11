import {
  pgTable,
  text,
  integer,
  serial,
  boolean,
  jsonb,
  index,
  timestamp,
} from 'drizzle-orm/pg-core';

/* ── packs ──────────────────────────────────────────────── */

export const packs = pgTable('packs', {
  id: text('id').primaryKey(),                     // packId e.g. "pk_dev_med_en"
  domain: text('domain').notNull(),                // "medical" | "eu"
  locale: text('locale').notNull(),                // "en-FI"
  validFrom: integer('valid_from').notNull(),      // unix epoch
  validTo: integer('valid_to').notNull(),          // unix epoch
  etag: text('etag'),
  sig: text('sig'),                                // JWS signature or "DEV_ONLY_UNSIGNED"
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
});

/* ── items ──────────────────────────────────────────────── */

export const items = pgTable(
  'items',
  {
    id: text('id').primaryKey(),                    // e.g. "q_dev_1"
    packId: text('pack_id')
      .notNull()
      .references(() => packs.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    subdomain: text('subdomain'),
    type: text('type').notNull(),                   // A | B | AB | K
    diff: integer('diff').notNull(),
    timeSec: integer('time_sec').notNull(),
    prompt: text('prompt').notNull(),
    choices: jsonb('choices').notNull(),             // string[]
    correctEnc: text('correct_enc').notNull(),       // encrypted / base64
    rationaleEnc: text('rationale_enc').notNull(),   // encrypted / base64
    mediaUrl: text('media_url'),
    tags: jsonb('tags').notNull().default([]),       // string[]
    displayFrom: integer('display_from').notNull(),  // unix epoch
    displayTo: integer('display_to').notNull(),      // unix epoch
  },
  (t) => [
    index('items_domain_display_idx').on(t.domain, t.displayFrom),
    index('items_pack_idx').on(t.packId),
  ],
);

/* ── attempts ───────────────────────────────────────────── */

export const attempts = pgTable(
  'attempts',
  {
    id: serial('id').primaryKey(),
    uuid: text('uuid').notNull(),
    domain: text('domain').notNull(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id),
    servedAt: integer('served_at').notNull(),       // unix epoch
    answeredAt: integer('answered_at').notNull(),   // unix epoch
    rtMs: integer('rt_ms').notNull(),               // reaction time ms
    choice: integer('choice').notNull(),
    correct: boolean('correct').notNull(),
    scoreDelta: integer('score_delta').notNull(),
    token: text('token'),                           // JWS item token
    platform: text('platform'),
    appVersion: text('app_version'),
    deviceTz: text('device_tz'),
    deviceLocale: text('device_locale'),
    receivedAt: timestamp('received_at').defaultNow(),
  },
  (t) => [
    index('attempts_uuid_answered_idx').on(t.uuid, t.answeredAt),
    index('attempts_domain_answered_idx').on(t.domain, t.answeredAt),
  ],
);

/* ── ladders (materialized snapshots) ───────────────────── */

export const ladders = pgTable(
  'ladders',
  {
    id: serial('id').primaryKey(),
    domain: text('domain').notNull(),
    period: text('period').notNull(),              // "day" | "week" | "month" | "all"
    cohort: text('cohort').notNull().default('global'),
    periodStart: integer('period_start').notNull(), // unix epoch
    entries: jsonb('entries').notNull(),             // LadderEntry[]
    computedAt: timestamp('computed_at').defaultNow(),
  },
  (t) => [
    index('ladders_domain_period_idx').on(
      t.domain,
      t.period,
      t.cohort,
      t.periodStart,
    ),
  ],
);
