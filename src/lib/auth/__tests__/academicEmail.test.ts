import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACADEMIC_DOMAIN_PATTERNS,
  DOMAIN_SHAPE,
  PATTERN_SHAPE,
  classifySignupError,
  emailDomain,
  isAcademicEmail,
} from "@/lib/auth/academicEmail";

// The login form's copy of the rule in
// supabase/migrations/0012_require_academic_email.sql. The database is the real
// gate; these tests keep the two from quietly disagreeing.

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0012_require_academic_email.sql"),
  "utf8"
);

describe("isAcademicEmail", () => {
  // The cases EDU_EMAIL_GATE.md requires, verbatim.
  it.each<[string | null | undefined, boolean]>([
    ["pel4@illinois.edu", true],
    ["x@ox.ac.uk", true],
    ["x@student.uva.nl", true],
    ["x@aauni.edu", true],
    ["x@gmail.com", false],
    ["x@illinois.edu.attacker.com", false], // the one that matters: lookalike subdomain
    ["x@edu", false], // bare TLD, no school
    ["X@ILLINOIS.EDU", true], // case
    [" x@illinois.edu ", true], // whitespace
    ["x@y@illinois.edu", true], // last @ wins
    ["notanemail", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("%j -> %s", (email, expected) => {
    expect(isAcademicEmail(email)).toBe(expected);
  });

  it.each<[string, boolean]>([
    ["x@uva.nl", true], // a school pattern matches its own domain exactly...
    ["x@notuva.nl", false], // ...but not a domain that merely ends in the same letters
    ["x@mail.mcgill.ca", true],
    ["x@mcgill.ca.evil.com", false],
    ["x@illinois.edu.", false], // trailing dot: malformed
    ["x@illinois..edu", false], // empty label: malformed
    ["@illinois.edu", false], // nothing before the @
    ["x@", false],
    ["x@illinois.edu\n", true], // edge whitespace is trimmed like the SQL's btrim
    ["x@em-lyon.com", true],
  ])("lookalikes and edge cases: %j -> %s", (email, expected) => {
    expect(isAcademicEmail(email)).toBe(expected);
  });

  it("uses the pattern list it is given (the live table), not only the bundled one", () => {
    expect(isAcademicEmail("x@newschool.fr")).toBe(false);
    expect(isAcademicEmail("x@newschool.fr", ["newschool.fr"])).toBe(true);
    expect(isAcademicEmail("x@illinois.edu", ["newschool.fr"])).toBe(false);
  });

  it("extracts the domain after the last @, lowercased", () => {
    expect(emailDomain("x@y@Student.UvA.nl")).toBe("student.uva.nl");
    expect(emailDomain("no-at-sign")).toBeNull();
  });
});

describe("bundled fallback list vs. the migration", () => {
  const seedBlock = migration.match(
    /insert into public\.academic_domains \(pattern, label\) values([\s\S]*?)on conflict/
  );
  const seededPatterns = [...(seedBlock?.[1] ?? "").matchAll(/\(\s*'([^']+)'\s*,/g)].map((m) => m[1]);

  it("has exactly the same patterns as the SQL seed", () => {
    expect(seededPatterns.length).toBeGreaterThan(90);
    expect([...ACADEMIC_DOMAIN_PATTERNS].sort()).toEqual([...seededPatterns].sort());
  });

  it("has no duplicates, and every pattern passes the table's CHECK constraint", () => {
    expect(new Set(ACADEMIC_DOMAIN_PATTERNS).size).toBe(ACADEMIC_DOMAIN_PATTERNS.length);
    for (const pattern of ACADEMIC_DOMAIN_PATTERNS) expect(pattern).toMatch(PATTERN_SHAPE);
  });

  it("uses the same domain regex and pattern regex as the SQL", () => {
    expect(migration).toContain(`if v_domain !~ '${DOMAIN_SHAPE.source}' then`);
    expect(migration).toContain(`pattern ~ '${PATTERN_SHAPE.source}'`);
  });
});

describe("classifySignupError", () => {
  it("recognizes the hook's tagged message", () => {
    expect(
      classifySignupError(
        "SEMESTERLY_NOT_ACADEMIC_EMAIL: new Semesterly accounts need a university email address."
      )
    ).toBe("not_academic");
  });

  it("treats Supabase's generic new-user failure as a hedged signup failure", () => {
    expect(classifySignupError("Database error saving new user")).toBe("signup_failed");
  });

  it("leaves unrelated errors alone", () => {
    expect(classifySignupError("Email rate limit exceeded")).toBeNull();
    expect(classifySignupError(null)).toBeNull();
    expect(classifySignupError("")).toBeNull();
  });
});
