import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getApp, truncateAll, seedSample, teardown } from './setup.js';

describe('Alias endpoints', () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedSample();
  });

  afterAll(teardown);

  describe('PUT /alias', () => {
    it('creates an alias', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { uuid: 'user-a', alias: 'DrNerd' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.uuid).toBe('user-a');
      expect(body.alias).toBe('DrNerd');
    });

    it('updates an existing alias', async () => {
      await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { uuid: 'user-a', alias: 'DrNerd' },
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { uuid: 'user-a', alias: 'QuizMaster' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().alias).toBe('QuizMaster');
    });

    it('deletes alias when empty string is sent', async () => {
      await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { uuid: 'user-a', alias: 'DrNerd' },
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { uuid: 'user-a', alias: '' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().alias).toBeNull();
    });

    it('rejects alias shorter than 2 chars', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { uuid: 'user-a', alias: 'X' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects alias longer than 20 chars', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { uuid: 'user-a', alias: 'A'.repeat(21) },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects alias with special characters', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { uuid: 'user-a', alias: 'Dr<script>' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('accepts accented characters', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { uuid: 'user-a', alias: 'José María' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().alias).toBe('José María');
    });

    it('returns 400 when uuid is missing', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { alias: 'DrNerd' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /alias', () => {
    it('returns alias for a user who has one', async () => {
      await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { uuid: 'user-a', alias: 'DrNerd' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/alias?uuid=user-a',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ uuid: 'user-a', alias: 'DrNerd' });
    });

    it('returns null alias for a user without one', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/alias?uuid=unknown-user',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ uuid: 'unknown-user', alias: null });
    });

    it('returns 400 when uuid is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/alias',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Ladder alias integration', () => {
    it('includes alias in ladder entries', async () => {
      // Set alias for user-a
      await app.inject({
        method: 'PUT',
        url: '/alias',
        payload: { uuid: 'user-a', alias: 'DrNerd' },
      });

      // Submit attempts for user-a and user-b
      await app.inject({
        method: 'POST',
        url: '/results',
        payload: {
          uuid: 'user-a',
          domain: 'medical',
          items: [{
            itemId: 'q_test_1',
            servedAt: 1_739_312_402,
            answeredAt: 1_739_312_410,
            rtMs: 800,
            choice: 1,
            correct: true,
            scoreDelta: 200,
          }],
        },
      });

      await app.inject({
        method: 'POST',
        url: '/results',
        payload: {
          uuid: 'user-b',
          domain: 'medical',
          items: [{
            itemId: 'q_test_1',
            servedAt: 1_739_312_500,
            answeredAt: 1_739_312_520,
            rtMs: 2000,
            choice: 1,
            correct: true,
            scoreDelta: 100,
          }],
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/ladder?domain=medical',
      });

      const body = res.json();
      expect(body.entries[0].uuid).toBe('user-a');
      expect(body.entries[0].alias).toBe('DrNerd');
      expect(body.entries[1].uuid).toBe('user-b');
      expect(body.entries[1].alias).toBeNull();
    });
  });
});
