// Phase 7 Part A: validates src/data/activityExpansions.json before it gets
// merged into trips.ts by extract-trips.mjs. Checks: 15-25 activities per
// trip, no duplicate names (case-insensitive) within a trip, and prices
// within sane bounds scaled by that trip's cost index. Run after authoring
// each batch, before moving on to the next.
//
// Phase 26: also checks every activity's permanent id -- present, shaped
// "<tripId>.<slug>", unique across the catalog -- and that no id from the
// frozen scripts/data/legacyActivityOrder.json snapshot has gone missing (saved
// plans can reference any of them). Removing one on purpose means adding it
// to RETIRED_IDS below, so it's a decision, not an accident.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadTagSources, validateTags } from "./activity-tags.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const expansions = JSON.parse(readFileSync(path.join(root, "src/data/activityExpansions.json"), "utf8"));
const legacy = JSON.parse(readFileSync(path.join(root, "scripts/data/legacyActivityOrder.json"), "utf8"));

// Activity ids deliberately removed from the catalog. Saved plans that picked
// one keep it (shown as "no longer listed", counted at $0).
const RETIRED_IDS = new Set([]);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// pull ci straight out of the generated trips.ts (already reflects the
// original HTML-extracted data -- ci itself is never touched by this overlay)
const tripsSrc = readFileSync(path.join(root, "src/data/trips.ts"), "utf8");
const tripsJson = tripsSrc.slice(tripsSrc.indexOf("export const TRIPS: Trip[] = ") + "export const TRIPS: Trip[] = ".length).replace(/;\s*$/, "");
const TRIPS = JSON.parse(tripsJson);
const ciById = new Map(TRIPS.map((t) => [t.id, t.ci]));
const nameById = new Map(TRIPS.map((t) => [t.id, t.n]));

// generous per-ci ceiling for a single activity -- free/cheap walks are
// always fine; splurge excursions can run higher at pricier cost indexes
const CI_CEILING = { 1: 70, 2: 90, 3: 110, 4: 150, 5: 300 };

let errors = 0;
let warnings = 0;
const allIds = new Set();

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
  for (const [actName, price, actId] of activities) {
    if (typeof actId !== "string" || !actId.startsWith(`${id}.`) || !SLUG.test(actId.slice(id.length + 1))) {
      console.error(`ERROR ${name} (${id}): "${actName}" has a missing or malformed id: ${actId}`);
      errors++;
    } else if (allIds.has(actId)) {
      console.error(`ERROR ${name} (${id}): duplicate activity id ${actId}`);
      errors++;
    }
    allIds.add(actId);

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

for (const [tripId, suffixes] of Object.entries(legacy)) {
  for (const suffix of suffixes) {
    const legacyId = `${tripId}.${suffix}`;
    if (!allIds.has(legacyId) && !RETIRED_IDS.has(legacyId)) {
      console.error(`ERROR ${tripId}: activity id ${legacyId} disappeared -- saved plans may reference it. Restore it, or add it to RETIRED_IDS on purpose.`);
      errors++;
    }
  }
}

// Phase 26 step 2: activity tags (category, duration, when, flags,
// description) -- rules in scripts/activity-tags.mjs. Checked against the
// expansions as they are now, so run this before extract-trips.mjs.
const tripsForTags = Object.entries(expansions).map(([id, a]) => ({ id, n: nameById.get(id) ?? id, a }));
const tagCheck = validateTags(tripsForTags, loadTagSources(root));
for (const e of tagCheck.errors) console.error(`ERROR tags ${e}`);
for (const w of tagCheck.warnings) console.warn(`WARN  tags ${w}`);
errors += tagCheck.errors.length;
warnings += tagCheck.warnings.length;
console.log(`\nactivity tags: ${tagCheck.taggedTrips} of ${Object.keys(expansions).length} trips tagged`);

console.log(`\n${Object.keys(expansions).length} trips checked, ${errors} errors, ${warnings} warnings.`);
if (errors > 0) process.exit(1);
