// Phase 5 trip discovery: the LLM-facing shape (used for structured outputs)
// and strict server-side validation/conversion into the app's internal Trip
// type. Kept deliberately more explicit than the internal Trip type (named
// object fields instead of [name, price] tuples) since structured-outputs
// JSON schema doesn't support fixed-length tuples well -- converting after
// validation sidesteps that instead of fighting the schema format.
import type { Trip } from "@/data/trips";

export const TRIP_TYPES = ["history", "scenic", "beach", "nightlife"] as const;
export const WEATHER_VALUES = ["Warm", "Mild", "Cool", "Cold", "Rainy"] as const;

export const DISCOVERY_JSON_SCHEMA = {
  type: "object",
  properties: {
    trips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "City or place name" },
          country: { type: "string" },
          region: {
            type: "string",
            description: "Region grouping, reusing one of the existing regions listed in the prompt whenever it fits",
          },
          lat: { type: "number" },
          lon: { type: "number" },
          types: {
            type: "array",
            items: { type: "string", enum: [...TRIP_TYPES] },
            description: "1-2 of: history, scenic, beach, nightlife",
          },
          categories: {
            type: "array",
            items: { type: "string" },
            description: "2-6 short activity-type tags, e.g. 'Historic sites', 'Food & markets'",
          },
          bestMonths: {
            type: "array",
            items: { type: "integer" },
            description: "Month numbers 1-12 this trip is best visited",
          },
          suggestedNights: { type: "integer", description: "0 for a day trip" },
          costIndex: { type: "integer", description: "1 (cheapest) to 5 (most expensive)" },
          weather: { type: "string", enum: [...WEATHER_VALUES] },
          blurb: { type: "string", description: "1-2 sentence description" },
          activities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                price: { type: "number", description: "USD per person, 0 if free" },
              },
              required: ["name", "price"],
              additionalProperties: false,
            },
            description: "2-5 signature activities with realistic per-person USD prices",
          },
          signatureFoods: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                price: { type: "number" },
              },
              required: ["name", "price"],
              additionalProperties: false,
            },
            description: "2-4 signature foods/dishes with realistic per-person USD prices",
          },
        },
        required: [
          "name", "country", "region", "lat", "lon", "types", "categories",
          "bestMonths", "suggestedNights", "costIndex", "weather", "blurb",
          "activities", "signatureFoods",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["trips"],
  additionalProperties: false,
} as const;

export interface RejectedTrip {
  name: string;
  reason: string;
}

function slugify(name: string, country: string): string {
  const base = `${name}-${country}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `custom-${base || "trip"}`;
}

/** Validates one raw LLM-proposed trip and converts it to the app's
 * internal Trip shape, or returns a rejection reason. Never trusts the
 * schema alone -- structured outputs constrains shape, not semantics
 * (a "costIndex" of 47 is valid JSON but not a valid cost tier). */
export function validateAndConvertTrip(
  raw: unknown,
  existingIds: Set<string>,
  existingNameCountry: Set<string>
): { trip: Trip } | { error: RejectedTrip } {
  const name = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).name : undefined;
  const label = typeof name === "string" && name.trim() ? name.trim() : "(unnamed)";

  if (typeof raw !== "object" || raw === null) {
    return { error: { name: label, reason: "not an object" } };
  }
  const r = raw as Record<string, unknown>;

  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  const nameV = str("name");
  const countryV = str("country");
  const regionV = str("region");
  const weatherV = str("weather");
  const blurbV = str("blurb");

  if (!nameV) return { error: { name: label, reason: "missing/empty name" } };
  if (!countryV) return { error: { name: label, reason: "missing/empty country" } };
  if (!regionV) return { error: { name: label, reason: "missing/empty region" } };
  if (!blurbV) return { error: { name: label, reason: "missing/empty blurb" } };
  if (!(WEATHER_VALUES as readonly string[]).includes(weatherV)) {
    return { error: { name: label, reason: `weather "${weatherV}" not one of ${WEATHER_VALUES.join("/")}` } };
  }

  const lat = r.lat;
  const lon = r.lon;
  if (typeof lat !== "number" || lat < -90 || lat > 90 || Number.isNaN(lat)) {
    return { error: { name: label, reason: `invalid lat: ${String(lat)}` } };
  }
  if (typeof lon !== "number" || lon < -180 || lon > 180 || Number.isNaN(lon)) {
    return { error: { name: label, reason: `invalid lon: ${String(lon)}` } };
  }

  const types = Array.isArray(r.types) ? r.types.filter((t): t is string => typeof t === "string") : [];
  const validTypes = types.filter((t) => (TRIP_TYPES as readonly string[]).includes(t));
  if (!validTypes.length) {
    return { error: { name: label, reason: `no valid types in ${JSON.stringify(r.types)}` } };
  }

  const categories = Array.isArray(r.categories)
    ? r.categories.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : [];
  if (!categories.length) return { error: { name: label, reason: "no categories" } };

  const bestMonths = Array.isArray(r.bestMonths)
    ? r.bestMonths.filter((m): m is number => typeof m === "number" && Number.isInteger(m) && m >= 1 && m <= 12)
    : [];
  if (!bestMonths.length) return { error: { name: label, reason: `no valid bestMonths in ${JSON.stringify(r.bestMonths)}` } };

  const nights = r.suggestedNights;
  if (typeof nights !== "number" || !Number.isInteger(nights) || nights < 0 || nights > 14) {
    return { error: { name: label, reason: `invalid suggestedNights: ${String(nights)}` } };
  }

  const ci = r.costIndex;
  if (typeof ci !== "number" || !Number.isInteger(ci) || ci < 1 || ci > 5) {
    return { error: { name: label, reason: `invalid costIndex: ${String(ci)}` } };
  }

  function items(field: unknown): [string, number][] | null {
    if (!Array.isArray(field) || !field.length) return null;
    const out: [string, number][] = [];
    for (const it of field) {
      if (typeof it !== "object" || it === null) return null;
      const io = it as Record<string, unknown>;
      const n = typeof io.name === "string" ? io.name.trim() : "";
      const p = io.price;
      if (!n || typeof p !== "number" || p < 0 || Number.isNaN(p)) return null;
      out.push([n, Math.round(p)]);
    }
    return out;
  }

  const activities = items(r.activities);
  if (!activities) return { error: { name: label, reason: "invalid or empty activities" } };
  const signatureFoods = items(r.signatureFoods);
  if (!signatureFoods) return { error: { name: label, reason: "invalid or empty signatureFoods" } };

  const nameCountryKey = `${nameV.toLowerCase()}|${countryV.toLowerCase()}`;
  if (existingNameCountry.has(nameCountryKey)) {
    return { error: { name: label, reason: "already in the catalog (or already discovered)" } };
  }

  let id = slugify(nameV, countryV);
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${slugify(nameV, countryV)}-${suffix}`;
    suffix++;
  }

  const trip: Trip = {
    id,
    n: nameV,
    c: countryV,
    reg: regionV,
    co: [lat, lon],
    t: validTypes,
    cats: categories,
    m: bestMonths,
    g: nights,
    ci,
    wx: weatherV,
    w: blurbV,
    a: activities,
    f: signatureFoods,
  };
  return { trip };
}
