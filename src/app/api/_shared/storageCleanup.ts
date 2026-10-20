import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only (lives under src/app/api/, the only place the service client may
// be used -- see service-boundary.test.ts). Removes Storage files that no row
// points at anymore. Supabase doesn't allow deleting Storage files with SQL,
// so the database queues them (supabase/migrations/0014_account_cleanup_and_verified.sql)
// and this does the actual removal through the Storage API.

const BUCKETS = new Set(["avatars", "chat-photos"]);
const UUID_FOLDER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/$/;
const FILE_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9-]{1,40}\.(jpg|png|webp)$/;

/** Is this a path the cleanup is allowed to touch? Exactly one user's folder
 * ("<uuid>/") or one avatar file inside it -- never a bucket root or anything
 * with ".." in it, whatever ends up in the queue. */
export function isSafeCleanupPath(bucket: string, path: string): boolean {
  return BUCKETS.has(bucket) && (UUID_FOLDER.test(path) || (bucket === "chat-photos"
    ? /^[0-9a-f-]{36}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(path) && UUID_FOLDER.test(path.split("/")[0] + "/")
    : FILE_PATH.test(path)));
}

/** Delete every file in one user's folder. Returns false on any error. */
export async function removeFolder(service: SupabaseClient, bucket: string, folder: string): Promise<boolean> {
  if (!isSafeCleanupPath(bucket, folder) || !folder.endsWith("/")) return false;
  const prefix = folder.slice(0, -1);
  // A folder holds a handful of photos; the cap only guards against a loop.
  for (let round = 0; round < 50; round++) {
    const { data, error } = await service.storage.from(bucket).list(prefix, { limit: 100 });
    if (error) {
      console.error("Storage list failed", error);
      return false;
    }
    if (!data?.length) return true;
    const { error: rmError } = await service.storage.from(bucket).remove(data.map((f) => `${prefix}/${f.name}`));
    if (rmError) {
      console.error("Storage remove failed", rmError);
      return false;
    }
    if (data.length < 100) return true;
  }
  return false;
}

export async function removeFile(service: SupabaseClient, bucket: string, path: string): Promise<boolean> {
  if (!isSafeCleanupPath(bucket, path) || path.endsWith("/")) return false;
  // Removing a file that's already gone is not an error in Storage.
  const { error } = await service.storage.from(bucket).remove([path]);
  if (error) console.error("Storage remove failed", error);
  return !error;
}

interface QueueRow {
  id: number;
  bucket: string;
  path: string;
  attempts: number;
}

/** Work through up to `limit` queued removals. A row that keeps failing is
 * retried on later runs and given up on after 5 attempts (left in the table
 * so it can be looked at). */
export async function processCleanupQueue(service: SupabaseClient, limit = 200) {
  const { data, error } = await service
    .from("storage_cleanup_queue")
    .select("id, bucket, path, attempts")
    .lt("attempts", 5)
    .order("id")
    .limit(limit);
  if (error) {
    console.error("Cleanup queue read failed", error);
    return { removed: 0, failed: 0, skipped: 0, error: true };
  }

  let removed = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of (data ?? []) as QueueRow[]) {
    if (!isSafeCleanupPath(row.bucket, row.path)) {
      skipped++;
      await service.from("storage_cleanup_queue").update({ attempts: 5 }).eq("id", row.id);
      continue;
    }
    const ok = row.path.endsWith("/")
      ? await removeFolder(service, row.bucket, row.path)
      : await removeFile(service, row.bucket, row.path);
    if (ok) {
      removed++;
      await service.from("storage_cleanup_queue").delete().eq("id", row.id);
    } else {
      failed++;
      await service.from("storage_cleanup_queue").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    }
  }
  return { removed, failed, skipped, error: false };
}
