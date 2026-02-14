# UberNerd — Quiz Gauntlet

## What This Project Is

A privacy-first, local-first quiz app that delivers timed "micro-drops" (2–3 questions each) via push notifications, with instant explanations and pseudonymous leaderboards. The user taps a notification, sees a 3-2-1 countdown, answers under a time window, gets a verdict + explanation, and results sync later.

Two launch domains: **Medical Nerdology** and **Know Your EU** (history/culture/geography/politics).

## Architecture

Monorepo with two packages:

- **`mobile/`** — Expo SDK 54 app, TypeScript, Expo Router v6
- **`backend/`** — Fastify server, TypeScript, Drizzle ORM + PostgreSQL

### Backend (`backend/`)

- **Runtime**: Node + Fastify 5 (ESM, `"type": "module"`)
- **Dev runner**: `tsx` (no build step needed for dev)
- **Build**: `tsc` → `dist/`
- **Port**: 8787 (configurable via `PORT` env var)
- **CORS**: wide open (`origin: true`) for dev
- **Database**: PostgreSQL via Drizzle ORM 0.45. Local dev uses Docker (`docker-compose.yml` at repo root). Cloud Postgres (Neon/Supabase) works by changing only `DATABASE_URL`.
- **Schema**: `src/schema.ts` defines 4 tables: `packs`, `items`, `attempts`, `ladders`
- **Migrations**: Drizzle Kit 0.31 generates SQL into `drizzle/`, applied on startup via `src/migrate.ts`
- **Seed**: `src/seed.ts` — idempotent, loads `sample-data/pack-med-en.json` if DB is empty
- **Signing**: `jsonwebtoken` dependency installed but JWS signing/verification not yet implemented.

#### Key Dependencies

| Package | Version |
|---|---|
| `fastify` | ^5.7.4 |
| `@fastify/cors` | ^11.2.0 |
| `drizzle-orm` | ^0.45.1 |
| `drizzle-kit` | ^0.31.9 |
| `pg` | ^8.11.3 |
| `ioredis` | ^5.9.3 |

#### Endpoints

| Route | Method | Status |
|---|---|---|
| `/config` | GET | Working — returns `minVersion`, `serverTime`, feature flags |
| `/packs?domain=&locale=` | GET | Working — queries DB, ETag/304 support, locale prefix matching |
| `/results` | POST | Working — batch inserts attempts, returns score + rank |
| `/ladder?domain=&period=` | GET | Working — materialized snapshot or live aggregation fallback |

### Mobile App (`mobile/`)

- **Framework**: Expo SDK 54, React Native 0.81, React 19.1
- **Architecture**: New Architecture enabled (`newArchEnabled: true`)
- **Routing**: Expo Router v6 (file-based routing in `app/`)
- **Deep link scheme**: `quizapp://`
- **Local DB**: `expo-sqlite` v16 — schema initialized in `src/db.ts` (tables: settings, packs, items, schedule, attempts). Web fallback uses in-memory storage + localStorage.
- **Identity**: `src/identity.ts` — UUIDv4 auto-created on first use, stored in `expo-secure-store` (native) or `localStorage` (web), resettable from Settings screen. UUID generator has a Math.random fallback for Hermes compatibility.
- **API client**: `src/api.ts` — `getConfig()`, `getPacks()`, `getLadder()` implemented; auto-detects dev machine LAN IP on physical devices
- **Safe area**: Question and drop screens use `useSafeAreaInsets()` to avoid iOS Dynamic Island/notch overlap
- **Testing**: Expo Go compatible (no custom native modules)

#### Routes

| Path | File | Status |
|---|---|---|
| `/` | `app/index.tsx` | Home screen — question stats, "Start Drop" button, sync, reset, nav links |
| `/settings` | `app/settings.tsx` | Working — shows UUID, reset button |
| `/ladder` | `app/ladder.tsx` | Working — period tabs (week/month/all), "Your Rank" card, pull-to-refresh, syncs attempts before fetch |
| `/drop` | `app/drop.tsx` | Working — 3-2-1 countdown → sequences questions → summary with score breakdown and perfect-drop bonus |
| `/question/[id]` | `app/question/[id].tsx` | Working — countdown → timed answer with animated progress bar → verdict with explanation |

#### Layout

`app/_layout.tsx` — Root Stack navigator with styled header, initializes SQLite on mount. Notification tap listener for warm/cold start → routes to drop screen.

#### Key Modules

| File | Purpose | Status |
|---|---|---|
| `src/identity.ts` | Shared UUID create/read/reset (SecureStore native, localStorage web) | Done |
| `src/types.ts` | TypeScript types for `Item`, `Domain`, `ItemType` | Done |
| `src/db.ts` | SQLite schema init (WAL mode), null on web | Done |
| `src/api.ts` | Fetch `/config`, `/packs`, `/ladder` from backend | Done |
| `src/scoring.ts` | `scoreBase()` and `speedMultiplier()` | Done |
| `src/packs.ts` | Sync packs from API → SQLite, decode base64 fields, query local items | Done |
| `src/attempts.ts` | Save/query/clear local attempts, batch sync to `/results` | Done |
| `src/drops.ts` | Drop scheduling, grouping (3 per drop), state machine, ad-hoc drop creation | Done |
| `src/scheduler.ts` | Local notification scheduling (iOS 64-cap aware, 60-slot rolling window, 6 drops/day) | Done |
| `src/notifications.ts` | Permission prompts, schedule/cancel notifications, tap listeners (warm + cold start) | Done |

## Game Design & Scoring

- **Question archetypes**: A (single-cue recall), B (true/false), AB (two-step reasoning), K (boss/multi-constraint)
- **Time windows**: A/B: 10–12s, AB: 18–20s, K: 25–30s
- **Base points**: A/B: 100, AB: 150, K: 250
- **Speed multiplier**: 1.00–1.50 (linear by remaining time)
- **Penalties**: wrong answer −40/−60/−100 by type. Streak bonus +10/item (cap +50). Perfect-drop +75.
- **Expiry**: if opened after `displayTo`, show explanation only, no points

## Pack Format

Signed JSON blobs containing items. Each item has: `id`, `type`, `diff`, `timeSec`, `prompt`, `choices`, `correct` (base64 encoded/encrypted), `rationale` (base64 encoded/encrypted), `tags`, `displayFrom`/`displayTo` timestamps, optional `mediaUrl`. Pack-level `sig` field for JWS signature (currently `"DEV_ONLY_UNSIGNED"`).

## Data Flow

1. App fetches packs from `GET /packs` (with ETag caching), stores items locally in SQLite
2. Scheduler creates local notifications for upcoming drops (respects iOS 64-notification cap, uses 60-slot rolling window)
3. User taps notification → deep-link → `quizapp://drop/:dropId` → 3-2-1 countdown → timed answer → verdict + explanation
4. Attempts saved locally in SQLite (`synced=0`), batch-synced via `POST /results` on home screen focus and before ladder fetch
5. Server responds with accepted items, score delta, and rank; ladder screen shows leaderboard with "Your Rank" card

## Anti-Cheat

- Server-signed packs and per-item JWS tokens with time windows
- Client sends `token` in results; server validates `answeredAt` within window
- Reject sub-250ms reaction times, duplicate device IDs, suspicious patterns
- Answer order randomized client-side
- Future: iOS App Attest / Android Play Integrity

## Privacy

- UUID-only identity (no PII). Stored in secure store, user-resettable.
- GDPR/CCPA: export/delete by UUID
- Medical domain: educational disclaimer required, cite guidelines

## Environment Variables

```
PORT=8787                                                      # backend port
DATABASE_URL=postgres://ubernerd:ubernerd@localhost:5432/ubernerd  # Postgres
```

## Dev Quickstart

```sh
# 1. Start Postgres
docker compose up -d

# 2. Backend
cd backend && npm i && npm run dev

# 3. Mobile (Expo Go)
cd mobile && npm i && npm start
```

## Next Steps

1. Seed 300–500 items per domain with SME review
2. JWS pack signing + per-item token verification
3. Implement notification scheduler integration tests
4. Platform attestation (App Attest / Play Integrity)
5. Squads, optional handles/profiles, advanced stats
6. Materialized ladder snapshots (cron job to populate `ladders` table)
7. Silent push path for background pack updates
