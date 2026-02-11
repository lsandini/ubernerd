import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString =
  process.env.DATABASE_URL || 'postgres://ubernerd:ubernerd@localhost:5432/ubernerd';

export async function runMigrations() {
  const { Pool } = pg;
  const migrationPool = new Pool({ connectionString, max: 1 });
  const migrationDb = drizzle(migrationPool);

  console.log('Running migrations...');
  await migrate(migrationDb, {
    migrationsFolder: path.resolve(__dirname, '..', 'drizzle'),
  });
  console.log('Migrations complete.');

  await migrationPool.end();
}

// Allow standalone execution: tsx src/migrate.ts
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
