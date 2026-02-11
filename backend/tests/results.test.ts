import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getApp, truncateAll, seedSample, teardown } from './setup.js';

describe('POST /results', () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedSample();
  });

  afterAll(teardown);

  it('accepts valid results and returns score + rank', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/results',
      payload: {
        uuid: 'user-1',
        domain: 'medical',
        items: [
          {
            itemId: 'q_test_1',
            servedAt: 1_739_312_402,
            answeredAt: 1_739_312_417,
            rtMs: 1500,
            choice: 1,
            correct: true,
            scoreDelta: 145,
            token: 'dev',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.accepted).toEqual(['q_test_1']);
    expect(body.mmrDelta).toBe(145);
    expect(body.ladder.rank).toBe(1);
    expect(body.ladder.score).toBe(145);
    expect(body.ladder.avgRtMs).toBe(1500);
  });

  it('accumulates score across multiple submissions', async () => {
    // First submission
    await app.inject({
      method: 'POST',
      url: '/results',
      payload: {
        uuid: 'user-1',
        domain: 'medical',
        items: [
          {
            itemId: 'q_test_1',
            servedAt: 1_739_312_402,
            answeredAt: 1_739_312_417,
            rtMs: 1500,
            choice: 1,
            correct: true,
            scoreDelta: 100,
          },
        ],
      },
    });

    // Second submission
    const res = await app.inject({
      method: 'POST',
      url: '/results',
      payload: {
        uuid: 'user-1',
        domain: 'medical',
        items: [
          {
            itemId: 'q_test_1',
            servedAt: 1_739_312_500,
            answeredAt: 1_739_312_510,
            rtMs: 2000,
            choice: 1,
            correct: true,
            scoreDelta: 50,
          },
        ],
      },
    });

    const body = res.json();
    expect(body.mmrDelta).toBe(50);
    expect(body.ladder.score).toBe(150);
  });

  it('computes rank correctly with multiple users', async () => {
    // User A scores 200
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

    // User B scores 50 — should be rank 2
    const res = await app.inject({
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
            rtMs: 3000,
            choice: 1,
            correct: true,
            scoreDelta: 50,
          },
        ],
      },
    });

    const body = res.json();
    expect(body.ladder.rank).toBe(2);
    expect(body.ladder.score).toBe(50);
  });

  it('rejects missing uuid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/results',
      payload: { items: [{ itemId: 'q_test_1' }] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/uuid/i);
  });

  it('rejects empty items array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/results',
      payload: { uuid: 'user-1', domain: 'medical', items: [] },
    });

    expect(res.statusCode).toBe(400);
  });
});
