# UberNerd — Quiz Gauntlet

Privacy-first, local-first quiz app with timed micro-drops and pseudonymous leaderboards.

## Structure

- `backend/` — Fastify + Drizzle ORM + PostgreSQL
- `mobile/` — Expo SDK 54 + Expo Router v6

## Dev Quickstart

```sh
# 1. Start Postgres
docker compose up -d

# 2. Backend
cd backend && npm i && npm run dev
# → runs migrations, seeds sample data, listens on :8787

# 3. Mobile (Expo Go)
cd mobile && npm i && npm start
# → scan QR with Expo Go
```

## Environment

Copy `.env.example` and adjust as needed. Default `DATABASE_URL` points to the local Docker Postgres.
