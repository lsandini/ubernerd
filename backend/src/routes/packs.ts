import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { packs, items } from '../schema.js';
import { eq, and, lte, gte, inArray } from 'drizzle-orm';

export function registerPacks(app: FastifyInstance) {
  app.get('/packs', async (req, reply) => {
    const q: any = req.query || {};
    const domain = (q.domain as string) || 'medical';
    const locale = (q.locale as string) || 'en';
    const sinceEtag = (q.sinceEtag as string) || null;
    const now = Math.floor(Date.now() / 1000);

    // Fetch active packs for the domain whose validity window includes now
    const packRows = await db
      .select()
      .from(packs)
      .where(
        and(
          eq(packs.domain, domain),
          eq(packs.status, 'active'),
          lte(packs.validFrom, now),
          gte(packs.validTo, now),
        ),
      );

    // Filter by locale prefix (e.g. "en" matches "en-FI", "en-US")
    const filtered = packRows.filter((p) => p.locale.startsWith(locale));

    if (filtered.length === 0) {
      const etag = 'W/"empty"';
      reply.header('ETag', etag);
      return reply.send({ etag, packs: [], nextCheckSec: 21600 });
    }

    // ETag from sorted pack IDs — if client already has this set, return 304
    const packIds = filtered.map((p) => p.id).sort();
    const etag = `W/"${packIds.join(',')}"`;

    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag || sinceEtag === etag) {
      return reply.code(304).send();
    }

    // Fetch all items belonging to these packs
    const itemRows = await db
      .select()
      .from(items)
      .where(inArray(items.packId, packIds));

    // Group items by packId
    const itemsByPack = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const list = itemsByPack.get(item.packId) ?? [];
      list.push(item);
      itemsByPack.set(item.packId, list);
    }

    // Assemble response packs
    const result = filtered.map((p) => ({
      packId: p.id,
      domain: p.domain,
      locale: p.locale,
      validFrom: p.validFrom,
      validTo: p.validTo,
      sig: p.sig,
      items: (itemsByPack.get(p.id) ?? []).map((it) => ({
        id: it.id,
        type: it.type,
        diff: it.diff,
        timeSec: it.timeSec,
        prompt: it.prompt,
        choices: it.choices,
        correct: it.correctEnc,
        rationale: it.rationaleEnc,
        tags: it.tags,
        displayFrom: it.displayFrom,
        displayTo: it.displayTo,
        mediaUrl: it.mediaUrl,
      })),
    }));

    reply.header('ETag', etag);
    reply.header('Date', new Date().toUTCString());
    return reply.send({ etag, packs: result, nextCheckSec: 21600 });
  });
}
