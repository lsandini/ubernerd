import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, pool } from './db.js';
import { packs, items } from './schema.js';
import { count } from 'drizzle-orm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function seedIfEmpty() {
  const [{ value: packCount }] = await db.select({ value: count() }).from(packs);

  if (packCount > 0) {
    console.log(`Seed skipped: ${packCount} pack(s) already present.`);
    return;
  }

  const samplePath = path.resolve(__dirname, '..', 'sample-data', 'pack-med-en.json');
  const raw = await fs.readFile(samplePath, 'utf8');
  const pack = JSON.parse(raw);

  // Insert pack
  await db.insert(packs).values({
    id: pack.packId,
    domain: pack.domain,
    locale: pack.locale,
    validFrom: pack.validFrom,
    validTo: pack.validTo,
    etag: `W/"${pack.packId}"`,
    sig: pack.sig,
    status: 'active',
  });

  // Insert items
  const itemRows = pack.items.map((it: any) => ({
    id: it.id,
    packId: pack.packId,
    domain: pack.domain,
    subdomain: it.subdomain ?? null,
    type: it.type,
    diff: it.diff,
    timeSec: it.timeSec,
    prompt: it.prompt,
    choices: it.choices,
    correctEnc: it.correct,
    rationaleEnc: it.rationale,
    mediaUrl: it.mediaUrl ?? null,
    tags: it.tags ?? [],
    displayFrom: it.displayFrom,
    displayTo: it.displayTo,
  }));

  await db.insert(items).values(itemRows);

  console.log(`Seeded: 1 pack, ${itemRows.length} item(s)`);
}

// Allow standalone execution: tsx src/seed.ts
const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && thisFile === path.resolve(process.argv[1])) {
  seedIfEmpty()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      pool.end().finally(() => process.exit(1));
    });
}
