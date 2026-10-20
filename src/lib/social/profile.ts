// Phase 26: social profile rules shared by the profile form, the privacy page
// and the profile view. The database (supabase/migrations/0013_social_profiles.sql)
// is the real gate; everything here exists so the form can explain a problem
// before Save instead of after. profile.test.ts keeps the two in sync.

import { PERSONAL_INTERESTS, TRAVEL_INTERESTS } from "@/data/interests";

// ---------------------------------------------------------------------------
// Usernames
// ---------------------------------------------------------------------------

/** Same regex as wn_username_ok() in 0013. 3-30 chars, lowercase letters,
 * digits, '.', '_'; can't start or end with a period. */
export const USERNAME_SHAPE = /^[a-z0-9_][a-z0-9._]{1,28}[a-z0-9_]$/;

export const RESERVED_USERNAMES = [
  "admin", "administrator", "root", "support", "help", "wherenext",
  "semesterly", "moderator", "mod", "staff", "team", "official", "system",
  "null", "undefined", "me", "settings", "profile", "login", "welcome",
  "privacy", "api", "u",
];

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** A plain-English problem with the username, or null if it's well-formed
 * (whether it's *taken* is a separate, live check). */
export function usernameProblem(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length < 3) return "At least 3 characters.";
  if (u.length > 30) return "30 characters at most.";
  if (/[^a-z0-9._]/.test(u)) return "Only letters, numbers, periods and underscores.";
  if (u.startsWith(".") || u.endsWith(".")) return "Can't start or end with a period.";
  if (u.includes("..")) return "No two periods in a row.";
  if (RESERVED_USERNAMES.includes(u)) return "That name is reserved.";
  if (!USERNAME_SHAPE.test(u)) return "Only letters, numbers, periods and underscores.";
  return null;
}

/** Days until a username can be changed again, or 0 if it can be now. Null
 * changed_at = never changed since creation = can change now. */
export function daysUntilUsernameChange(changedAt: string | null, now = new Date()): number {
  if (!changedAt) return 0;
  const next = new Date(changedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  const ms = next - now.getTime();
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
}

// ---------------------------------------------------------------------------
// Profile fields and their visibility keys
// ---------------------------------------------------------------------------

/** Same list and order as wn_profile_fields() in 0013. Name and username are
 * not here: friends always see them. */
export const PROFILE_FIELDS = [
  { key: "photo", label: "Profile photo" },
  { key: "bio", label: "Bio" },
  { key: "gender", label: "Gender" },
  { key: "host_city", label: "Host city" },
  { key: "host_university", label: "Host university" },
  { key: "program", label: "Program or provider" },
  { key: "home_university", label: "Home university" },
  { key: "grad_year", label: "Graduation year" },
  { key: "abroad_dates", label: "Semester dates" },
  { key: "languages", label: "Languages" },
  { key: "budget_level", label: "Budget level" },
  { key: "travel_interests", label: "Travel interests" },
  { key: "personal_interests", label: "Personal interests" },
  { key: "custom_details", label: "Your own details" },
] as const;

export type ProfileFieldKey = (typeof PROFILE_FIELDS)[number]["key"];

export const GENDERS = [
  { value: "man", label: "Man" },
  { value: "woman", label: "Woman" },
  { value: "non_binary", label: "Non-binary" },
  { value: "self_describe", label: "Self-describe" },
  { value: "prefer_not", label: "Prefer not to say" },
] as const;
export type Gender = (typeof GENDERS)[number]["value"];

export const BUDGET_LEVELS = [
  { value: "shoestring", label: "Shoestring" },
  { value: "moderate", label: "Moderate" },
  { value: "comfortable", label: "Comfortable" },
] as const;
export type BudgetLevel = (typeof BUDGET_LEVELS)[number]["value"];

export const AUDIENCES = [
  { value: "friends", label: "Friends" },
  { value: "friends_of_friends", label: "Friends of friends" },
  { value: "verified", label: "Verified students" },
] as const;
export type Audience = (typeof AUDIENCES)[number]["value"];

export const LIMITS = {
  displayName: 60,
  bio: 160,
  genderCustom: 40,
  shortText: 100,
  longText: 120,
  languages: 10,
  languageLen: 40,
  customDetails: 5,
  customLabel: 30,
  customValue: 80,
};

export interface CustomDetail {
  label: string;
  value: string;
}

/** A row of public.public_profiles as the owner reads it. */
export interface PublicProfileRow {
  id: string;
  username: string;
  username_changed_at: string | null;
  display_name: string;
  avatar_path: string | null;
  bio: string;
  gender: Gender | null;
  gender_custom: string | null;
  host_city: string | null;
  host_country: string | null;
  host_university: string | null;
  program: string | null;
  home_university: string | null;
  grad_year: number | null;
  abroad_start: string | null;
  abroad_end: string | null;
  languages: string[];
  budget_level: BudgetLevel | null;
  travel_interests: string[];
  personal_interests: string[];
  custom_details: CustomDetail[];
  adult_confirmed_at: string;
  created_at: string;
  updated_at: string;
}

/** What the profile form edits. Strings are "" when blank. */
export interface ProfileDraft {
  username: string;
  display_name: string;
  bio: string;
  gender: Gender | null;
  gender_custom: string;
  host_city: string;
  host_country: string;
  host_university: string;
  program: string;
  home_university: string;
  grad_year: string;
  abroad_start: string;
  abroad_end: string;
  languages: string[];
  budget_level: BudgetLevel | null;
  travel_interests: string[];
  personal_interests: string[];
  custom_details: CustomDetail[];
}

export const EMPTY_DRAFT: ProfileDraft = {
  username: "",
  display_name: "",
  bio: "",
  gender: null,
  gender_custom: "",
  host_city: "",
  host_country: "",
  host_university: "",
  program: "",
  home_university: "",
  grad_year: "",
  abroad_start: "",
  abroad_end: "",
  languages: [],
  budget_level: null,
  travel_interests: [],
  personal_interests: [],
  custom_details: [],
};

export function rowToDraft(row: PublicProfileRow): ProfileDraft {
  return {
    username: row.username,
    display_name: row.display_name,
    bio: row.bio ?? "",
    gender: row.gender,
    gender_custom: row.gender_custom ?? "",
    host_city: row.host_city ?? "",
    host_country: row.host_country ?? "",
    host_university: row.host_university ?? "",
    program: row.program ?? "",
    home_university: row.home_university ?? "",
    grad_year: row.grad_year ? String(row.grad_year) : "",
    abroad_start: row.abroad_start ?? "",
    abroad_end: row.abroad_end ?? "",
    languages: row.languages ?? [],
    budget_level: row.budget_level,
    travel_interests: row.travel_interests ?? [],
    personal_interests: row.personal_interests ?? [],
    custom_details: row.custom_details ?? [],
  };
}

const blankToNull = (s: string) => (s.trim() ? s.trim() : null);

/** The columns to write. Never includes id/adult_confirmed_at/timestamps --
 * the caller adds id, and the database stamps the rest. */
export function draftToColumns(d: ProfileDraft) {
  const year = d.grad_year.trim() ? Number(d.grad_year.trim()) : null;
  return {
    username: normalizeUsername(d.username),
    display_name: d.display_name.trim(),
    bio: d.bio.trim(),
    gender: d.gender,
    gender_custom: d.gender === "self_describe" ? blankToNull(d.gender_custom) : null,
    host_city: blankToNull(d.host_city),
    host_country: blankToNull(d.host_country),
    host_university: blankToNull(d.host_university),
    program: blankToNull(d.program),
    home_university: blankToNull(d.home_university),
    grad_year: year !== null && Number.isInteger(year) ? year : null,
    abroad_start: blankToNull(d.abroad_start),
    abroad_end: blankToNull(d.abroad_end),
    languages: dedupe(d.languages.map((l) => l.trim()).filter(Boolean)),
    budget_level: d.budget_level,
    travel_interests: dedupe(d.travel_interests),
    personal_interests: dedupe(d.personal_interests),
    custom_details: d.custom_details
      .map((c) => ({ label: c.label.trim(), value: c.value.trim() }))
      .filter((c) => c.label || c.value),
  };
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

export type DraftErrors = Partial<Record<keyof ProfileDraft | "adult", string>>;

/** Everything the database would reject, in words. `isNew` adds the 18+
 * confirmation requirement. */
export function validateDraft(d: ProfileDraft, opts: { isNew: boolean; adultConfirmed: boolean }): DraftErrors {
  const e: DraftErrors = {};
  const c = draftToColumns(d);

  const u = usernameProblem(d.username);
  if (u) e.username = u;
  if (!c.display_name) e.display_name = "Add your name.";
  else if (c.display_name.length > LIMITS.displayName) e.display_name = `${LIMITS.displayName} characters at most.`;
  if (c.bio.length > LIMITS.bio) e.bio = `${LIMITS.bio} characters at most.`;
  if (d.gender === "self_describe" && !c.gender_custom) e.gender_custom = "Describe it in a few words, or pick another option.";
  if (c.gender_custom && c.gender_custom.length > LIMITS.genderCustom) e.gender_custom = `${LIMITS.genderCustom} characters at most.`;

  if (c.host_city && c.host_city.length > LIMITS.shortText) e.host_city = "Too long.";
  if (c.host_university && c.host_university.length > LIMITS.longText) e.host_university = "Too long.";
  if (c.program && c.program.length > LIMITS.longText) e.program = "Too long.";
  if (c.home_university && c.home_university.length > LIMITS.longText) e.home_university = "Too long.";

  if (d.grad_year.trim()) {
    const y = Number(d.grad_year.trim());
    if (!Number.isInteger(y) || y < 1990 || y > 2100) e.grad_year = "Use a 4-digit year.";
  }
  if (c.abroad_start && c.abroad_end && c.abroad_end < c.abroad_start) e.abroad_end = "Ends before it starts.";

  if (c.languages.length > LIMITS.languages) e.languages = `${LIMITS.languages} languages at most.`;
  if (c.languages.some((l) => l.length > LIMITS.languageLen)) e.languages = "One of those is too long.";

  const travel = new Set(TRAVEL_INTERESTS.map((i) => i.slug));
  const personal = new Set(PERSONAL_INTERESTS.map((i) => i.slug));
  if (c.travel_interests.some((s) => !travel.has(s))) e.travel_interests = "Unknown interest.";
  if (c.personal_interests.some((s) => !personal.has(s))) e.personal_interests = "Unknown interest.";

  if (c.custom_details.length > LIMITS.customDetails) e.custom_details = `${LIMITS.customDetails} details at most.`;
  else if (c.custom_details.some((x) => !x.label || !x.value)) e.custom_details = "Each detail needs both a label and an answer.";
  else if (c.custom_details.some((x) => x.label.length > LIMITS.customLabel || x.value.length > LIMITS.customValue))
    e.custom_details = `Labels up to ${LIMITS.customLabel} characters, answers up to ${LIMITS.customValue}.`;

  if (opts.isNew && !opts.adultConfirmed) e.adult = "WhereNext is for people 18 and older.";
  return e;
}

/** Map a Supabase/Postgres error from saving a profile to friendly copy. */
export function profileSaveErrorMessage(err: { code?: string; message?: string } | null): string {
  if (!err) return "Couldn't save. Try again.";
  if (err.message?.includes("WN_USERNAME_CHANGE_TOO_SOON")) return "You can change your username once every 30 days.";
  if (err.code === "23505") return "That username was just taken. Try another.";
  if (err.code === "23514") return "One of the fields isn't valid. Check the highlighted ones and try again.";
  return "Couldn't save. Check your connection and try again.";
}

// ---------------------------------------------------------------------------
// Privacy & settings (public.social_settings)
// ---------------------------------------------------------------------------

export interface SocialSettingsRow {
  id: string;
  visible_fields: ProfileFieldKey[];
  audience: Audience;
  discoverable: boolean;
  suggest_in_host_city: boolean;
  suggest_at_host_university: boolean;
  show_mutual_friends: boolean;
  allow_message_requests: boolean;
  read_receipts: boolean;
  show_active_status: boolean;
  share_free_weekends: boolean;
  show_trips: boolean;
  notify_messages: boolean;
  notify_friend_requests: boolean;
  notify_votes: boolean;
  notify_costs: boolean;
}

export type SettingsFlag = Exclude<keyof SocialSettingsRow, "id" | "visible_fields" | "audience">;

/** Same defaults as the table: private, notifications on. */
export function defaultSettings(id: string): SocialSettingsRow {
  return {
    id,
    visible_fields: [],
    audience: "friends",
    discoverable: false,
    suggest_in_host_city: false,
    suggest_at_host_university: false,
    show_mutual_friends: false,
    allow_message_requests: false,
    read_receipts: false,
    show_active_status: false,
    share_free_weekends: false,
    show_trips: false,
    notify_messages: true,
    notify_friend_requests: true,
    notify_votes: true,
    notify_costs: true,
  };
}

export interface SettingsToggle {
  /** A profile-field key (kind "field") or a settings column (kind "flag"). */
  id: string;
  kind: "field" | "flag";
  label: string;
  hint?: string;
}

export interface SettingsSection {
  title: string;
  toggles: SettingsToggle[];
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    title: "Profile details",
    toggles: PROFILE_FIELDS.map((f) => ({ id: f.key, kind: "field" as const, label: f.label })),
  },
  {
    title: "Discovery",
    toggles: [
      { id: "discoverable", kind: "flag", label: "Appear in search", hint: "Lets people who aren't your friends find your name and username." },
      { id: "suggest_in_host_city", kind: "flag", label: "Suggest me to people in my host city" },
      { id: "suggest_at_host_university", kind: "flag", label: "Suggest me to people at my host university" },
      { id: "show_mutual_friends", kind: "flag", label: "Show mutual friends on my profile" },
    ],
  },
  {
    title: "Messages",
    toggles: [
      { id: "allow_message_requests", kind: "flag", label: "Allow message requests from non-friends" },
      { id: "read_receipts", kind: "flag", label: "Read receipts" },
      { id: "show_active_status", kind: "flag", label: "Show when I'm active" },
    ],
  },
  {
    title: "Calendar",
    toggles: [
      { id: "share_free_weekends", kind: "flag", label: "Share my free weekends with friends" },
      { id: "show_trips", kind: "flag", label: "Show which weekends I'm traveling" },
    ],
  },
  {
    title: "Push notifications",
    toggles: [
      { id: "notify_messages", kind: "flag", label: "Messages" },
      { id: "notify_friend_requests", kind: "flag", label: "Friend requests" },
      { id: "notify_votes", kind: "flag", label: "Votes about to close" },
      { id: "notify_costs", kind: "flag", label: "New costs added" },
    ],
  },
];

export function isToggleOn(s: SocialSettingsRow, t: SettingsToggle): boolean {
  if (t.kind === "field") return s.visible_fields.includes(t.id as ProfileFieldKey);
  return s[t.id as SettingsFlag];
}

/** Returns a new settings object with the given toggles set to `on`. Keeps
 * visible_fields in PROFILE_FIELDS order so saves are stable. */
export function setToggles(s: SocialSettingsRow, toggles: SettingsToggle[], on: boolean): SocialSettingsRow {
  const next: SocialSettingsRow = { ...s };
  const fields = new Set(s.visible_fields);
  for (const t of toggles) {
    if (t.kind === "field") {
      if (on) fields.add(t.id as ProfileFieldKey);
      else fields.delete(t.id as ProfileFieldKey);
    } else {
      next[t.id as SettingsFlag] = on;
    }
  }
  next.visible_fields = PROFILE_FIELDS.map((f) => f.key).filter((k) => fields.has(k));
  return next;
}

// ---------------------------------------------------------------------------
// What get_public_profile() returns: only the fields this viewer may see.
// ---------------------------------------------------------------------------

export type ViewerAccess = "self" | "friend" | "friend_of_friend" | "stranger";

export interface ProfileView {
  id: string;
  username: string;
  display_name: string;
  access: ViewerAccess;
  /** Signed up with a university email (0014). Always present, whatever the
   * privacy settings -- it's a fact about the account, not a profile field. */
  verified?: boolean;
  avatar_path?: string | null;
  bio?: string;
  gender?: Gender | null;
  gender_custom?: string | null;
  host_city?: string | null;
  host_country?: string | null;
  host_university?: string | null;
  program?: string | null;
  home_university?: string | null;
  grad_year?: number | null;
  abroad_start?: string | null;
  abroad_end?: string | null;
  languages?: string[];
  budget_level?: BudgetLevel | null;
  travel_interests?: string[];
  personal_interests?: string[];
  custom_details?: CustomDetail[];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function genderLabel(v: ProfileView): string | null {
  if (!v.gender) return null;
  if (v.gender === "self_describe") return v.gender_custom ?? null;
  if (v.gender === "prefer_not") return null;
  return GENDERS.find((g) => g.value === v.gender)?.label ?? null;
}

/** "Spring 2027" style label for a semester, from the month it starts:
 * Jan-May spring, Jun-Jul summer, Aug-Dec fall. */
export function termLabel(start: string | null | undefined): string | null {
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  const s = new Date(start + "T00:00:00Z");
  const m = s.getUTCMonth();
  const season = m <= 4 ? "Spring" : m <= 6 ? "Summer" : "Fall";
  return `${season} ${s.getUTCFullYear()}`;
}
