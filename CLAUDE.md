# UberNerd — Quiz Gauntlet

## What This Project Is

A privacy-first, local-first quiz app that delivers timed "micro-drops" (2–3 questions each) via push notifications, with instant explanations and pseudonymous leaderboards. The user taps a notification, sees a 3-2-1 countdown, answers under a time window, gets a verdict + explanation, and results sync later.

Two launch domains: **Medical Nerdology** and **Know Your EU** (history/culture/geography/politics).

## Architecture

Monorepo with two packages:

- **`mobile/`** — Expo SDK 54 app, TypeScript, Expo Router v6
- **`backend/`** — Fastify server, TypeScript, Drizzle ORM + PostgreSQL

### Backend (`backend/`)

- **Runtime**: Node + Fastify (ESM, `"type": "module"`)
- **Dev runner**: `tsx` (no build step needed for dev)
- **Build**: `tsc` → `dist/`
- **Port**: 8787 (configurable via `PORT` env var)
- **CORS**: wide open (`origin: true`) for dev
- **Database**: PostgreSQL via Drizzle ORM. Local dev uses Docker (`docker-compose.yml` at repo root). Cloud Postgres (Neon/Supabase) works by changing only `DATABASE_URL`.
- **Schema**: `src/schema.ts` defines 4 tables: `packs`, `items`, `attempts`, `ladders`
- **Migrations**: Drizzle Kit generates SQL into `drizzle/`, applied on startup via `src/migrate.ts`
- **Seed**: `src/seed.ts` — idempotent, loads `sample-data/pack-med-en.json` if DB is empty
- **Signing**: `jsonwebtoken` dependency installed but JWS signing/verification not yet implemented.

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
- **Local DB**: `expo-sqlite` v16 — schema initialized in `src/db.ts` (tables: settings, packs, items, schedule, attempts)
- **Identity**: UUIDv4 stored in `expo-secure-store` v15, resettable from Settings screen
- **API client**: `src/api.ts` — `getConfig()` and `getPacks()` implemented; auto-detects dev machine LAN IP on physical devices
- **Testing**: Expo Go compatible (no custom native modules)

#### Routes

| Path | File | Status |
|---|---|---|
| `/` | `app/index.tsx` | Home screen with nav links |
| `/settings` | `app/settings.tsx` | Working — shows UUID, reset button |
| `/ladder` | `app/ladder.tsx` | Stub |
| `/question/[id]` | `app/question/[id].tsx` | Stub — shows question ID |

#### Layout

`app/_layout.tsx` — Root Stack navigator with styled header, initializes SQLite on mount.

#### Key modules

| File | Purpose | Status |
|---|---|---|
| `src/types.ts` | TypeScript types for `Item`, `Domain`, `ItemType` | Done |
| `src/db.ts` | SQLite schema init (WAL mode) | Done |
| `src/api.ts` | Fetch `/config` and `/packs` from backend | Done |
| `src/scoring.ts` | `scoreBase()` and `speedMultiplier()` | Done |
| `src/scheduler.ts` | Local notification scheduling (iOS 64-cap) | Stub (TODO) |
| `src/notifications.ts` | Permission prompts | Stub (TODO) |

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

1. App fetches packs from `GET /packs` (with ETag caching), caches 48–72h of content locally in SQLite
2. Scheduler creates local notifications for upcoming items (respects iOS 64-notification cap)
3. User taps notification → deep-link → `quizapp://question/:id` → 3-2-1 countdown → timed answer → verdict + explanation
4. Attempts queued locally in SQLite (`synced=0`), batch-synced via `POST /results`
5. Server responds with ladder delta; app updates local state

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

1. Build the question UI: fetch packs → render 3-2-1 countdown → timed answer → explanation flow
2. Implement the notification scheduler (iOS 64-cap aware rolling window)
3. Pack ingestion: download → verify signature → store in SQLite
4. Results queue: offline attempt storage → batch sync on connectivity
5. Notification permissions + silent push path
6. Leaderboard MVP (mobile screen wired to `/ladder`)
7. Seed 300–500 items per domain with SME review
8. JWS pack signing + per-item token verification
9. Platform attestation (App Attest / Play Integrity)
10. Squads, optional handles/profiles, advanced stats
