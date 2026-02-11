import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerConfig } from './routes/config.js';
import { registerPacks } from './routes/packs.js';
import { registerResults } from './routes/results.js';
import { registerLadder } from './routes/ladder.js';
import { pool } from './db.js';

export async function buildApp(opts?: { logger?: boolean }) {
  const app = Fastify({ logger: opts?.logger ?? true });

  await app.register(cors, { origin: true });

  registerConfig(app);
  registerPacks(app);
  registerResults(app);
  registerLadder(app);

  app.addHook('onClose', async () => {
    await pool.end();
  });

  return app;
}
