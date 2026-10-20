import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isSafeCleanupPath, processCleanupQueue, removeFolder } from "../storageCleanup";

const U = "11111111-1111-1111-1111-111111111111";

describe("isSafeCleanupPath", () => {
  it.each<[string, string, boolean]>([
    ["chat-photos", `${U}/`, true],
    ["chat-photos", `${U}/${U}.webp`, true],
    ["chat-photos", `${U}/avatar.webp`, false],
    ["chat-photos", `${U}/../x.webp`, false],
    ["avatars", `${U}/`, true],
    ["avatars", `${U}/avatar-lq3x.webp`, true],
    ["avatars", `${U}/avatar.jpg`, true],
    ["avatars", "", false], // bucket root
    ["avatars", "/", false],
    ["avatars", `${U}`, false], // folder without the slash isn't a folder or a file
    ["avatars", `${U}/../other/`, false],
    ["avatars", `${U}/sub/x.webp`, false],
    ["avatars", "not-a-uuid/", false],
    ["avatars", `${U}/x.exe`, false],
    ["plans", `${U}/`, false], // only buckets this cleanup owns
  ])("%s %j -> %s", (bucket, path, ok) => {
    expect(isSafeCleanupPath(bucket, path)).toBe(ok);
  });
});

/** Just enough of the Supabase client for the cleanup code. */
function fakeService(opts: { files: Record<string, string[]>; queue: { id: number; bucket: string; path: string; attempts: number }[]; failRemove?: boolean }) {
  const removed: string[] = [];
  const deletedIds: number[] = [];
  const updates: { id: number; attempts: number }[] = [];
  const client = {
    storage: {
      from: () => ({
        list: async (prefix: string) => ({ data: (opts.files[prefix] ?? []).map((name) => ({ name })), error: null }),
        remove: async (paths: string[]) => {
          if (opts.failRemove) return { data: null, error: { message: "boom" } };
          for (const p of paths) {
            removed.push(p);
            const [folder, name] = p.split("/");
            opts.files[folder] = (opts.files[folder] ?? []).filter((n) => n !== name);
          }
          return { data: [], error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({ lt: () => ({ order: () => ({ limit: async () => ({ data: opts.queue, error: null }) }) }) }),
      delete: () => ({ eq: async (_c: string, id: number) => { deletedIds.push(id); return { error: null }; } }),
      update: (v: { attempts: number }) => ({ eq: async (_c: string, id: number) => { updates.push({ id, attempts: v.attempts }); return { error: null }; } }),
    }),
  } as unknown as SupabaseClient;
  return { client, removed, deletedIds, updates };
}

describe("cleanup", () => {
  it("removeFolder deletes every file in the user's folder", async () => {
    const f = fakeService({ files: { [U]: ["avatar-a.webp", "avatar-b.jpg"] }, queue: [] });
    expect(await removeFolder(f.client, "avatars", `${U}/`)).toBe(true);
    expect(f.removed.sort()).toEqual([`${U}/avatar-a.webp`, `${U}/avatar-b.jpg`]);
  });

  it("removeFolder refuses anything that isn't exactly one user's folder", async () => {
    const f = fakeService({ files: { "": ["x"] }, queue: [] });
    expect(await removeFolder(f.client, "avatars", "/")).toBe(false);
    expect(f.removed).toEqual([]);
  });

  it("processes the queue: done rows deleted, failures retried, unsafe rows parked", async () => {
    const f = fakeService({
      files: { [U]: ["avatar-a.webp"] },
      queue: [
        { id: 1, bucket: "avatars", path: `${U}/`, attempts: 0 },
        { id: 2, bucket: "avatars", path: `${U}/avatar-old.webp`, attempts: 0 },
        { id: 3, bucket: "avatars", path: "../../etc/", attempts: 0 },
      ],
    });
    const r = await processCleanupQueue(f.client);
    expect(r).toEqual({ removed: 2, failed: 0, skipped: 1, error: false });
    expect(f.deletedIds).toEqual([1, 2]);
    expect(f.updates).toEqual([{ id: 3, attempts: 5 }]);
  });

  it("a failed removal bumps attempts instead of dropping the row", async () => {
    const f = fakeService({ files: {}, queue: [{ id: 7, bucket: "avatars", path: `${U}/avatar-x.webp`, attempts: 2 }], failRemove: true });
    const r = await processCleanupQueue(f.client);
    expect(r.failed).toBe(1);
    expect(f.deletedIds).toEqual([]);
    expect(f.updates).toEqual([{ id: 7, attempts: 3 }]);
  });
});

describe("cron route is locked by its own secret", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/cron/storage-cleanup/route.ts"), "utf8");
  it("refuses when CRON_SECRET isn't configured, and compares in constant time", () => {
    expect(route).toMatch(/if \(!secret \|\| !hasServiceCredentials\(\)\) \{\s*return NextResponse\.json\(\{ error: "Not configured" \}, \{ status: 503 \}\);/);
    expect(route).toContain("timingSafeEqual");
    expect(route).toContain("`Bearer ${secret}`");
  });
  it("is scheduled in vercel.json", () => {
    const v = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8"));
    expect(v.crons.map((c: { path: string }) => c.path)).toContain("/api/cron/storage-cleanup");
  });
});
