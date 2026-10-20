// Phase 26 step 1: gives every activity a permanent ID and freezes today's
// activity order for the migration of saved picks.
//
//   node scripts/assign-activity-ids.mjs
//
// 1. Every entry in src/data/activityExpansions.json becomes
//    [name, price, id], where id = "<tripId>.<slug of the name>". Entries
//    that already have an id keep it -- IDs are permanent once shipped, so
//    renaming an activity later changes its name, never its id. Safe to
//    re-run; only entries without an id get one.
// 2. scripts/data/legacyActivityOrder.json records, per trip, the id of the
//    activity at each position as of Oct 19, 2026 (before IDs existed,
//    saved plans stored picks by position). It's written once and never
//    rewritten after that: it has to keep describing the OLD order even
//    after the live data is reordered or expanded. It stays out of the app
//    bundle -- extract-trips.mjs turns it into the much smaller
//    src/data/legacyActivityMap.json the app actually ships.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const expansionsPath = path.join(root, "src/data/activityExpansions.json");
const legacyPath = path.join(root, "scripts/data/legacyActivityOrder.json");

const MAX_SLUG = 48;

export function slugify(name) {
  let s = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/&/g, " and ")
    .replace(/\+/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length > MAX_SLUG) {
    s = s.slice(0, MAX_SLUG);
    const cut = s.lastIndexOf("-");
    if (cut > 20) s = s.slice(0, cut);
  }
  return s || "activity";
}

const expansions = JSON.parse(readFileSync(expansionsPath, "utf8"));
const allIds = new Set();
let assigned = 0;

for (const [tripId, list] of Object.entries(expansions)) {
  const used = new Set(list.filter((e) => typeof e[2] === "string").map((e) => e[2]));
  for (const entry of list) {
    if (typeof entry[2] === "string") continue;
    const base = `${tripId}.${slugify(entry[0])}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    entry[2] = id;
    assigned++;
  }
  for (const [, , id] of list) {
    if (allIds.has(id)) throw new Error(`duplicate activity id ${id}`);
    allIds.add(id);
  }
}

// One entry per line keeps the file readable and diffs small.
const lines = Object.entries(expansions).map(
  ([tripId, list]) =>
    `  ${JSON.stringify(tripId)}: [\n` +
    list.map((e) => `    ${JSON.stringify(e)}`).join(",\n") +
    `\n  ]`
);
writeFileSync(expansionsPath, `{\n${lines.join(",\n")}\n}\n`);

if (existsSync(legacyPath)) {
  console.log("legacyActivityOrder.json already exists -- left untouched (it's a frozen snapshot).");
} else {
  // Store only the part after "<tripId>." to keep the file small.
  const legacy = {};
  for (const [tripId, list] of Object.entries(expansions)) {
    legacy[tripId] = list.map(([, , id]) => id.slice(tripId.length + 1));
  }
  const legacyLines = Object.entries(legacy).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  writeFileSync(legacyPath, `{\n${legacyLines.join(",\n")}\n}\n`);
  console.log("wrote legacyActivityOrder.json");
}

console.log(`${Object.keys(expansions).length} trips, ${allIds.size} activity ids (${assigned} newly assigned).`);
