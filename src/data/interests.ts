// Phase 26: the two fixed interest lists for social profiles. Parker curates
// these; there's deliberately no free-text "other" so search filters stay
// clean.
//
// The slugs MUST match wn_travel_interests() / wn_personal_interests() in
// supabase/migrations/0013_social_profiles.sql -- the database rejects any
// slug not on its list. src/lib/social/__tests__/profile.test.ts fails if the
// two drift. To add one: add it here AND in the SQL function (a new migration
// with `create or replace function ...`), then run that SQL.

export interface Interest {
  slug: string;
  label: string;
}

export const TRAVEL_INTERESTS: Interest[] = [
  { slug: "food", label: "Food" },
  { slug: "history", label: "History" },
  { slug: "nightlife", label: "Nightlife" },
  { slug: "museums", label: "Museums" },
  { slug: "architecture", label: "Architecture" },
  { slug: "hiking", label: "Hiking" },
  { slug: "beaches", label: "Beaches" },
  { slug: "day_trips", label: "Day trips" },
  { slug: "festivals", label: "Festivals" },
  { slug: "sports_events", label: "Sports events" },
  { slug: "art", label: "Art" },
  { slug: "live_music", label: "Live music" },
  { slug: "markets", label: "Markets" },
  { slug: "photography", label: "Photography" },
];

export const PERSONAL_INTERESTS: Interest[] = [
  { slug: "fitness", label: "Fitness" },
  { slug: "running", label: "Running" },
  { slug: "soccer", label: "Soccer" },
  { slug: "basketball", label: "Basketball" },
  { slug: "wrestling", label: "Wrestling" },
  { slug: "cooking", label: "Cooking" },
  { slug: "coffee", label: "Coffee" },
  { slug: "finance", label: "Finance" },
  { slug: "tech", label: "Tech" },
  { slug: "reading", label: "Reading" },
  { slug: "film", label: "Film" },
  { slug: "music", label: "Music" },
  { slug: "gaming", label: "Gaming" },
  { slug: "fashion", label: "Fashion" },
  { slug: "theater", label: "Theater" },
  { slug: "volunteering", label: "Volunteering" },
];

const LABELS = new Map([...TRAVEL_INTERESTS, ...PERSONAL_INTERESTS].map((i) => [i.slug, i.label]));

export function interestLabel(slug: string): string {
  return LABELS.get(slug) ?? slug;
}
