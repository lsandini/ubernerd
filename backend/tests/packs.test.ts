import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getApp, truncateAll, seedSample, teardown } from './setup.js';

describe('GET /packs', () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedSample();
  });

  afterAll(teardown);

  it('returns packs for matching domain and locale', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/packs?domain=medical&locale=en',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.packs).toHaveLength(1);
    expect(body.packs[0].packId).toBe('pk_test');
    expect(body.packs[0].items).toHaveLength(1);
    expect(body.packs[0].items[0].id).toBe('q_test_1');
    expect(body.packs[0].items[0].prompt).toBe('Test question?');
    expect(body.etag).toBeTruthy();
  });

  it('returns empty packs for non-matching domain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/packs?domain=eu&locale=en',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.packs).toHaveLength(0);
  });

  it('returns empty packs for non-matching locale', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/packs?domain=medical&locale=fr',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.packs).toHaveLength(0);
  });

  it('returns 304 when If-None-Match matches etag', async () => {
    // First request to get the etag
    const first = await app.inject({
      method: 'GET',
      url: '/packs?domain=medical&locale=en',
    });
    const etag = first.json().etag;

    // Second request with matching etag
    const second = await app.inject({
      method: 'GET',
      url: '/packs?domain=medical&locale=en',
      headers: { 'if-none-match': etag },
    });

    expect(second.statusCode).toBe(304);
  });

  it('returns 304 when sinceEtag query param matches', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/packs?domain=medical&locale=en',
    });
    const etag = first.json().etag;

    const second = await app.inject({
      method: 'GET',
      url: `/packs?domain=medical&locale=en&sinceEtag=${encodeURIComponent(etag)}`,
    });

    expect(second.statusCode).toBe(304);
  });

  it('includes nextCheckSec in response', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/packs?domain=medical&locale=en',
    });

    expect(res.json().nextCheckSec).toBe(21600);
  });
});
