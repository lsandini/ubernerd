# UberNerd — Quiz Gauntlet

Privacy-first, local-first quiz app with timed micro-drops and pseudonymous leaderboards.

## Structure

- `backend/` — Fastify 5 + Drizzle ORM 0.45 + PostgreSQL
- `mobile/` — Expo SDK 54 + Expo Router v6 (iOS, Android, Web)

## Features

- **Timed micro-drops**: 3 questions per drop with 3-2-1 countdown and per-question timer
- **Scoring**: base points by question type, speed multiplier (1.0–1.5x), penalties for wrong answers, perfect-drop bonus (+75)
- **Leaderboard**: pseudonymous rankings by period (week/month/all time), pull-to-refresh
- **Notifications**: local push notifications for scheduled drops (iOS 64-cap aware)
- **Offline-first**: questions cached in SQLite, attempts queued locally and batch-synced
- **Privacy**: UUID-only identity, no PII, user-resettable

## Dev Quickstart

```sh
# 1. Start Postgres
docker compose up -d

# 2. Backend
cd backend && npm i && npm run dev
# → runs migrations, seeds sample data, listens on :8787

# 3. Mobile (Expo Go)
cd mobile && npm i && npm start
# → scan QR with Expo Go, or press w for web
```

## Backend API

| Route | Method | Description |
|---|---|---|
| `/config` | GET | Server config, min version, feature flags |
| `/packs?domain=&locale=` | GET | Quiz packs with ETag/304 caching |
| `/results` | POST | Batch submit attempts, returns score + rank |
| `/ladder?domain=&period=` | GET | Leaderboard (materialized or live aggregation) |

## Environment

Backend reads from `.env`:

```
PORT=8787
DATABASE_URL=postgres://ubernerd:ubernerd@localhost:5432/ubernerd
```

Default values point to the local Docker Postgres from `docker-compose.yml`.

## Testing

```sh
# Backend (requires running Postgres)
cd backend && npm test

# Type-check
cd backend && npx tsc --noEmit
cd mobile && npx tsc --noEmit
```
