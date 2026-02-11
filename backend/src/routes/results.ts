import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { attempts } from '../schema.js';
import { eq, and, sum, avg, sql } from 'drizzle-orm';

interface ResultItem {
  itemId: string;
  servedAt: number;
  answeredAt: number;
  rtMs: number;
  choice: number;
  correct: boolean;
  scoreDelta: number;
  token?: string;
}

interface ResultsBody {
  uuid: string;
  domain: string;
  platform?: string;
  appVersion?: string;
  deviceTz?: string;
  deviceLocale?: string;
  items: ResultItem[];
}

export function registerResults(app: FastifyInstance) {
  app.post('/results', async (req, reply) => {
    const body = req.body as ResultsBody;

    if (!body.uuid || !body.items?.length) {
      return reply.code(400).send({ error: 'uuid and non-empty items[] required' });
    }

    const domain = body.domain || 'medical';

    // Batch insert all attempts
    const rows = body.items.map((it) => ({
      uuid: body.uuid,
      domain,
      itemId: it.itemId,
      servedAt: it.servedAt,
      answeredAt: it.answeredAt,
      rtMs: it.rtMs,
      choice: it.choice,
      correct: it.correct,
      scoreDelta: it.scoreDelta,
      token: it.token ?? null,
      platform: body.platform ?? null,
      appVersion: body.appVersion ?? null,
      deviceTz: body.deviceTz ?? null,
      deviceLocale: body.deviceLocale ?? null,
    }));

    const inserted = await db.insert(attempts).values(rows).returning({
      id: attempts.id,
      itemId: attempts.itemId,
      scoreDelta: attempts.scoreDelta,
    });

    // Aggregate this user's total score and avg reaction time in this domain
    const [stats] = await db
      .select({
        totalScore: sum(attempts.scoreDelta),
        avgRtMs: avg(attempts.rtMs),
      })
      .from(attempts)
      .where(and(eq(attempts.uuid, body.uuid), eq(attempts.domain, domain)));

    const totalScore = Number(stats?.totalScore ?? 0);
    const avgRtMs = Math.round(Number(stats?.avgRtMs ?? 0));

    // Approximate rank: count distinct UUIDs with higher score in this domain
    const rankResult = await db.execute(sql`
      SELECT COUNT(DISTINCT uuid) + 1 AS rank
      FROM attempts
      WHERE domain = ${domain}
      GROUP BY uuid
      HAVING SUM(score_delta) > ${totalScore}
    `);

    const rank = rankResult.rows.length > 0
      ? Number(rankResult.rows[0].rank)
      : 1;

    const mmrDelta = rows.reduce((acc, r) => acc + r.scoreDelta, 0);

    return reply.send({
      accepted: inserted.map((r) => r.itemId),
      mmrDelta,
      ladder: { rank, score: totalScore, avgRtMs },
    });
  });
}
