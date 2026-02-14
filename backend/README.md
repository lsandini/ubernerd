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
| `/alias` | PUT | Upsert public alias `{uuid, alias}` (2–20 chars, empty = delete) |
| `/alias?uuid=` | GET | Get alias for a user (null if unset) |
| `/admin` | GET | Admin question editor (HTML page) |
| `/admin/packs` | GET | List all packs (for dropdown) |
| `/admin/items` | GET | List items with filters + pagination |
| `/admin/items/:id` | GET | Single item (decoded) |
| `/admin/items` | POST | Create item (server encodes base64) |
| `/admin/items/:id` | PUT | Update item |
| `/admin/items/:id` | DELETE | Delete item (409 if attempts reference it) |

## DB Scripts

- `npm run db:generate` — generate migration SQL from schema
- `npm run db:migrate` — apply pending migrations
- `npm run db:push` — push schema directly (rapid dev)
- `npm run db:seed` — seed sample data
- `npm run db:studio` — Drizzle Studio (visual DB browser)
