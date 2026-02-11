import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { ladders, attempts } from '../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export function registerLadder(app: FastifyInstance) {
  app.get('/ladder', async (req, reply) => {
    const q: any = req.query || {};
    const domain = (q.domain as string) || 'medical';
    const period = (q.period as string) || 'week';
    const cohort = (q.cohort as string) || 'global';

    // 1. Check for a materialized snapshot
    const [snapshot] = await db
      .select()
      .from(ladders)
      .where(
        and(
          eq(ladders.domain, domain),
          eq(ladders.period, period),
          eq(ladders.cohort, cohort),
        ),
      )
      .orderBy(desc(ladders.periodStart))
      .limit(1);

    if (snapshot) {
      return reply.send({
        periodStart: snapshot.periodStart,
        entries: snapshot.entries,
        source: 'materialized',
      });
    }

    // 2. Fallback: live aggregation from attempts
    const liveResult = await db.execute(sql`
      SELECT
        uuid,
        SUM(score_delta) AS score,
        ROUND(AVG(rt_ms)) AS avg_rt_ms,
        COUNT(*) AS num_attempts
      FROM attempts
      WHERE domain = ${domain}
      GROUP BY uuid
      ORDER BY score DESC
      LIMIT 100
    `);

    const entries = liveResult.rows.map((row: any, i: number) => ({
      rank: i + 1,
      uuid: row.uuid,
      score: Number(row.score),
      avgRtMs: Number(row.avg_rt_ms),
      numAttempts: Number(row.num_attempts),
    }));

    return reply.send({
      periodStart: Math.floor(Date.now() / 1000),
      entries,
      source: 'live',
    });
  });
}
