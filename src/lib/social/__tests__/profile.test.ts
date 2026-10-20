import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PERSONAL_INTERESTS, TRAVEL_INTERESTS } from "@/data/interests";
import {
  EMPTY_DRAFT,
  PROFILE_FIELDS,
  RESERVED_USERNAMES,
  SETTINGS_SECTIONS,
  USERNAME_SHAPE,
  daysUntilUsernameChange,
  defaultSettings,
  draftToColumns,
  initials,
  isToggleOn,
  normalizeUsername,
  profileSaveErrorMessage,
  setToggles,
  termLabel,
  usernameProblem,
  validateDraft,
  type ProfileDraft,
} from "@/lib/social/profile";

// The form's copy of the rules in supabase/migrations/0013_social_profiles.sql.
// The database is the real gate; these keep the two from quietly disagreeing.
const migration = readFileSync(join(process.cwd(), "supabase/migrations/0013_social_profiles.sql"), "utf8");

/** The quoted strings inside `create or replace function public.<name>() ... array[ ... ]`. */
function sqlList(fn: string): string[] {
  const start = migration.indexOf(`function public.${fn}()`);
  expect(start, `${fn} not found in 0013`).toBeGreaterThan(-1);
  const body = migration.slice(start, migration.indexOf("$$;", start));
  const arr = body.slice(body.indexOf("array["), body.indexOf("]::text[]"));
  return Array.from(arr.matchAll(/'([^']+)'/g), (m) => m[1]);
}

describe("app lists match the database", () => {
  it("travel interests", () => {
    expect(TRAVEL_INTERESTS.map((i) => i.slug)).toEqual(sqlList("wn_travel_interests"));
  });
  it("personal interests", () => {
    expect(PERSONAL_INTERESTS.map((i) => i.slug)).toEqual(sqlList("wn_personal_interests"));
  });
  it("profile field keys", () => {
    expect(PROFILE_FIELDS.map((f) => f.key)).toEqual(sqlList("wn_profile_fields"));
  });
  it("reserved usernames", () => {
    expect(RESERVED_USERNAMES).toEqual(sqlList("wn_reserved_usernames"));
  });
  it("username regex", () => {
    expect(migration).toContain(`p ~ '${USERNAME_SHAPE.source}'`);
  });
  it("labels are unique and slugs are lowercase", () => {
    for (const list of [TRAVEL_INTERESTS, PERSONAL_INTERESTS]) {
      expect(new Set(list.map((i) => i.label)).size).toBe(list.length);
      for (const i of list) expect(i.slug).toMatch(/^[a-z_]+$/);
    }
  });
  it("every profile field has exactly one privacy toggle, and every flag is a real column", () => {
    const fieldToggles = SETTINGS_SECTIONS.flatMap((s) => s.toggles).filter((t) => t.kind === "field");
    expect(fieldToggles.map((t) => t.id)).toEqual(PROFILE_FIELDS.map((f) => f.key));
    const flags = SETTINGS_SECTIONS.flatMap((s) => s.toggles).filter((t) => t.kind === "flag");
    for (const f of flags) expect(migration).toMatch(new RegExp(`\\n\\s+${f.id} boolean not null default`));
    const defaults = defaultSettings("x");
    for (const f of flags) expect(typeof defaults[f.id as keyof typeof defaults]).toBe("boolean");
  });
});

describe("usernames", () => {
  it.each<[string, string | null]>([
    ["parkerl", null],
    ["parker.lewis", null],
    ["p_l", null],
    ["  @ParkerL ", null], // trimmed, @ stripped, lowercased
    ["ab", "At least 3 characters."],
    ["a".repeat(31), "30 characters at most."],
    ["parker!", "Only letters, numbers, periods and underscores."],
    ["parker lewis", "Only letters, numbers, periods and underscores."],
    [".parker", "Can't start or end with a period."],
    ["parker.", "Can't start or end with a period."],
    ["par..ker", "No two periods in a row."],
    ["admin", "That name is reserved."],
    ["Support", "That name is reserved."],
  ])("%j -> %j", (raw, problem) => {
    expect(usernameProblem(raw)).toBe(problem);
  });

  it("every name the form accepts passes the SQL-shaped regex", () => {
    for (const u of ["abc", "a.b", "a_b", "x12", "a".repeat(30), "a.b.c", "_ab_"]) {
      expect(usernameProblem(u)).toBeNull();
      expect(USERNAME_SHAPE.test(normalizeUsername(u))).toBe(true);
    }
  });

  it("30-day change window", () => {
    const now = new Date("2027-02-10T12:00:00Z");
    expect(daysUntilUsernameChange(null, now)).toBe(0);
    expect(daysUntilUsernameChange("2027-02-09T12:00:00Z", now)).toBe(29);
    expect(daysUntilUsernameChange("2027-01-10T12:00:00Z", now)).toBe(0);
    expect(daysUntilUsernameChange("2027-01-12T12:00:00Z", now)).toBe(1);
  });
});

describe("validateDraft", () => {
  const good: ProfileDraft = { ...EMPTY_DRAFT, username: "parkerl", display_name: "Parker Lewis" };

  it("a minimal profile is valid once 18+ is confirmed", () => {
    expect(validateDraft(good, { isNew: true, adultConfirmed: true })).toEqual({});
  });
  it("creating requires the 18+ confirmation; editing doesn't", () => {
    expect(validateDraft(good, { isNew: true, adultConfirmed: false }).adult).toBeTruthy();
    expect(validateDraft(good, { isNew: false, adultConfirmed: false }).adult).toBeUndefined();
  });
  it("catches each database rule", () => {
    const e = validateDraft(
      {
        ...good,
        username: "a",
        display_name: "  ",
        bio: "x".repeat(161),
        gender: "self_describe",
        gender_custom: "",
        grad_year: "28",
        abroad_start: "2027-05-01",
        abroad_end: "2027-01-01",
        languages: Array.from({ length: 11 }, (_, i) => `L${i}`),
        travel_interests: ["skydiving"],
        custom_details: [{ label: "Dream trip", value: "" }],
      },
      { isNew: false, adultConfirmed: true }
    );
    expect(Object.keys(e).sort()).toEqual(
      ["abroad_end", "bio", "custom_details", "display_name", "gender_custom", "grad_year", "languages", "travel_interests", "username"].sort()
    );
  });
  it("more than 5 custom details", () => {
    const six = Array.from({ length: 6 }, () => ({ label: "a", value: "b" }));
    expect(validateDraft({ ...good, custom_details: six }, { isNew: false, adultConfirmed: true }).custom_details).toBeTruthy();
  });
});

describe("draftToColumns", () => {
  it("normalizes what gets written", () => {
    const c = draftToColumns({
      ...EMPTY_DRAFT,
      username: " @ParkerL ",
      display_name: " Parker ",
      gender: "man",
      gender_custom: "ignored unless self-describe",
      host_city: "  ",
      grad_year: "2028",
      languages: ["English", " English ", ""],
      travel_interests: ["food", "food"],
      custom_details: [
        { label: " Dream trip ", value: " Marrakech " },
        { label: "", value: "" },
      ],
    });
    expect(c.username).toBe("parkerl");
    expect(c.display_name).toBe("Parker");
    expect(c.gender_custom).toBeNull();
    expect(c.host_city).toBeNull();
    expect(c.grad_year).toBe(2028);
    expect(c.languages).toEqual(["English"]);
    expect(c.travel_interests).toEqual(["food"]);
    expect(c.custom_details).toEqual([{ label: "Dream trip", value: "Marrakech" }]);
    expect("id" in c || "adult_confirmed_at" in c).toBe(false);
  });
});

describe("privacy toggles", () => {
  it("everything starts off except notifications", () => {
    const s = defaultSettings("x");
    for (const sec of SETTINGS_SECTIONS) {
      for (const t of sec.toggles) {
        expect(isToggleOn(s, t)).toBe(sec.title === "Push notifications");
      }
    }
    expect(s.audience).toBe("friends");
  });
  it("Show all turns a whole section on and off, fields stay in a stable order", () => {
    const profile = SETTINGS_SECTIONS[0];
    let s = setToggles(defaultSettings("x"), [profile.toggles[5], profile.toggles[0]], true);
    expect(s.visible_fields).toEqual(["photo", "program"]);
    s = setToggles(s, profile.toggles, true);
    expect(s.visible_fields).toEqual(PROFILE_FIELDS.map((f) => f.key));
    s = setToggles(s, profile.toggles, false);
    expect(s.visible_fields).toEqual([]);
    const discovery = SETTINGS_SECTIONS[1];
    s = setToggles(s, discovery.toggles, true);
    expect(s.discoverable && s.suggest_in_host_city && s.show_mutual_friends).toBe(true);
  });
});

describe("display helpers", () => {
  it("initials", () => {
    expect(initials("Parker Lewis")).toBe("PL");
    expect(initials("Maya")).toBe("M");
    expect(initials("  ")).toBe("?");
  });
  it("term label from start month", () => {
    expect(termLabel("2027-01-24")).toBe("Spring 2027");
    expect(termLabel("2026-08-30")).toBe("Fall 2026");
    expect(termLabel("2027-06-15")).toBe("Summer 2027");
    expect(termLabel(null)).toBeNull();
    expect(termLabel("garbage")).toBeNull();
  });
  it("save errors map to friendly copy", () => {
    expect(profileSaveErrorMessage({ message: "WN_USERNAME_CHANGE_TOO_SOON: x" })).toMatch(/30 days/);
    expect(profileSaveErrorMessage({ code: "23505" })).toMatch(/taken/);
    expect(profileSaveErrorMessage({ code: "23514" })).toMatch(/isn't valid/);
    expect(profileSaveErrorMessage(null)).toMatch(/Couldn't save/);
  });
});
