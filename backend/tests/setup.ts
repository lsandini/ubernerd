import { type FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { db, pool } from '../src/db.js';
import { packs, items, attempts, ladders } from '../src/schema.js';

let app: FastifyInstance;

/** Build a silent Fastify instance for testing (no console logs). */
export async function getApp() {
  if (!app) {
    app = await buildApp({ logger: false });
  }
  return app;
}

/** Wipe all rows from every table. Run between tests for isolation. */
export async function truncateAll() {
  await db.delete(attempts);
  await db.delete(items);
  await db.delete(packs);
  await db.delete(ladders);
}

/** Seed the sample pack + item used by most tests. */
export async function seedSample() {
  await db.insert(packs).values({
    id: 'pk_test',
    domain: 'medical',
    locale: 'en-FI',
    validFrom: 1_700_000_000,
    validTo: 1_893_456_000,
    etag: 'W/"pk_test"',
    sig: 'DEV_ONLY_UNSIGNED',
    status: 'active',
  });

  await db.insert(items).values({
    id: 'q_test_1',
    packId: 'pk_test',
    domain: 'medical',
    type: 'A',
    diff: 2,
    timeSec: 12,
    prompt: 'Test question?',
    choices: ['A', 'B', 'C', 'D'],
    correctEnc: 'enc:base64:MQ==',
    rationaleEnc: 'enc:base64:dGVzdA==',
    tags: ['test'],
    displayFrom: 1_700_000_000,
    displayTo: 1_893_456_000,
  });
}

/** Close the DB pool after all tests finish. */
export async function teardown() {
  await pool.end();
}
