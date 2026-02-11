import type { FastifyInstance } from 'fastify';

export function registerConfig(app: FastifyInstance) {
  app.get('/config', async (req, reply) => {
    const body = {
      minVersion: '1.0.0',
      serverTime: Math.floor(Date.now() / 1000),
      features: { silentPush: true }
    };
    reply.send(body);
  });
}
