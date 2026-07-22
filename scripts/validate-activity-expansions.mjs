// Phase 7 Part A: validates src/data/activityExpansions.json before it gets
// merged into trips.ts by extract-trips.mjs. Checks: 15-25 activities per
// trip, no duplicate names (case-insensitive) within a trip, and prices
// within sane bounds scaled by that trip's cost index. Run after authoring
// each batch, before moving on to the next.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const expansions = JSON.parse(readFileSync(path.join(root, "src/data/activityExpansions.json"), "utf8"));

// pull ci straight out of the generated trips.ts (already reflects the
// original HTML-extracted data -- ci itself is never touched by this overlay)
const tripsSrc = readFileSync(path.join(root, "src/data/trips.ts"), "utf8");
const tripsJson = tripsSrc.slice(tripsSrc.indexOf("export const TRIPS: Trip[] = ") + "export const TRIPS: Trip[] = ".length).replace(/;\s*$/, "");
const TRIPS = JSON.parse(tripsJson);
const ciById = new Map(TRIPS.map((t) => [t.id, t.ci]));
const nameById = new Map(TRIPS.map((t) => [t.id, t.n]));

// generous per-ci ceiling for a single activity -- free/cheap walks are
// always fine; splurge excursions can run higher at pricier cost indexes
const CI_CEILING = { 1: 70, 2: 90, 3: 110, 4: 140, 5: 170 };

let errors = 0;
let warnings = 0;

for (const [id, activities] of Object.entries(expansions)) {
  const ci = ciById.get(id);
  const name = nameById.get(id) ?? id;
  if (ci === undefined) {
    console.error(`ERROR ${id}: not found in trips.ts`);
    errors++;
    continue;
  }

  if (activities.length < 15 || activities.length > 25) {
    console.error(`ERROR ${name} (${id}): ${activities.length} activities, expected 15-25`);
    errors++;
  }

  const seen = new Set();
  for (const [actName, price] of activities) {
    const key = actName.trim().toLowerCase();
    if (seen.has(key)) {
      console.error(`ERROR ${name} (${id}): duplicate activity name "${actName}"`);
      errors++;
    }
    seen.add(key);

    if (typeof price !== "number" || price < 0 || Number.isNaN(price)) {
      console.error(`ERROR ${name} (${id}): invalid price for "${actName}": ${price}`);
      errors++;
      continue;
    }
    const ceiling = CI_CEILING[ci] ?? CI_CEILING[3];
    if (price > ceiling) {
      console.warn(`WARN  ${name} (${id}): "${actName}" at $${price} exceeds typical ci=${ci} ceiling ($${ceiling}) -- double check`);
      warnings++;
    }
  }
}

console.log(`\n${Object.keys(expansions).length} trips checked, ${errors} errors, ${warnings} warnings.`);
if (errors > 0) process.exit(1);
