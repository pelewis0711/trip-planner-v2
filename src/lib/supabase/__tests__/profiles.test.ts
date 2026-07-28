import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchProfileEmails, fetchSharedOwnerEmail } from "../profiles";

// Covers the TypeScript side of 0009_lock_down_profiles.sql, plus source-level
// guards so the user-enumeration hole can't be reopened by accident.
//
// What this does NOT cover, stated plainly: the RLS policy itself. Vitest runs
// in a plain node environment with no database, so nothing here proves Postgres
// actually refuses a stranger's profile read -- that has to be checked against
// a real Supabase instance as two different users. These tests only prove the
// client code calls the right thing and degrades safely.

type Row = { id: string; email: string | null };

interface FakeOpts {
  rows?: Row[];
  selectError?: boolean;
  rpcData?: string | null;
  rpcError?: boolean;
}

interface Spy {
  queriedIds?: string[];
  rpcName?: string;
  rpcArgs?: Record<string, unknown>;
  queried: boolean;
}

/** Minimal stand-in for the only two client shapes these helpers use:
 *   supabase.from(t).select(c).in(col, vals) -> { data, error }
 *   supabase.rpc(fn, args)                   -> { data, error }  */
function fakeClient(opts: FakeOpts, spy: Spy): SupabaseClient {
  const client = {
    from: () => ({
      select: () => ({
        in: (...args: unknown[]) => {
          spy.queried = true;
          spy.queriedIds = args[1] as string[];
          return Promise.resolve({
            data: opts.selectError ? null : (opts.rows ?? []),
            error: opts.selectError ? { message: "denied" } : null,
          });
        },
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      spy.rpcName = fn;
      spy.rpcArgs = args;
      return Promise.resolve({
        data: opts.rpcError ? null : (opts.rpcData ?? null),
        error: opts.rpcError ? { message: "denied" } : null,
      });
    },
  };
  return client as unknown as SupabaseClient;
}

const newSpy = (): Spy => ({ queried: false });

describe("fetchProfileEmails", () => {
  it("returns an empty map and never queries when given no ids", async () => {
    const spy = newSpy();
    const out = await fetchProfileEmails(fakeClient({}, spy), []);
    expect(out.size).toBe(0);
    expect(spy.queried).toBe(false);
  });

  it("de-duplicates ids and drops empty ones before querying", async () => {
    const spy = newSpy();
    await fetchProfileEmails(fakeClient({ rows: [] }, spy), ["a", "a", "", "b"]);
    expect(spy.queriedIds).toEqual(["a", "b"]);
  });

  it("maps returned rows to id -> email", async () => {
    const spy = newSpy();
    const out = await fetchProfileEmails(
      fakeClient({ rows: [{ id: "a", email: "a@x.com" }, { id: "b", email: "b@x.com" }] }, spy),
      ["a", "b"]
    );
    expect(out.get("a")).toBe("a@x.com");
    expect(out.get("b")).toBe("b@x.com");
  });

  // The 0009 policy returns *fewer* rows than were asked for rather than
  // erroring, so a caller asking about someone it turns out not to share a
  // plan with must simply see that id missing -- not a crash.
  it("silently omits ids the narrowed policy withholds", async () => {
    const spy = newSpy();
    const out = await fetchProfileEmails(
      fakeClient({ rows: [{ id: "a", email: "a@x.com" }] }, spy),
      ["a", "stranger"]
    );
    expect(out.get("a")).toBe("a@x.com");
    expect(out.has("stranger")).toBe(false);
    expect(out.get("stranger") ?? null).toBeNull();
  });

  it("returns an empty map instead of throwing when the query is refused", async () => {
    const spy = newSpy();
    const out = await fetchProfileEmails(fakeClient({ selectError: true }, spy), ["a"]);
    expect(out.size).toBe(0);
  });
});

describe("fetchSharedOwnerEmail", () => {
  it("calls the token-scoped RPC and returns the owner's email", async () => {
    const spy = newSpy();
    const email = await fetchSharedOwnerEmail(fakeClient({ rpcData: "owner@x.com" }, spy), "tok123");
    expect(email).toBe("owner@x.com");
    expect(spy.rpcName).toBe("get_shared_plan_owner_email");
    expect(spy.rpcArgs).toEqual({ p_token: "tok123" });
  });

  it("returns null for an unknown or expired token", async () => {
    const spy = newSpy();
    expect(await fetchSharedOwnerEmail(fakeClient({ rpcData: null }, spy), "nope")).toBeNull();
  });

  it("returns null instead of throwing when the RPC is refused (e.g. signed out)", async () => {
    const spy = newSpy();
    expect(await fetchSharedOwnerEmail(fakeClient({ rpcError: true }, spy), "tok")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Regression guards. These read the real files -- cheap insurance that the
// permissive policy doesn't come back and the share page doesn't quietly go
// back to reading the profiles table directly.
// ---------------------------------------------------------------------------

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/0009_lock_down_profiles.sql"), "utf8");
const sharePage = readFileSync(join(root, "src/app/shared/[token]/page.tsx"), "utf8");

describe("pre-launch: profiles table is not world-readable", () => {
  it("0009 drops the permissive policy from 0002", () => {
    expect(migration).toContain('drop policy if exists "Authenticated users can view profiles" on profiles');
  });

  it("the replacement policy is scoped to self or shared-plan members, not using (true)", () => {
    const policy = migration.slice(migration.indexOf('create policy "Users can view own and shared-plan profiles"'));
    const body = policy.slice(0, policy.indexOf(";"));
    expect(body).toContain("id = auth.uid()");
    expect(body).toContain("shares_plan_with(id)");
    expect(body.replace(/\s+/g, " ")).not.toContain("using ( true )");
    expect(body).not.toMatch(/using\s*\(\s*true\s*\)/);
  });

  it("keeps the policy scoped to authenticated, so signed-out visitors still see nothing", () => {
    const policy = migration.slice(migration.indexOf('create policy "Users can view own and shared-plan profiles"'));
    expect(policy.slice(0, policy.indexOf(";"))).toContain("to authenticated");
  });

  // Postgres grants EXECUTE to PUBLIC by default and Supabase's anon role
  // inherits it, so the revoke is what actually keeps anon out -- not the grant.
  it("revokes the new functions from public/anon before granting to authenticated", () => {
    expect(migration).toContain("revoke execute on function public.shares_plan_with(uuid) from public, anon");
    expect(migration).toContain(
      "revoke execute on function public.get_shared_plan_owner_email(text) from public, anon"
    );
    expect(migration).toContain("grant execute on function public.get_shared_plan_owner_email(text) to authenticated");
  });

  it("the owner-email RPC returns a single email, not a set of rows", () => {
    const fn = migration.slice(migration.indexOf("create or replace function public.get_shared_plan_owner_email"));
    expect(fn).toContain("returns text");
    expect(fn).toContain("security definer");
    expect(fn).toContain("limit 1");
  });

  it("the share page uses the token-scoped helper, not a direct profiles read", () => {
    expect(sharePage).toContain("fetchSharedOwnerEmail");
    // That file's comment names the old helper on purpose, to explain why it
    // isn't used -- so match on an actual import or call, not a bare mention.
    expect(sharePage).not.toMatch(/import\s*\{[^}]*fetchProfileEmails/);
    expect(sharePage).not.toMatch(/fetchProfileEmails\s*\(/);
  });
});
