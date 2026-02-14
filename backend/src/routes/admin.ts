import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { packs, items, attempts } from '../schema.js';
import { eq, and, count, sql } from 'drizzle-orm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ── encoding helpers ──────────────────────────────────── */

function encodeField(value: string): string {
  return `enc:base64:${Buffer.from(value, 'utf8').toString('base64')}`;
}

function decodeField(encoded: string): string {
  const prefix = 'enc:base64:';
  if (encoded.startsWith(prefix)) {
    return Buffer.from(encoded.slice(prefix.length), 'base64').toString('utf8');
  }
  return encoded;
}

/* ── defaults by question type ─────────────────────────── */

const TIME_DEFAULTS: Record<string, number> = { A: 12, B: 12, AB: 20, K: 30 };
const VALID_TYPES = ['A', 'B', 'AB', 'K'];
const VALID_DOMAINS = ['medical', 'eu'];

/* ── validation ────────────────────────────────────────── */

interface ItemBody {
  id?: string;
  packId: string;
  domain: string;
  type: string;
  diff: number;
  timeSec?: number;
  prompt: string;
  choices?: string[];
  correctIndex: number;
  rationale: string;
  tags?: string[];
  subdomain?: string | null;
  mediaUrl?: string | null;
  displayFrom?: number;
  displayTo?: number;
}

function validateItemBody(body: ItemBody): string | null {
  if (!body.packId) return 'packId is required';
  if (!body.domain) return 'domain is required';
  if (!VALID_DOMAINS.includes(body.domain)) return 'domain must be "medical" or "eu"';
  if (!body.type) return 'type is required';
  if (!VALID_TYPES.includes(body.type)) return 'type must be A, B, AB, or K';
  if (body.diff == null) return 'diff is required';
  if (!Number.isInteger(body.diff) || body.diff < 1 || body.diff > 5) return 'diff must be 1–5';
  if (!body.prompt) return 'prompt is required';
  if (body.correctIndex == null) return 'correctIndex is required';
  if (body.rationale == null || body.rationale === '') return 'rationale is required';

  // Choices validation
  const expectedLen = body.type === 'B' ? 2 : 4;
  const choices = body.type === 'B' ? ['True', 'False'] : body.choices;
  if (!choices || !Array.isArray(choices)) return 'choices is required (array)';
  if (choices.length !== expectedLen) return `choices must have ${expectedLen} items for type ${body.type}`;
  if (!Number.isInteger(body.correctIndex) || body.correctIndex < 0 || body.correctIndex >= choices.length) {
    return `correctIndex must be 0–${choices.length - 1}`;
  }

  return null;
}

/* ── route registration ────────────────────────────────── */

export function registerAdmin(app: FastifyInstance) {

  /* ── GET /admin — serve HTML page ────────────────────── */
  app.get('/admin', async (_req, reply) => {
    const htmlPath = path.resolve(__dirname, '..', '..', 'admin.html');
    const html = await fs.readFile(htmlPath, 'utf8');
    return reply.type('text/html').send(html);
  });

  /* ── GET /admin/packs — list packs for dropdown ──────── */
  app.get('/admin/packs', async (_req, reply) => {
    const rows = await db.select().from(packs);
    return reply.send(rows);
  });

  /* ── GET /admin/items — list items with filters ──────── */
  app.get('/admin/items', async (req, reply) => {
    const q: any = req.query || {};
    const page = Math.max(1, parseInt(q.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (q.packId) conditions.push(eq(items.packId, q.packId as string));
    if (q.domain) conditions.push(eq(items.domain, q.domain as string));
    if (q.type) conditions.push(eq(items.type, q.type as string));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ value: total }]] = await Promise.all([
      db.select().from(items).where(where).limit(limit).offset(offset).orderBy(items.id),
      db.select({ value: count() }).from(items).where(where),
    ]);

    const decoded = rows.map((row) => ({
      ...row,
      correctIndex: parseInt(decodeField(row.correctEnc), 10),
      rationale: decodeField(row.rationaleEnc),
    }));

    return reply.send({ items: decoded, total, page, limit });
  });

  /* ── GET /admin/items/:id — single item decoded ──────── */
  app.get('/admin/items/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1);

    if (!row) return reply.code(404).send({ error: 'Item not found' });

    return reply.send({
      ...row,
      correctIndex: parseInt(decodeField(row.correctEnc), 10),
      rationale: decodeField(row.rationaleEnc),
    });
  });

  /* ── POST /admin/items — create item ─────────────────── */
  app.post('/admin/items', async (req, reply) => {
    const body = req.body as ItemBody;
    const err = validateItemBody(body);
    if (err) return reply.code(400).send({ error: err });

    const now = Math.floor(Date.now() / 1000);
    const choices = body.type === 'B' ? ['True', 'False'] : body.choices!;
    const id = body.id || `q_${body.domain}_${Date.now()}`;
    const timeSec = body.timeSec ?? TIME_DEFAULTS[body.type] ?? 12;

    try {
      const [row] = await db.insert(items).values({
        id,
        packId: body.packId,
        domain: body.domain,
        subdomain: body.subdomain ?? null,
        type: body.type,
        diff: body.diff,
        timeSec,
        prompt: body.prompt,
        choices,
        correctEnc: encodeField(String(body.correctIndex)),
        rationaleEnc: encodeField(body.rationale),
        mediaUrl: body.mediaUrl ?? null,
        tags: body.tags ?? [],
        displayFrom: body.displayFrom ?? now,
        displayTo: body.displayTo ?? now + 365 * 24 * 60 * 60,
      }).returning();

      return reply.code(201).send({
        ...row,
        correctIndex: body.correctIndex,
        rationale: body.rationale,
      });
    } catch (e: any) {
      const code = e.code || e.cause?.code;
      if (code === '23503') {
        return reply.code(400).send({ error: 'packId does not exist' });
      }
      if (code === '23505') {
        return reply.code(409).send({ error: 'Item ID already exists' });
      }
      throw e;
    }
  });

  /* ── PUT /admin/items/:id — update item ──────────────── */
  app.put('/admin/items/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as ItemBody;
    const err = validateItemBody(body);
    if (err) return reply.code(400).send({ error: err });

    const [existing] = await db.select().from(items).where(eq(items.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'Item not found' });

    const choices = body.type === 'B' ? ['True', 'False'] : body.choices!;
    const timeSec = body.timeSec ?? TIME_DEFAULTS[body.type] ?? 12;

    try {
      const [row] = await db.update(items).set({
        packId: body.packId,
        domain: body.domain,
        subdomain: body.subdomain ?? null,
        type: body.type,
        diff: body.diff,
        timeSec,
        prompt: body.prompt,
        choices,
        correctEnc: encodeField(String(body.correctIndex)),
        rationaleEnc: encodeField(body.rationale),
        mediaUrl: body.mediaUrl ?? null,
        tags: body.tags ?? [],
        displayFrom: body.displayFrom ?? existing.displayFrom,
        displayTo: body.displayTo ?? existing.displayTo,
      }).where(eq(items.id, id)).returning();

      return reply.send({
        ...row,
        correctIndex: body.correctIndex,
        rationale: body.rationale,
      });
    } catch (e: any) {
      const code = e.code || e.cause?.code;
      if (code === '23503') {
        return reply.code(400).send({ error: 'packId does not exist' });
      }
      throw e;
    }
  });

  /* ── DELETE /admin/items/:id — delete item ───────────── */
  app.delete('/admin/items/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const [existing] = await db.select().from(items).where(eq(items.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'Item not found' });

    // Check for referencing attempts
    const [{ value: refCount }] = await db
      .select({ value: count() })
      .from(attempts)
      .where(eq(attempts.itemId, id));

    if (refCount > 0) {
      return reply.code(409).send({ error: 'Cannot delete: item has attempts referencing it' });
    }

    await db.delete(items).where(eq(items.id, id));
    return reply.send({ ok: true });
  });
}
