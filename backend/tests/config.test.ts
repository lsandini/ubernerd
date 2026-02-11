import { describe, it, expect, beforeAll } from 'vitest';
import { getApp } from './setup.js';

describe('GET /config', () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  it('returns 200 with minVersion, serverTime, features', async () => {
    const res = await app.inject({ method: 'GET', url: '/config' });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toHaveProperty('minVersion', '1.0.0');
    expect(body).toHaveProperty('serverTime');
    expect(typeof body.serverTime).toBe('number');
    expect(body.serverTime).toBeGreaterThan(1_700_000_000);
    expect(body).toHaveProperty('features');
    expect(body.features).toHaveProperty('silentPush', true);
  });
});
