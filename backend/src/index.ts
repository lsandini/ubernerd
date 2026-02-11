import { runMigrations } from './migrate.js';
import { seedIfEmpty } from './seed.js';
import { buildApp } from './app.js';

await runMigrations();

const app = await buildApp();

await seedIfEmpty();

const port = Number(process.env.PORT || 8787);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  app.log.info(`Backend listening on :${port}`);
});
