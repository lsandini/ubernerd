import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { aliases } from '../schema.js';
import { eq } from 'drizzle-orm';

const ALIAS_RE = /^[\w\s.\-\u00C0-\u024F]{2,20}$/;

interface AliasBody {
  uuid: string;
  alias?: string;
}

export function registerAlias(app: FastifyInstance) {
  app.put('/alias', async (req, reply) => {
    const body = req.body as AliasBody;

    if (!body.uuid) {
      return reply.code(400).send({ error: 'uuid required' });
    }

    // Empty or missing alias → delete
    if (!body.alias || body.alias.trim() === '') {
      await db.delete(aliases).where(eq(aliases.uuid, body.uuid));
      return reply.send({ uuid: body.uuid, alias: null });
    }

    const alias = body.alias.trim();

    if (!ALIAS_RE.test(alias)) {
      return reply.code(400).send({
        error: 'Alias must be 2–20 characters: letters, digits, spaces, _ . -',
      });
    }

    const [row] = await db
      .insert(aliases)
      .values({ uuid: body.uuid, alias, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: aliases.uuid,
        set: { alias, updatedAt: new Date() },
      })
      .returning();

    return reply.send({ uuid: row.uuid, alias: row.alias });
  });

  app.get('/alias', async (req, reply) => {
    const q: any = req.query || {};
    const uuid = q.uuid as string;

    if (!uuid) {
      return reply.code(400).send({ error: 'uuid query parameter required' });
    }

    const [row] = await db
      .select()
      .from(aliases)
      .where(eq(aliases.uuid, uuid))
      .limit(1);

    return reply.send({ uuid, alias: row?.alias ?? null });
  });
}
