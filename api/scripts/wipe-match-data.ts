/**
 * One-off: wipe all match data so analytics start clean once granular point
 * attribution (point_subtype) ships. Test data only — do NOT run against real data.
 *
 * Deletes (in FK-safe order):
 *   - priority_outcomes + training_priorities (derived from matches)
 *   - matches  → cascades to sets → rallies / substitutions / timeouts,
 *                match_players, match_analysis
 * Keeps teams, players, users, seasons, trainings.
 *
 * Run:
 *   cd api && npx tsx scripts/wipe-match-data.ts
 *   # or compiled: node dist/scripts/wipe-match-data.js
 *   # Railway:     railway run npx tsx scripts/wipe-match-data.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const before = {
    matches: await prisma.match.count(),
    rallies: await prisma.rally.count(),
    priorities: await prisma.trainingPriority.count(),
  }
  console.log('Before:', before)

  // training_priorities.source_match is SET NULL on match delete, so clear them
  // explicitly first (priority_outcomes cascade from the priority).
  const priorities = await prisma.trainingPriority.deleteMany({})
  // Deleting matches cascades to sets, rallies, substitutions, timeouts,
  // match_players, match_analysis, and priority_outcomes (measured_match).
  const matches = await prisma.match.deleteMany({})

  console.log(`Deleted ${matches.count} matches and ${priorities.count} training priorities (sets/rallies/subs/timeouts/analysis cascaded).`)

  const after = {
    matches: await prisma.match.count(),
    rallies: await prisma.rally.count(),
    priorities: await prisma.trainingPriority.count(),
  }
  console.log('After:', after)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
