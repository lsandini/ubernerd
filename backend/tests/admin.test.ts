import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getApp, truncateAll, seedSample, teardown } from './setup.js';
import { db } from '../src/db.js';
import { attempts } from '../src/schema.js';

describe('Admin endpoints', () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedSample();
  });

  afterAll(teardown);

  /* ── GET /admin ──────────────────────────────── */
  describe('GET /admin', () => {
    it('returns HTML page', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toContain('UberNerd Admin');
    });
  });

  /* ── GET /admin/packs ────────────────────────── */
  describe('GET /admin/packs', () => {
    it('returns pack list', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/packs' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].id).toBe('pk_test');
    });
  });

  /* ── GET /admin/items ────────────────────────── */
  describe('GET /admin/items', () => {
    it('returns decoded items with pagination', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/items' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items.length).toBe(1);
      expect(body.total).toBe(1);
      expect(body.page).toBe(1);
      // Should have decoded fields
      expect(body.items[0].correctIndex).toBe(1);
      expect(body.items[0].rationale).toBe('test');
    });

    it('filters by domain', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/items?domain=eu' });
      expect(res.json().items.length).toBe(0);
    });

    it('filters by type', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/items?type=B' });
      expect(res.json().items.length).toBe(0);
    });

    it('filters by packId', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/items?packId=pk_test' });
      expect(res.json().items.length).toBe(1);
    });

    it('paginates correctly', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/items?page=2&limit=10' });
      expect(res.json().items.length).toBe(0);
      expect(res.json().total).toBe(1);
      expect(res.json().page).toBe(2);
    });
  });

  /* ── GET /admin/items/:id ────────────────────── */
  describe('GET /admin/items/:id', () => {
    it('returns single decoded item', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/items/q_test_1' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe('q_test_1');
      expect(body.correctIndex).toBe(1);
      expect(body.rationale).toBe('test');
    });

    it('returns 404 for missing item', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/items/nonexistent' });
      expect(res.statusCode).toBe(404);
    });
  });

  /* ── POST /admin/items ───────────────────────── */
  describe('POST /admin/items', () => {
    const validItem = {
      packId: 'pk_test',
      domain: 'medical',
      type: 'A',
      diff: 3,
      prompt: 'What is the mitochondria?',
      choices: ['Powerhouse', 'Nucleus', 'Membrane', 'Ribosome'],
      correctIndex: 0,
      rationale: 'The powerhouse of the cell',
      tags: ['biology'],
    };

    it('creates item with all fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/items',
        payload: { ...validItem, id: 'q_custom_id' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBe('q_custom_id');
      expect(body.correctIndex).toBe(0);
      expect(body.rationale).toBe('The powerhouse of the cell');
    });

    it('auto-generates ID when omitted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/items',
        payload: validItem,
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().id).toMatch(/^q_medical_\d+$/);
    });

    it('auto-defaults timeSec for type A', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/items',
        payload: validItem,
      });
      expect(res.json().timeSec).toBe(12);
    });

    it('auto-defaults choices and timeSec for type B', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/items',
        payload: {
          ...validItem,
          type: 'B',
          choices: undefined,
          correctIndex: 0,
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.choices).toEqual(['True', 'False']);
      expect(body.timeSec).toBe(12);
    });

    it('rejects missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/items',
        payload: { packId: 'pk_test' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid domain', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/items',
        payload: { ...validItem, domain: 'sports' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('domain');
    });

    it('rejects invalid type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/items',
        payload: { ...validItem, type: 'X' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects diff out of range', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/items',
        payload: { ...validItem, diff: 6 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects wrong number of choices for type A', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/items',
        payload: { ...validItem, choices: ['A', 'B'] },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects correctIndex out of bounds', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/items',
        payload: { ...validItem, correctIndex: 5 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects nonexistent packId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/items',
        payload: { ...validItem, packId: 'pk_nope' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('packId');
    });
  });

  /* ── PUT /admin/items/:id ────────────────────── */
  describe('PUT /admin/items/:id', () => {
    const updatePayload = {
      packId: 'pk_test',
      domain: 'medical',
      type: 'A',
      diff: 4,
      prompt: 'Updated prompt?',
      choices: ['X', 'Y', 'Z', 'W'],
      correctIndex: 2,
      rationale: 'Updated rationale',
    };

    it('updates an existing item', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/admin/items/q_test_1',
        payload: updatePayload,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.diff).toBe(4);
      expect(body.prompt).toBe('Updated prompt?');
      expect(body.correctIndex).toBe(2);
      expect(body.rationale).toBe('Updated rationale');
    });

    it('returns 404 for missing item', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/admin/items/nonexistent',
        payload: updatePayload,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  /* ── DELETE /admin/items/:id ─────────────────── */
  describe('DELETE /admin/items/:id', () => {
    it('deletes an existing item', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/admin/items/q_test_1' });
      expect(res.statusCode).toBe(200);
      expect(res.json().ok).toBe(true);

      // Verify it's gone
      const check = await app.inject({ method: 'GET', url: '/admin/items/q_test_1' });
      expect(check.statusCode).toBe(404);
    });

    it('returns 404 for missing item', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/admin/items/nonexistent' });
      expect(res.statusCode).toBe(404);
    });

    it('returns 409 when attempts reference the item', async () => {
      // Insert an attempt referencing q_test_1
      await db.insert(attempts).values({
        uuid: 'user-x',
        domain: 'medical',
        itemId: 'q_test_1',
        servedAt: 1_700_000_100,
        answeredAt: 1_700_000_110,
        rtMs: 1000,
        choice: 1,
        correct: true,
        scoreDelta: 100,
      });

      const res = await app.inject({ method: 'DELETE', url: '/admin/items/q_test_1' });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('attempts');
    });
  });
});
