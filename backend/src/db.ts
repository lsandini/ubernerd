import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL || 'postgres://ubernerd:ubernerd@localhost:5432/ubernerd';

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
