// Loads/refreshes the 50-manual bundled Operational Manuals / SOPs library
// (schoolId: null = visible to every school) into the database.
//
// Safe to re-run: upserts by `slug`, so re-running after editing
// manuals-data.ts updates existing entries (bumping version) instead of
// creating duplicates.
//
// Run with:  npx ts-node prisma/seed-manuals.ts
// (or add a script: "seed:manuals": "ts-node prisma/seed-manuals.ts" to
// backend/package.json and run `npm run seed:manuals`)

import { PrismaClient } from '@prisma/client';
import { MANUALS_SEED } from './manuals-data';

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let updated = 0;

  for (const manual of MANUALS_SEED) {
    const existing = await prisma.manualDocument.findUnique({ where: { slug: manual.slug } });

    if (!existing) {
      await prisma.manualDocument.create({
        data: {
          schoolId: null,
          category: manual.category,
          title: manual.title,
          slug: manual.slug,
          summary: manual.summary,
          content: manual.content,
          isPublished: true,
        },
      });
      created += 1;
    } else {
      const changed = existing.content !== manual.content || existing.title !== manual.title || existing.summary !== manual.summary;
      await prisma.manualDocument.update({
        where: { slug: manual.slug },
        data: {
          category: manual.category,
          title: manual.title,
          summary: manual.summary,
          content: manual.content,
          version: changed ? { increment: 1 } : undefined,
        },
      });
      updated += 1;
    }
  }

  console.log(`Manuals library seeded: ${created} created, ${updated} updated, ${MANUALS_SEED.length} total.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
