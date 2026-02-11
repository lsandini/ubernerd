import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getApp, truncateAll, seedSample, teardown } from './setup.js';

describe('GET /ladder', () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedSample();
  });

  afterAll(teardown);

  it('returns empty entries when no attempts exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/ladder?domain=medical&period=week',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.entries).toEqual([]);
    expect(body.source).toBe('live');
    expect(body.periodStart).toBeGreaterThan(0);
  });

  it('returns ranked entries after attempts are submitted', async () => {
    // Submit attempts for two users
    await app.inject({
      method: 'POST',
      url: '/results',
      payload: {
        uuid: 'user-a',
        domain: 'medical',
        items: [
          {
            itemId: 'q_test_1',
            servedAt: 1_739_312_402,
            answeredAt: 1_739_312_410,
            rtMs: 800,
            choice: 1,
            correct: true,
            scoreDelta: 200,
          },
        ],
      },
    });

    await app.inject({
      method: 'POST',
      url: '/results',
      payload: {
        uuid: 'user-b',
        domain: 'medical',
        items: [
          {
            itemId: 'q_test_1',
            servedAt: 1_739_312_500,
            answeredAt: 1_739_312_520,
            rtMs: 2000,
            choice: 1,
            correct: true,
            scoreDelta: 100,
          },
        ],
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/ladder?domain=medical&period=week',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.source).toBe('live');
    expect(body.entries).toHaveLength(2);

    // user-a should be rank 1 (higher score)
    expect(body.entries[0].uuid).toBe('user-a');
    expect(body.entries[0].rank).toBe(1);
    expect(body.entries[0].score).toBe(200);

    // user-b should be rank 2
    expect(body.entries[1].uuid).toBe('user-b');
    expect(body.entries[1].rank).toBe(2);
    expect(body.entries[1].score).toBe(100);
  });

  it('returns empty for a domain with no attempts', async () => {
    // Submit to medical, then query eu
    await app.inject({
      method: 'POST',
      url: '/results',
      payload: {
        uuid: 'user-a',
        domain: 'medical',
        items: [
          {
            itemId: 'q_test_1',
            servedAt: 1_739_312_402,
            answeredAt: 1_739_312_410,
            rtMs: 800,
            choice: 1,
            correct: true,
            scoreDelta: 200,
          },
        ],
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/ladder?domain=eu&period=week',
    });

    expect(res.json().entries).toEqual([]);
  });

  it('defaults to domain=medical and period=week', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/ladder',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('source', 'live');
    expect(res.json()).toHaveProperty('entries');
  });
});
