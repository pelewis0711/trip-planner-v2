import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Enforces the rules written at the top of src/lib/supabase/service.ts, so a
// violation fails the suite instead of shipping a database password to the
// browser. A comment can be ignored; this can't.
//
// What this does NOT prove: that the deployed bundle is clean. That's checked
// separately by building with a sentinel value and grepping .next/static --
// see the note in 0010_revoke_anon_cache_writes.sql's rollout instructions.

const root = process.cwd();
const srcDir = join(root, "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx|mjs|js)$/.test(entry) ? [full] : [];
  });
}

const files = walk(srcDir).map((f) => ({
  path: relative(root, f),
  text: readFileSync(f, "utf8"),
}));

const importsService = files.filter(
  (f) =>
    !f.path.includes("__tests__") &&
    /from\s+["'](@\/lib\/supabase\/service|\.\/service|\.\.\/service)["']/.test(f.text)
);

const isClientComponent = (text: string) => /^\s*["']use client["']/m.test(text);

describe("service-role client stays server-only", () => {
  it("is imported by at least one file (the test is actually checking something)", () => {
    expect(importsService.length).toBeGreaterThan(0);
  });

  it("is never imported by a client component", () => {
    const offenders = importsService.filter((f) => isClientComponent(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("is only imported by server route handlers under src/app/api/", () => {
    const offenders = importsService
      .map((f) => f.path)
      .filter((p) => !p.startsWith("src/app/api/"));
    expect(offenders).toEqual([]);
  });

  // Match real env access, not prose: service.ts's own banner and this file
  // both name the forbidden NEXT_PUBLIC_ form in order to warn about it.
  it("the service key is never actually read via a NEXT_PUBLIC_ prefix", () => {
    const offenders = files
      .filter((f) => /process\.env\.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("no client component reads the service key from the environment", () => {
    const offenders = files
      .filter((f) => isClientComponent(f.text) && /process\.env\.\w*SUPABASE_SERVICE_ROLE_KEY/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe("price-cache write path uses the service client", () => {
  const flight = readFileSync(join(root, "src/app/api/flights/price/route.ts"), "utf8");
  const hotel = readFileSync(join(root, "src/app/api/hotels/price/route.ts"), "utf8");

  it("flight route upserts via the service client, not the request client", () => {
    expect(flight).toMatch(/createServiceClient\(\)[\s\S]*upsert_flight_price/);
    expect(flight).not.toMatch(/supabase\.rpc\(\s*["']upsert_flight_price/);
  });

  it("hotel route upserts via the service client, not the request client", () => {
    expect(hotel).toMatch(/createServiceClient\(\)[\s\S]*upsert_hotel_price/);
    expect(hotel).not.toMatch(/supabase\.rpc\(\s*["']upsert_hotel_price/);
  });

  // The reads were never the problem -- the cache is meant to be public.
  it("both routes still read the cache with the ordinary request client", () => {
    expect(flight).toMatch(/supabase[\s\S]*from\("flight_price_cache"\)/);
    expect(hotel).toMatch(/supabase[\s\S]*from\("hotel_price_cache"\)/);
  });
});

describe("0010 actually removes the anon write grant", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/0010_revoke_anon_cache_writes.sql"),
    "utf8"
  );

  // Postgres grants EXECUTE to PUBLIC by default and anon/authenticated inherit
  // it, so revoking only the named roles would leave the function callable and
  // this migration would silently accomplish nothing.
  it("revokes from public as well as anon and authenticated", () => {
    for (const fn of ["upsert_flight_price", "upsert_hotel_price"]) {
      const stmt = migration.slice(migration.indexOf(`revoke execute on function public.${fn}`));
      const body = stmt.slice(0, stmt.indexOf(";"));
      expect(body).toContain("public");
      expect(body).toContain("anon");
      expect(body).toContain("authenticated");
    }
  });

  it("grants execute to service_role so the API routes still work", () => {
    expect(migration).toMatch(/grant execute on function public\.upsert_flight_price[\s\S]*?to service_role/);
    expect(migration).toMatch(/grant execute on function public\.upsert_hotel_price[\s\S]*?to service_role/);
  });

  // Checked against executable DDL, not prose -- the migration's comments
  // discuss the read policies in order to say they're deliberately untouched.
  it("leaves the public read policies alone (no policy DDL at all)", () => {
    const statements = migration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(statements).not.toMatch(/\b(create|drop|alter)\s+policy\b/i);
    expect(statements).not.toMatch(/\brow level security\b/i);
  });
});

describe(".env.example documents the key as server-only", () => {
  const example = readFileSync(join(root, ".env.example"), "utf8");

  it("includes the variable, unprefixed", () => {
    expect(example).toMatch(/^SUPABASE_SERVICE_ROLE_KEY=/m);
    expect(example).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  });

  it("warns that it bypasses RLS", () => {
    expect(example).toMatch(/BYPASSES ROW LEVEL SECURITY/i);
  });
});
