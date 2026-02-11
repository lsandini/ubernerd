# UberNerd Backend

Fastify + Drizzle ORM + PostgreSQL.

## Dev

```sh
docker compose -f ../docker-compose.yml up -d   # start Postgres
npm i && npm run dev                              # migrate, seed, serve on :8787
```

## Endpoints

| Route | Method | Description |
|---|---|---|
| `/config` | GET | Server time, feature flags |
| `/packs?domain=&locale=` | GET | Signed question packs (ETag/304 support) |
| `/results` | POST | Batch submit attempts, returns score + rank |
| `/ladder?domain=&period=` | GET | Leaderboard (materialized or live) |

## DB Scripts

- `npm run db:generate` — generate migration SQL from schema
- `npm run db:migrate` — apply pending migrations
- `npm run db:push` — push schema directly (rapid dev)
- `npm run db:seed` — seed sample data
- `npm run db:studio` — Drizzle Studio (visual DB browser)
